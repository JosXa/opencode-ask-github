import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { fixture } from "./test-fixture.mjs";
import { registryFixture } from "./test-registry.mjs";

// A deterministic local Responses provider proves dispatch without credentials or an LLM.
const binary = process.argv[2];
const entry = process.argv[3];
assert.ok(binary && entry, "Usage: node scripts/test-native.mjs <opencode.exe> <plugin directory>");
const sandbox = await fixture();
const npmSpec =
  process.argv.find((arg) => arg.startsWith("--npm-spec="))?.slice("--npm-spec=".length) ??
  (process.argv.includes("--npm-spec") ? "opencode-ask-github@opencode-v2" : undefined);
const rejectV2 = process.argv.includes("--expect-v2-resolution-failure");
assert.ok(!rejectV2 || npmSpec === "opencode-ask-github@v2");
const registry = npmSpec ? await registryFixture(resolve(entry), sandbox) : undefined;
const artifact = (await stat(entry)).isDirectory()
  ? join(resolve(entry), "dist", "index.js")
  : resolve(entry);
const requests = [];
let scenario = "lifecycle";
let failure;
let serial = 0;
const lifecycle = `return [await tools["gh-ask"]({repo:"fixture"}), await tools["gh-ask"]({repo:"fixture"}), await tools["gh-list"]({}), await tools["gh-remove"]({repo:"fixture"}), await tools["gh-list"]({})];`;
const provider = createServer(async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: [] }));
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    requests.push({ scenario, body });
    await writeFile(join(sandbox.root, "requests.json"), JSON.stringify(requests, null, 2));
    const outputs = body.input.filter((item) => item.type === "function_call_output");
    const n = ++serial;
    let item;
    if (!body.tools?.length) {
      item = {
        type: "message",
        id: `msg_${n}`,
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: "GitHub fixture", annotations: [] }],
      };
    } else if (outputs.length) {
      const output = JSON.stringify(outputs);
      assert.ok(!output.includes("ReferenceError"), output);
      assert.ok(!output.includes("TypeError"), output);
      if (scenario === "lifecycle") {
        assert.match(output, /fixture\/repo is ready/);
        assert.match(output, /Removed/);
        assert.match(output, /No repositories cloned/);
      } else if (scenario === "gh-ask") assert.match(output, /fixture\/repo is ready/);
      else if (scenario === "gh-list") assert.match(output, /fixture\/repo/);
      else assert.match(output, /Removed/);
      item = {
        type: "message",
        id: `msg_${n}`,
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: "ASK_GITHUB_NATIVE_PASS", annotations: [] }],
      };
    } else {
      assert.ok(body.tools.some((tool) => tool.name === "execute"));
      const catalog = JSON.stringify(body);
      for (const name of ["gh-ask", "gh-list", "gh-remove"]) assert.ok(catalog.includes(name));
      if (scenario !== "lifecycle") {
        assert.ok(catalog.includes(scenario));
        if (scenario === "gh-ask") assert.ok(catalog.includes("Arguments: fixture"));
        if (scenario === "gh-remove") assert.ok(catalog.includes("Arguments is empty: fixture"));
      }
      const code =
        scenario === "lifecycle"
          ? lifecycle
          : `return await tools[${JSON.stringify(scenario)}](${scenario === "gh-list" ? "{}" : '{repo:"fixture"}'});`;
      item = {
        type: "function_call",
        id: `fc_${n}`,
        call_id: `call_${n}`,
        name: "execute",
        arguments: JSON.stringify({ code }),
        status: "completed",
      };
    }
    const response = {
      id: `resp_${n}`,
      object: "response",
      model: body.model,
      status: "completed",
      output: [item],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    };
    const events = [
      { type: "response.created", response: { ...response, status: "in_progress", output: [] } },
      {
        type: "response.output_item.added",
        output_index: 0,
        item: {
          ...item,
          status: "in_progress",
          ...(item.type === "function_call" ? { arguments: "" } : { content: [] }),
        },
      },
      ...(item.type === "function_call"
        ? [
            {
              type: "response.function_call_arguments.delta",
              item_id: item.id,
              output_index: 0,
              delta: item.arguments,
            },
            {
              type: "response.function_call_arguments.done",
              item_id: item.id,
              output_index: 0,
              arguments: item.arguments,
            },
          ]
        : [
            {
              type: "response.content_part.added",
              item_id: item.id,
              output_index: 0,
              content_index: 0,
              part: { type: "output_text", text: "", annotations: [] },
            },
            {
              type: "response.output_text.delta",
              item_id: item.id,
              output_index: 0,
              content_index: 0,
              delta: item.content[0].text,
            },
          ]),
      { type: "response.output_item.done", output_index: 0, item },
      { type: "response.completed", response },
    ];
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(
      events
        .map(
          (event, i) =>
            `event: ${event.type}\ndata: ${JSON.stringify({ ...event, sequence_number: i })}\n\n`,
        )
        .join(""),
    );
  } catch (error) {
    failure = error;
    res.writeHead(500);
    res.end(String(error));
  }
});
await new Promise((done) => provider.listen(0, "127.0.0.1", done));
await writeFile(
  join(sandbox.env.OPENCODE_CONFIG_DIR, "opencode.json"),
  JSON.stringify({
    update: "disable",
    model: "openai/gpt-5.5",
    providers: {
      openai: {
        settings: { apiKey: "fixture", baseURL: `http://127.0.0.1:${provider.address().port}/v1` },
      },
    },
    permissions: [{ action: "*", resource: "*", effect: "allow" }],
    plugins: [npmSpec ?? join(artifact, "..")],
  }),
);
// Reserve an ephemeral port; each verification owns its server and database.
const reserve = createServer();
await new Promise((done) => reserve.listen(0, "127.0.0.1", done));
const port = reserve.address().port;
await new Promise((done) => reserve.close(done));
const url = `http://127.0.0.1:${port}`;
let logs = "";
const server = spawn(
  binary,
  ["serve", "--print-logs", "--hostname", "127.0.0.1", "--port", String(port)],
  sandbox,
);
server.stdout.on("data", (chunk) => {
  logs += chunk;
});
server.stderr.on("data", (chunk) => {
  logs += chunk;
});
const api = async (method, route, body) => {
  const response = await fetch(`${url}/api/${route}`, {
    method,
    headers: {
      authorization: `Basic ${Buffer.from("opencode:ask-github-fixture").toString("base64")}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  assert.ok(response.ok, `${response.status}: ${await response.clone().text()}`);
  return response.status === 204 ? undefined : response.json();
};
try {
  let healthy = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw new Error(logs);
    try {
      await api("GET", "info");
      healthy = true;
      break;
    } catch {
      await delay(200);
    }
  }
  assert.ok(healthy, logs);
  let plugins;
  for (let attempt = 0; attempt < 100; attempt++) {
    plugins = await api("GET", `plugin?location[directory]=${encodeURIComponent(sandbox.cwd)}`);
    if (
      plugins.data.some(
        (plugin) => plugin.id === "opencode-ask-github" || plugin.state.status === "failed",
      )
    )
      break;
    await delay(100);
  }
  await writeFile(join(sandbox.root, "plugins.json"), JSON.stringify(plugins, null, 2));
  if (rejectV2) {
    const failed = plugins.data.filter((item) => item.source.target === npmSpec);
    assert.equal(failed.length, 1);
    assert.equal(failed[0].state.status, "failed");
    assert.match(logs, /No matching version found for opencode-ask-github@v2/);
    registry.verify(false);
    console.log(`Confirmed npm @v2 range cannot select the prerelease: ${sandbox.root}`);
  } else {
    const plugin = plugins.data.filter((item) => item.id === "opencode-ask-github");
    assert.equal(plugin.length, 1);
    assert.equal(plugin[0].state.status, "active");
    if (registry) {
      assert.equal(plugin[0].source.type, "package");
      assert.equal(plugin[0].source.target, npmSpec);
      assert.equal(plugin[0].source.version, registry.version);
      registry.verify();
      const loaded = logs.match(
        /entrypoint=(file:\/\/\/\S+\/node_modules\/opencode-ask-github\/dist\/index\.js)/,
      );
      assert.ok(loaded, "Native npm resolution did not load the packaged dist entrypoint");
      const loadedPath = await realpath(fileURLToPath(loaded[1]));
      assert.ok(loadedPath.startsWith(`${await realpath(sandbox.env.XDG_CACHE_HOME)}/`));
      assert.deepEqual(await readFile(loadedPath), await readFile(artifact));
    } else {
      assert.equal(await realpath(plugin[0].source.path), await realpath(artifact));
    }
    const commandList = await api(
      "GET",
      `command?location[directory]=${encodeURIComponent(sandbox.cwd)}`,
    );
    await writeFile(join(sandbox.root, "commands.json"), JSON.stringify(commandList, null, 2));
    for (const name of ["gh-ask", "gh-list", "gh-remove"])
      assert.ok(JSON.stringify(commandList).includes(`"${name}"`));
    const cli = spawn(
      binary,
      [
        "run",
        "--standalone",
        "--print-logs",
        "--agent",
        "build",
        "--auto",
        "--format",
        "json",
        "Call gh-ask twice for fixture, gh-list, gh-remove for fixture, then gh-list through Code Mode.",
      ],
      { ...sandbox, env: { ...sandbox.env, OPENCODE_DB: join(sandbox.root, "cli.db") } },
    );
    let output = "";
    cli.stdin.end();
    cli.stdout.on("data", (chunk) => {
      output += chunk;
    });
    cli.stderr.on("data", (chunk) => {
      output += chunk;
    });
    const timeout = setTimeout(() => cli.kill(), 90_000);
    const [code] = await once(cli, "exit");
    clearTimeout(timeout);
    await writeFile(join(sandbox.root, "cli.log"), output);
    if (failure) throw failure;
    assert.equal(code, 0, output);
    assert.match(output, /ASK_GITHUB_NATIVE_PASS/);
    for (const command of ["gh-ask", "gh-list", "gh-remove"]) {
      scenario = command;
      const { data: session } = await api("POST", "session", {
        title: command,
        location: { directory: sandbox.cwd },
      });
      await api("POST", `session/${session.id}/command`, {
        name: command,
        text: command === "gh-list" ? "" : "fixture",
        agent: "build",
      });
      let passed = false;
      for (let n = 0; n < 150; n++) {
        if (failure) throw failure;
        const messages = await api("GET", `session/${session.id}/context`);
        await writeFile(join(sandbox.root, `${command}.json`), JSON.stringify(messages, null, 2));
        if (JSON.stringify(messages).includes("ASK_GITHUB_NATIVE_PASS")) {
          passed = true;
          break;
        }
        await delay(200);
      }
      assert.ok(passed, `${command} timed out`);
    }
    const gitCalls = await readFile(join(sandbox.root, "git.jsonl"), "utf8");
    assert.match(gitCalls, /git@github.com:fixture\/repo.git/);
    assert.match(gitCalls, /fetch/);
    assert.match(gitCalls, /reset/);
    console.log(`Native CLI, Code Mode, and three command callbacks passed: ${sandbox.root}`);
  }
} finally {
  server.kill();
  provider.closeAllConnections();
  provider.close();
  await registry?.close();
  await writeFile(join(sandbox.root, "server.log"), logs);
  console.log(`Native evidence: ${sandbox.root}`);
}

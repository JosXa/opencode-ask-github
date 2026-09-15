import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

export async function registryFixture(directory, sandbox) {
  const result = spawnSync("npm", ["pack", "--json", "--pack-destination", sandbox.root], {
    cwd: directory,
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(result.status, 0, result.stderr);
  const packed = JSON.parse(result.stdout)[0];
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  const tarball = await readFile(join(sandbox.root, packed.filename));
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url });
    if (req.url === `/opencode-ask-github/-/${packed.filename}`) {
      res.writeHead(200, { "content-type": "application/octet-stream" });
      res.end(tarball);
    } else if (req.url === "/opencode-ask-github" || req.url === "/opencode-ask-github/v2") {
      res.writeHead(200, { "content-type": "application/json" });
      const version = {
        ...manifest,
        dist: {
          tarball: `${url}/opencode-ask-github/-/${packed.filename}`,
          shasum: packed.shasum,
          integrity: packed.integrity,
        },
      };
      res.end(
        JSON.stringify(
          req.url.endsWith("/v2")
            ? version
            : {
                name: manifest.name,
                // Advertise the invalid historical alias only to exercise its rejection.
                "dist-tags": {
                  v2: manifest.version,
                  [manifest.publishConfig.tag]: manifest.version,
                },
                versions: { [manifest.version]: version },
              },
        ),
      );
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Fixture package does not exist" }));
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const url = `http://127.0.0.1:${server.address().port}`;
  // Registry overrides belong exclusively to this fresh process and private HOME.
  sandbox.env.npm_config_registry = url;
  sandbox.env.NPM_CONFIG_REGISTRY = url;
  await writeFile(join(sandbox.env.HOME, ".npmrc"), `registry=${url}\n`);
  return {
    version: manifest.version,
    verify(download = true) {
      assert.ok(
        requests.some(
          (req) => req.url === "/opencode-ask-github" || req.url === "/opencode-ask-github/v2",
        ),
        "Native runtime did not resolve the npm spec through the registry",
      );
      assert.equal(
        requests.some((req) => req.url.endsWith(packed.filename)),
        download,
        "Unexpected native tarball download state",
      );
    },
    async close() {
      server.closeAllConnections();
      server.close();
      await writeFile(
        join(sandbox.root, "registry.json"),
        JSON.stringify({ url, requests, packed }, null, 2),
      );
    },
  };
}

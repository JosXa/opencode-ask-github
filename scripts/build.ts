import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Bundle the SDK's define helper so consumers do not install its Node 22 dependency graph.
const outdir = fileURLToPath(new URL("../dist", import.meta.url));
await rm(outdir, { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: [fileURLToPath(new URL("../src/server.ts", import.meta.url))],
  outdir,
  naming: "index.js",
  target: "node",
  format: "esm",
  packages: "bundle",
  sourcemap: "external",
});
if (!result.success) throw new AggregateError(result.logs, "Plugin build failed");

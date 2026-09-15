import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const version =
  process.env.NODE_ENV === "test" && process.env.OPENCODE_RELEASE_VERSION_TEST
    ? process.env.OPENCODE_RELEASE_VERSION_TEST
    : manifest.version;
const openCodeV2Version = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-opencode-v2$/;

if (manifest.name !== "opencode-ask-github") {
  throw new Error(`unexpected package: ${manifest.name}`);
}
if (!openCodeV2Version.test(version)) {
  throw new Error(`unsafe version: ${version}`);
}
if (manifest.publishConfig?.tag !== "opencode-v2") {
  throw new Error("OpenCode V2 prereleases must use the opencode-v2 npm tag");
}
if (process.env.REQUESTED_VERSION && process.env.REQUESTED_VERSION !== version) {
  throw new Error(`requested ${process.env.REQUESTED_VERSION}, package has ${version}`);
}

console.log(`${manifest.name}@${version} is a valid OpenCode V2 prerelease`);

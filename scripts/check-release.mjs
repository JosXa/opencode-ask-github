import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const version =
  process.env.NODE_ENV === "test" && process.env.OPENCODE_RELEASE_VERSION_TEST
    ? process.env.OPENCODE_RELEASE_VERSION_TEST
    : manifest.version;
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

if (manifest.name !== "opencode-ask-github") {
  throw new Error(`unexpected package: ${manifest.name}`);
}
if (!stableVersion.test(version)) {
  throw new Error(`unsafe version: ${version}`);
}
// Releases publish to the npm default dist-tag `latest`.
if (manifest.publishConfig?.tag !== undefined) {
  throw new Error(`unexpected publish tag: ${manifest.publishConfig.tag}`);
}
// The release tag is `vX.Y.Z` and must name the package version.
if (process.env.REQUESTED_VERSION && process.env.REQUESTED_VERSION !== `v${version}`) {
  throw new Error(`requested ${process.env.REQUESTED_VERSION}, package has v${version}`);
}

console.log(`${manifest.name}@${version} is a valid release`);

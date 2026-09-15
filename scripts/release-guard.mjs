import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import semver from "semver";

export function releaseGuard({ version, eventName, event, ref }) {
  if (
    typeof version !== "string" ||
    semver.valid(version) !== version ||
    version.includes("+")
  ) {
    throw new Error("Expected strict SemVer without build metadata");
  }
  const prerelease = version.includes("-");
  const tag = `v${version}`;
  if (eventName === "workflow_dispatch") {
    if (ref !== "refs/heads/main") throw new Error("Dry run requires main");
  } else if (eventName === "release") {
    if (event?.action !== "published" || event.release?.draft !== false) {
      throw new Error("Expected a published, non-draft release");
    }
    if (event.release.tag_name !== tag || ref !== `refs/tags/${tag}`) {
      throw new Error("Release tag must exactly match package version");
    }
    if (event.release.prerelease !== prerelease) {
      throw new Error("GitHub prerelease flag must match SemVer prerelease");
    }
  } else {
    throw new Error("Unsupported event");
  }
  return { tag, distTag: prerelease ? "next" : "latest" };
}

export function assertMainAncestry(cwd = process.cwd()) {
  execFileSync(
    "git",
    ["merge-base", "--is-ancestor", "HEAD", "refs/remotes/origin/main"],
    { cwd },
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  const result = releaseGuard({
    version,
    eventName: process.env.GITHUB_EVENT_NAME,
    event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")),
    ref: process.env.GITHUB_REF,
  });
  assertMainAncestry();
  console.log(
    `Validated ${result.tag} on main ancestry; npm dist-tag: ${result.distTag}`,
  );
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `dist-tag=${result.distTag}\n`);
  }
}

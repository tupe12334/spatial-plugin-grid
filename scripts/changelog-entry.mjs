import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Release notes come from the Changesets-maintained CHANGELOG.md, not a
// separate generator, so release-it and the GitHub release stay in sync
// with the version-bump PR that already went through review. The heading
// match is anchored to a whole line so "## 0.1.0" cannot match the start
// of "## 0.1.0-beta" or "## 0.1.10", and empty sections are rejected so a
// release never ships with a blank GitHub release body.
export function changelogEntry(version, changelogPath = "CHANGELOG.md") {
  const contents = readFileSync(changelogPath, "utf8");
  const headingPattern = new RegExp(
    `^## ${escapeRegExp(version)}\\s*$`,
    "m",
  );
  const match = headingPattern.exec(contents);
  if (!match)
    throw new Error(`CHANGELOG.md has no "## ${version}" section`);
  const rest = contents.slice(match.index + match[0].length);
  const next = rest.search(/\n## /);
  const entry = rest.slice(0, next === -1 ? undefined : next).trim();
  if (!entry)
    throw new Error(`CHANGELOG.md section "## ${version}" is empty`);
  return entry;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  console.log(changelogEntry(version));
}

import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

// Changesets owns the notes; match an entire heading, never a version prefix.
export function changelogEntry(version, path = "CHANGELOG.md") {
  const sections = readFileSync(path, "utf8").split(/^## /m).slice(1);
  const section = sections.find(
    (text) => text.split("\n", 1)[0].trim() === version,
  );
  if (!section) throw new Error(`CHANGELOG.md has no "## ${version}" section`);
  const entry = section.slice(section.indexOf("\n") + 1).trim();
  if (!entry || !section.includes("\n"))
    throw new Error(`CHANGELOG.md section "## ${version}" is empty`);
  return entry;
}

export function releasePreflight(cwd = process.cwd(), env = process.env) {
  // release-it otherwise falls back to a browser even with github.web=false.
  if (!env.GITHUB_TOKEN?.trim())
    throw new Error("GITHUB_TOKEN is required before creating a release tag.");
  const git = (...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  if (
    readdirSync(resolve(cwd, ".changeset")).some(
      (name) => name.endsWith(".md") && name !== "README.md",
    )
  )
    throw new Error(
      "Pending changesets; merge the version PR before releasing.",
    );
  // Native release-it checks the branch and tracked changes, not untracked files.
  if (git("ls-files", "--others", "--exclude-standard"))
    throw new Error(
      "Release requires a clean working tree (untracked files found).",
    );
  git("fetch", "origin", "main");
  if (git("rev-parse", "HEAD") !== git("rev-parse", "origin/main"))
    throw new Error("Local main is not up to date with origin/main.");
  const { version } = JSON.parse(
    readFileSync(resolve(cwd, "package.json"), "utf8"),
  );
  changelogEntry(version, resolve(cwd, "CHANGELOG.md"));
  // release-it permits reusing the latest tag; this workflow requires a new one.
  if (
    git("tag", "--list", `v${version}`) ||
    git("ls-remote", "--tags", "origin", `v${version}`)
  )
    throw new Error(
      `Tag v${version} already exists; version with Changesets first.`,
    );
}

if (import.meta.main) {
  if (process.argv[2] === "--notes") {
    const { version } = JSON.parse(readFileSync("package.json", "utf8"));
    console.log(changelogEntry(version));
  } else releasePreflight();
}

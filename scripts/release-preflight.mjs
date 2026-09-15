import { existsSync, readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { changelogEntry } from "./changelog-entry.mjs";

// Local preconditions release-it's own git checks don't cover: this repo
// versions and changelogs exclusively through Changesets, so a release
// must never run against an unreleased changeset, a stale main, a
// changelog missing the current version's entry, or a tag that already
// exists for it.
export function releasePreflight(cwd = process.cwd(), env = process.env) {
  if (!env.GITHUB_TOKEN?.trim())
    throw new Error("GITHUB_TOKEN is required before creating a release tag.");

  const git = (args) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

  const changesetDir = resolve(cwd, ".changeset");
  const pending = existsSync(changesetDir)
    ? readdirSync(changesetDir).filter(
        (name) => name.endsWith(".md") && name !== "README.md",
      )
    : [];
  if (pending.length > 0)
    throw new Error(
      `Pending changesets found (${pending.join(", ")}); run "pnpm changeset version" and merge the version PR before releasing.`,
    );

  if (git(["status", "--porcelain=v1", "--untracked-files=all"]))
    throw new Error(
      "Release requires a clean working tree, including staged, unstaged and untracked files.",
    );

  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== "main")
    throw new Error(`Releases run from main, not "${branch}".`);
  git(["fetch", "origin", "main"]);
  const local = git(["rev-parse", "HEAD"]);
  const remote = git(["rev-parse", "origin/main"]);
  if (local !== remote)
    throw new Error(
      "Local main is not up to date with origin/main; pull or push first.",
    );

  const { version } = JSON.parse(
    readFileSync(resolve(cwd, "package.json"), "utf8"),
  );
  changelogEntry(version, resolve(cwd, "CHANGELOG.md"));

  const tag = `v${version}`;
  const tagExists =
    git(["tag", "--list", tag]) !== "" ||
    git(["ls-remote", "--tags", "origin", tag]).trim() !== "";
  if (tagExists)
    throw new Error(
      `Tag ${tag} already exists; bump the version with a changeset before releasing again.`,
    );

  console.log(`Release preflight: ${tag} on main, up to date, no tag yet.`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  releasePreflight();

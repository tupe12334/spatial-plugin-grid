import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  cpSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { changelogEntry, releasePreflight } from "./release-preflight.mjs";

const root = resolve(import.meta.dirname, "..");
const changesets = resolve(root, "node_modules/@changesets/cli/bin.js");
const releaseIt = resolve(root, "node_modules/release-it/bin/release-it.js");
const snapshot = () =>
  [
    "package.json",
    "CHANGELOG.md",
    ...readdirSync(join(root, ".changeset")).map(
      (name) => `.changeset/${name}`,
    ),
  ].map((name) => [
    name,
    existsSync(join(root, name))
      ? readFileSync(join(root, name), "utf8")
      : null,
  ]);

for (const prerelease of [false, true]) {
  test(`Changesets version PR → release-it dry-run (${prerelease ? "prerelease" : "stable"})`, (t) => {
    const before = snapshot();
    const base = mkdtempSync(join(tmpdir(), "release-tooling-"));
    t.after(() => rmSync(base, { recursive: true, force: true }));
    const cwd = join(base, "repo");
    const remote = join(base, "origin.git");
    mkdirSync(cwd);
    const git = (...args) =>
      execFileSync("git", args, { cwd, stdio: "pipe" }).toString().trim();
    const node = (bin, ...args) =>
      execFileSync(process.execPath, [bin, ...args], {
        cwd,
        encoding: "utf8",
        stdio: "pipe",
        env: { ...process.env, GITHUB_TOKEN: "", CI: "true" },
      });
    git("init", "--bare", remote);
    git("init", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.invalid");
    git(
      "remote",
      "add",
      "origin",
      "https://github.com/tupe12334/fixture-pkg.git",
    );
    // Keep the GitHub-shaped URL for plugin discovery; all Git traffic stays local.
    git(
      "config",
      `url.${remote}.insteadOf`,
      "https://github.com/tupe12334/fixture-pkg.git",
    );
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({ name: "fixture-pkg", version: "1.0.0" }),
    );
    mkdirSync(join(cwd, ".changeset"));
    cpSync(
      join(root, ".changeset/config.json"),
      join(cwd, ".changeset/config.json"),
    );
    mkdirSync(join(cwd, "scripts"));
    cpSync(
      join(root, "scripts/release-preflight.mjs"),
      join(cwd, "scripts/release-preflight.mjs"),
    );
    cpSync(join(root, ".release-it.json"), join(cwd, ".release-it.json"));
    git("add", ".");
    git("commit", "-m", "fixture");
    if (prerelease) node(changesets, "pre", "enter", "rc");
    const pending = join(cwd, ".changeset/fixture.md");
    writeFileSync(
      pending,
      '---\n"fixture-pkg": minor\n---\n\nFixture feature\n',
    );
    node(changesets, "version");
    const version = prerelease ? "1.1.0-rc.0" : "1.1.0";
    assert.equal(
      JSON.parse(readFileSync(join(cwd, "package.json"))).version,
      version,
    );
    assert.match(
      changelogEntry(version, join(cwd, "CHANGELOG.md")),
      /Fixture feature/,
    );
    assert.equal(existsSync(pending), false);
    git("add", ".");
    git("commit", "-m", "version PR");
    git("push", "-u", "origin", "main");
    releasePreflight(cwd, { GITHUB_TOKEN: "fixture-only" });
    const newChangeset = join(cwd, ".changeset/new.md");
    writeFileSync(newChangeset, '---\n"fixture-pkg": patch\n---\nNew change\n');
    assert.throws(
      () => releasePreflight(cwd, { GITHUB_TOKEN: "fixture-only" }),
      /Pending changesets/,
    );
    rmSync(newChangeset);
    const head = git("rev-parse", "HEAD");
    assert.match(
      node(releaseIt, "--dry-run", "--ci"),
      new RegExp(version.replaceAll(".", "\\.")),
    );
    // Dry-run skips hooks; separately exercise the real credential gate before any writes.
    assert.throws(
      () => node(releaseIt, "--ci"),
      (error) => /GITHUB_TOKEN is required/.test(error.stdout + error.stderr),
    );
    assert.equal(git("status", "--porcelain"), "");
    assert.equal(git("rev-parse", "HEAD"), head);
    assert.equal(
      git("ls-remote", "origin", "refs/heads/main"),
      `${head}\trefs/heads/main`,
    );
    assert.equal(git("tag", "--list"), "");
    assert.equal(git("ls-remote", "--tags", "origin"), "");
    assert.deepEqual(snapshot(), before);
  });
}

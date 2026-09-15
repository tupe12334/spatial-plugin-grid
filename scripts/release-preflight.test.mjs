import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { releasePreflight } from "./release-preflight.mjs";

test("repository policy beyond release-it's native branch/clean checks", (t) => {
  const base = mkdtempSync(join(tmpdir(), "preflight-"));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const cwd = join(base, "repo");
  const remote = join(base, "origin.git");
  mkdirSync(cwd);
  const git = (...args) =>
    execFileSync("git", args, { cwd, stdio: "pipe" }).toString().trim();
  git("init", "--bare", remote);
  git("init", "-b", "main");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.invalid");
  git("remote", "add", "origin", remote);
  mkdirSync(join(cwd, ".changeset"));
  writeFileSync(join(cwd, ".changeset/README.md"), "Changesets\n");
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify({ version: "1.2.0" }),
  );
  const notes = join(cwd, "CHANGELOG.md");
  writeFileSync(notes, "## 1.2.0\n\n- Release\n");
  git("add", ".");
  git("commit", "-m", "fixture");
  git("push", "-u", "origin", "main");
  const check = () => releasePreflight(cwd, { GITHUB_TOKEN: "fixture" });
  assert.doesNotThrow(check);
  assert.throws(() => releasePreflight(cwd, {}), /GITHUB_TOKEN/);
  const pending = join(cwd, ".changeset/pending.md");
  writeFileSync(pending, "pending");
  assert.throws(check, /Pending changesets/);
  rmSync(pending);
  writeFileSync(join(cwd, "untracked"), "untracked");
  assert.throws(check, /untracked/);
  rmSync(join(cwd, "untracked"));
  writeFileSync(notes, "## 1.1.0\n\n- Old\n");
  assert.throws(check, /no "## 1.2.0"/);
  git("restore", "CHANGELOG.md");
  git("commit", "--allow-empty", "-m", "ahead");
  assert.throws(check, /not up to date/);
  git("push", "origin", "main");
  git("checkout", "--detach", "HEAD~1");
  assert.throws(check, /not up to date/);
  git("checkout", "main");
  git("tag", "v1.2.0");
  assert.throws(check, /already exists/);
  git("push", "origin", "v1.2.0");
  git("tag", "-d", "v1.2.0");
  assert.throws(check, /already exists/);
});

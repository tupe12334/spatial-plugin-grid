import assert from "node:assert/strict";
import { test, after } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  writeFileSync as writeFile,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { releasePreflight } from "./release-preflight.mjs";

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function baseFixture() {
  const bareDir = mkdtempSync(join(tmpdir(), "preflight-origin-"));
  git(["init", "-q", "--bare", "-b", "main"], bareDir);

  const dir = mkdtempSync(join(tmpdir(), "preflight-fixture-"));
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  git(["remote", "add", "origin", bareDir], dir);

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "fixture-pkg", version: "1.2.0" }, null, 2),
  );
  writeFileSync(
    join(dir, "CHANGELOG.md"),
    "# fixture-pkg\n\n## 1.2.0\n\n- Fixture release entry\n",
  );
  mkdirSync(join(dir, ".changeset"));
  writeFileSync(join(dir, ".changeset", "README.md"), "placeholder\n");

  git(["add", "-A"], dir);
  git(["commit", "-q", "-m", "feat: fixture release entry"], dir);
  git(["push", "-q", "-u", "origin", "main"], dir);

  return { dir, bareDir };
}

const cleanup = [];
after(() => {
  for (const dir of cleanup) rmSync(dir, { recursive: true, force: true });
});

test("passes for a clean, up-to-date main with a matching changelog entry and no tag", () => {
  const { dir, bareDir } = baseFixture();
  cleanup.push(dir, bareDir);
  assert.doesNotThrow(() =>
    releasePreflight(dir, { GITHUB_TOKEN: "fixture-only" }),
  );
});

test("rejects a pending changeset", () => {
  const { dir, bareDir } = baseFixture();
  cleanup.push(dir, bareDir);
  writeFile(
    join(dir, ".changeset", "brave-lions-fly.md"),
    '---\n"fixture-pkg": minor\n---\n\nPending change\n',
  );
  assert.throws(
    () => releasePreflight(dir, { GITHUB_TOKEN: "fixture-only" }),
    /Pending changesets/,
  );
});

test("rejects a branch other than main", () => {
  const { dir, bareDir } = baseFixture();
  cleanup.push(dir, bareDir);
  git(["checkout", "-q", "-b", "feature"], dir);
  assert.throws(
    () => releasePreflight(dir, { GITHUB_TOKEN: "fixture-only" }),
    /main/,
  );
});

test("rejects a local main that is behind origin/main", () => {
  const { dir, bareDir } = baseFixture();
  cleanup.push(dir, bareDir);
  // Simulate a stale local checkout: advance origin without updating dir.
  const clone = mkdtempSync(join(tmpdir(), "preflight-clone-"));
  git(["clone", "-q", bareDir, clone], undefined);
  git(["config", "user.email", "test@example.com"], clone);
  git(["config", "user.name", "Test"], clone);
  writeFileSync(join(clone, "README.md"), "extra\n");
  git(["add", "-A"], clone);
  git(["commit", "-q", "-m", "chore: extra commit"], clone);
  git(["push", "-q", "origin", "main"], clone);
  cleanup.push(clone);

  assert.throws(
    () => releasePreflight(dir, { GITHUB_TOKEN: "fixture-only" }),
    /not up to date/,
  );
});

test("rejects a missing changelog entry for the current version", () => {
  const { dir, bareDir } = baseFixture();
  cleanup.push(dir, bareDir);
  writeFileSync(
    join(dir, "CHANGELOG.md"),
    "# fixture-pkg\n\n## 1.1.0\n\n- Old\n",
  );
  git(["add", "-A"], dir);
  git(["commit", "-qm", "chore: old changelog"], dir);
  git(["push", "-q", "origin", "main"], dir);
  assert.throws(
    () => releasePreflight(dir, { GITHUB_TOKEN: "fixture-only" }),
    /changelog|CHANGELOG|entry/,
  );
});

test("rejects a version whose tag already exists locally", () => {
  const { dir, bareDir } = baseFixture();
  cleanup.push(dir, bareDir);
  git(["tag", "v1.2.0"], dir);
  assert.throws(
    () => releasePreflight(dir, { GITHUB_TOKEN: "fixture-only" }),
    /already exists/,
  );
});

test("rejects a version whose tag already exists on origin", () => {
  const { dir, bareDir } = baseFixture();
  cleanup.push(dir, bareDir);
  const clone = mkdtempSync(join(tmpdir(), "preflight-clone-"));
  git(["clone", "-q", bareDir, clone], undefined);
  git(["config", "user.email", "test@example.com"], clone);
  git(["config", "user.name", "Test"], clone);
  git(["tag", "v1.2.0"], clone);
  git(["push", "-q", "origin", "v1.2.0"], clone);
  cleanup.push(clone);

  assert.throws(
    () => releasePreflight(dir, { GITHUB_TOKEN: "fixture-only" }),
    /already exists/,
  );
});

test("rejects missing credentials before any Git operation", () => {
  assert.throws(
    () => releasePreflight("/nonexistent", {}),
    /GITHUB_TOKEN is required/,
  );
});

for (const state of [
  "staged",
  "unstaged",
  "untracked",
  "untracked changelog",
]) {
  test(`rejects ${state} release inputs`, () => {
    const { dir, bareDir } = baseFixture();
    cleanup.push(dir, bareDir);
    if (state === "untracked changelog") {
      git(["rm", "--cached", "CHANGELOG.md"], dir);
      git(["commit", "-qm", "chore: remove changelog"], dir);
    } else {
      writeFileSync(
        join(dir, state === "untracked" ? "extra.md" : "CHANGELOG.md"),
        "dirty",
      );
      if (state === "staged") git(["add", "-A"], dir);
    }
    assert.throws(
      () => releasePreflight(dir, { GITHUB_TOKEN: "fixture-only" }),
      /clean working tree/,
    );
  });
}

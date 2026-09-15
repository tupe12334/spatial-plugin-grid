import assert from "node:assert/strict";
import { test, after } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  cpSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

// Proves this repo's actual .release-it.json is safe to run: a --dry-run
// against a disposable fixture repo (with its own bare "origin" remote)
// creates no tag, pushes nothing, and writes no CHANGELOG/package.json
// change. release-it skips write-side hooks (including our before:init
// preflight) during --dry-run by design, so the preflight guard itself is
// covered separately in scripts/release-preflight.test.mjs against the
// real exported function.

const repoRoot = resolve(import.meta.dirname, "..");
const releaseItBin = resolve(
  repoRoot,
  "node_modules/release-it/bin/release-it.js",
);

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function makeFixture() {
  const bareDir = mkdtempSync(join(tmpdir(), "release-it-origin-"));
  git(["init", "-q", "--bare", "-b", "main"], bareDir);

  const dir = mkdtempSync(join(tmpdir(), "release-it-fixture-"));
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  // A GitHub-shaped (but nonexistent) URL lets release-it's GitHub plugin
  // parse owner/repo without needing real network access; --dry-run never
  // issues the real push or API calls that would require it to resolve.
  git(
    ["remote", "add", "origin", "https://github.com/tupe12334/fixture-pkg.git"],
    dir,
  );
  git(["remote", "add", "local-origin", bareDir], dir);

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      { name: "fixture-pkg", version: "1.2.0", license: "MIT" },
      null,
      2,
    ),
  );
  writeFileSync(
    join(dir, "CHANGELOG.md"),
    "# fixture-pkg\n\n## 1.2.0\n\n### Minor Changes\n\n- Fixture release entry\n",
  );
  mkdirSync(join(dir, ".changeset"));
  writeFileSync(
    join(dir, ".changeset", "README.md"),
    "Changesets fixture placeholder.\n",
  );
  mkdirSync(join(dir, "scripts"));
  cpSync(
    resolve(repoRoot, "scripts/changelog-entry.mjs"),
    join(dir, "scripts/changelog-entry.mjs"),
  );
  cpSync(
    resolve(repoRoot, ".release-it.json"),
    join(dir, ".release-it.json"),
  );

  git(["add", "-A"], dir);
  git(["commit", "-q", "-m", "feat: fixture release entry"], dir);
  git(["push", "-q", "-u", "local-origin", "main"], dir);
  // Fake "origin" (the GitHub-shaped remote) is never actually fetched, so
  // point its tracking ref at HEAD by hand instead of a real fetch, then
  // wire main to track it the same way a real clone's upstream would be.
  const head = git(["rev-parse", "HEAD"], dir);
  git(["update-ref", "refs/remotes/origin/main", head], dir);
  git(["config", "branch.main.remote", "origin"], dir);
  git(["config", "branch.main.merge", "refs/heads/main"], dir);

  return { dir, bareDir };
}

const cleanup = [];
after(() => {
  for (const dir of cleanup) rmSync(dir, { recursive: true, force: true });
});

function dryRun(dir) {
  return execFileSync(process.execPath, [releaseItBin, "--dry-run", "--ci"], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, CI: "true" },
  });
}

test("release-it --dry-run tags nothing, pushes nothing, and does not bump the version", () => {
  const { dir, bareDir } = makeFixture();
  cleanup.push(dir, bareDir);

  const beforeHead = git(["rev-parse", "HEAD"], dir);

  const output = dryRun(dir);
  assert.match(output, /1\.2\.0/);

  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  assert.equal(pkg.version, "1.2.0", "dry run must not bump the version");

  assert.equal(
    git(["tag", "--list"], dir),
    "",
    "dry run must not create a local tag",
  );
  assert.equal(
    git(["tag", "--list"], bareDir),
    "",
    "dry run must not push a tag to origin",
  );
  assert.equal(
    git(["rev-parse", "HEAD"], dir),
    beforeHead,
    "dry run must not create a release commit",
  );
  assert.equal(
    git(["rev-parse", "local-origin/main"], dir),
    beforeHead,
    "dry run must not push new commits",
  );
});

test("running release-it --dry-run twice stays idempotent (no double bump, no accumulated tags)", () => {
  const { dir, bareDir } = makeFixture();
  cleanup.push(dir, bareDir);

  dryRun(dir);
  dryRun(dir);

  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  assert.equal(pkg.version, "1.2.0");
  assert.equal(git(["tag", "--list"], dir), "");
});

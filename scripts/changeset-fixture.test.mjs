import assert from "node:assert/strict";
import { test, after } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { writeChangeset } from "@changesets/write";

// Proves the real @changesets/cli "status"/"version" commands and the real
// @changesets/write API (what "changeset add" calls after its prompts)
// work end to end, entirely inside a disposable fixture repo. Nothing here
// touches this repository's own package.json, CHANGELOG.md, or .changeset/.

const repoRoot = resolve(import.meta.dirname, "..");
const changesetCli = resolve(repoRoot, "node_modules/@changesets/cli/bin.js");
const realPackageJsonPath = resolve(repoRoot, "package.json");
const realChangelogPath = resolve(repoRoot, "CHANGELOG.md");
// Snapshot before any fixture runs, not a hardcoded expected version: this
// repo's own version/changelog legitimately change once a real Changesets
// version PR merges, so the "no mutation" check below must compare against
// whatever was actually on disk, not bake in "0.1.0" forever.
const realPackageJsonBefore = readFileSync(realPackageJsonPath, "utf8");
const realChangelogBefore = existsSync(realChangelogPath)
  ? readFileSync(realChangelogPath, "utf8")
  : null;

function changesetSnapshot() {
  const dir = resolve(repoRoot, ".changeset");
  return readdirSync(dir)
    .sort()
    .map((name) => [name, readFileSync(join(dir, name), "utf8")]);
}
const realChangesetsBefore = changesetSnapshot();

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "changeset-fixture-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: dir,
  });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "fixture-pkg",
        version: "1.0.0",
        license: "MIT",
        scripts: { version: `node "${changesetCli}" version` },
      },
      null,
      2,
    ),
  );
  mkdirSync(join(dir, ".changeset"));
  writeFileSync(
    join(dir, ".changeset", "config.json"),
    JSON.stringify({
      $schema: "https://unpkg.com/@changesets/config@3.1.1/schema.json",
      changelog: "@changesets/cli/changelog",
      commit: false,
      fixed: [],
      linked: [],
      access: "restricted",
      baseBranch: "main",
      updateInternalDependencies: "patch",
      ignore: [],
    }),
  );
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: dir });
  return dir;
}

function status(dir) {
  try {
    const output = execFileSync(process.execPath, [changesetCli, "status"], {
      cwd: dir,
      encoding: "utf8",
    });
    return { status: 0, output };
  } catch (error) {
    return { status: error.status, output: error.stdout + error.stderr };
  }
}

const dirs = [];
function makeFixture() {
  const dir = fixture();
  dirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

test("status reports clean when no changesets are pending", () => {
  const dir = makeFixture();
  const result = status(dir);
  assert.equal(result.status, 0);
});

test("real writeChangeset + status + version bump and generate a changelog", async () => {
  const dir = makeFixture();

  const id = await writeChangeset(
    {
      summary: "Add fixture feature",
      releases: [{ name: "fixture-pkg", type: "minor" }],
    },
    dir,
  );
  const changesetFile = join(dir, ".changeset", `${id}.md`);
  assert.ok(existsSync(changesetFile));

  const pending = status(dir);
  assert.equal(pending.status, 0);
  assert.match(pending.output, /fixture-pkg/);

  execFileSync("pnpm", ["run", "version"], { cwd: dir });

  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  assert.equal(pkg.version, "1.1.0");

  const changelog = readFileSync(join(dir, "CHANGELOG.md"), "utf8");
  assert.match(changelog, /## 1\.1\.0/);
  assert.match(changelog, /Add fixture feature/);

  assert.ok(!existsSync(changesetFile), "changeset should be consumed");
  const remaining = readdirSync(join(dir, ".changeset")).filter(
    (name) => name.endsWith(".md") && name !== "README.md",
  );
  assert.equal(remaining.length, 0);
});

test("a second version cycle on an already-versioned fixture bumps again and appends to the changelog", async () => {
  // Mirrors this repo's real future: a fixture that already went through
  // one version() call (like a repo whose 0.1.0 -> 0.2.0 version PR already
  // merged) must still accept a new changeset and version cleanly.
  const dir = makeFixture();
  await writeChangeset(
    {
      summary: "First release entry",
      releases: [{ name: "fixture-pkg", type: "minor" }],
    },
    dir,
  );
  execFileSync("pnpm", ["run", "version"], { cwd: dir });
  const firstPkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  assert.equal(firstPkg.version, "1.1.0");

  await writeChangeset(
    {
      summary: "Second release entry",
      releases: [{ name: "fixture-pkg", type: "patch" }],
    },
    dir,
  );
  const secondPending = status(dir);
  assert.equal(secondPending.status, 0);

  execFileSync("pnpm", ["run", "version"], { cwd: dir });

  const secondPkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  assert.equal(secondPkg.version, "1.1.1");

  const changelog = readFileSync(join(dir, "CHANGELOG.md"), "utf8");
  assert.match(changelog, /## 1\.1\.1/);
  assert.match(changelog, /Second release entry/);
  assert.match(changelog, /## 1\.1\.0/);
  assert.match(changelog, /First release entry/);

  const remaining = readdirSync(join(dir, ".changeset")).filter(
    (name) => name.endsWith(".md") && name !== "README.md",
  );
  assert.equal(remaining.length, 0);
});

test("fixture runs never mutate this repository's own release files", () => {
  assert.deepEqual(changesetSnapshot(), realChangesetsBefore);
  assert.equal(
    readFileSync(realPackageJsonPath, "utf8"),
    realPackageJsonBefore,
    "this repo's package.json must be byte-for-byte unchanged",
  );
  assert.equal(
    existsSync(realChangelogPath)
      ? readFileSync(realChangelogPath, "utf8")
      : null,
    realChangelogBefore,
    "this repo's CHANGELOG.md must be byte-for-byte unchanged (or still absent)",
  );
});

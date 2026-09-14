import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { assertMainAncestry, releaseGuard } from "./release-guard.mjs";

function release(version = "1.2.3", prerelease = false) {
  return {
    version,
    eventName: "release",
    ref: `refs/tags/v${version}`,
    event: {
      action: "published",
      release: { tag_name: `v${version}`, prerelease, draft: false },
    },
  };
}

for (const version of ["0.1.0", "1.2.3", "10.20.30"]) {
  test(`stable ${version}`, () =>
    assert.deepEqual(releaseGuard(release(version)), {
      tag: `v${version}`,
      distTag: "latest",
    }));
}
for (const version of ["1.0.0-rc.1", "0.1.0-0", "1.0.0-alpha-beta.01a"]) {
  test(`prerelease ${version}`, () =>
    assert.equal(releaseGuard(release(version, true)).distTag, "next"));
}
for (const version of [
  "",
  "v1.2.3",
  "1.2",
  "01.2.3",
  "1.02.3",
  "1.2.03",
  "1.2.3-01",
  "1.2.3-rc.01",
  "1.2.3-",
  "1.2.3-a..b",
  "1.2.3+build",
  "9007199254740992.0.0",
  `1.2.3-${"a".repeat(251)}`,
  "1.2.3\n",
  "1.2.3;echo bad",
  null,
  123,
]) {
  test(`reject invalid version ${JSON.stringify(version)}`, () =>
    assert.throws(() => releaseGuard(release(version))));
}
for (const [version, flag] of [
  ["1.2.3", true],
  ["1.2.3-rc.1", false],
  ["1.2.3", "false"],
  ["1.2.3", undefined],
]) {
  test(`reject flag ${version}/${flag}`, () => {
    const input = release(version);
    input.event.release.prerelease = flag;
    assert.throws(() => releaseGuard(input));
  });
}
for (const mutate of [
  (input) => {
    input.event.release.tag_name = "v9.9.9";
  },
  (input) => {
    input.event.release.tag_name = "1.2.3";
  },
  (input) => {
    input.ref = "refs/heads/main";
  },
  (input) => {
    input.event.release.draft = true;
  },
  (input) => {
    input.event.action = "edited";
  },
  (input) => {
    input.eventName = "push";
  },
]) {
  test(`reject event mutation ${mutate}`, () => {
    const input = release();
    mutate(input);
    assert.throws(() => releaseGuard(input));
  });
}
test("dispatch synthesizes version tag on main only", () => {
  for (const version of ["0.1.0", "0.2.0-rc.1"]) {
    const input = {
      version,
      eventName: "workflow_dispatch",
      event: {},
      ref: "refs/heads/main",
    };
    assert.deepEqual(releaseGuard(input), {
      tag: `v${version}`,
      distTag: version.includes("-") ? "next" : "latest",
    });
    assert.throws(() => releaseGuard({ ...input, ref: "refs/heads/topic" }));
    assert.throws(() =>
      releaseGuard({ ...input, ref: `refs/tags/v${version}` }),
    );
  }
});
test("ancestry accepts main and its ancestor, rejects off-main and missing main", () => {
  const cwd = mkdtempSync(join(tmpdir(), "spg-release-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd, stdio: "pipe" }).toString().trim();
  try {
    git("init");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "base",
    );
    const base = git("rev-parse", "HEAD");
    assert.throws(() => assertMainAncestry(cwd));
    git("update-ref", "refs/remotes/origin/main", base);
    assertMainAncestry(cwd);
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "next",
    );
    assert.throws(() => assertMainAncestry(cwd));
    git("update-ref", "refs/remotes/origin/main", git("rev-parse", "HEAD"));
    git("checkout", "--detach", base);
    assertMainAncestry(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

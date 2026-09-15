import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";

// Exercises the real commitlint CLI against the committed config, the same
// binary and config the commit-msg hook runs, not a mocked linter.
function lint(message) {
  try {
    execFileSync(
      process.execPath,
      [
        "node_modules/@commitlint/cli/cli.js",
        "--config",
        "commitlint.config.js",
      ],
      { input: message, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
    return 0;
  } catch (error) {
    return error.status;
  }
}

for (const message of [
  "feat: add release tooling",
  "fix(release): guard pending changesets",
  "chore: bump devDependencies",
  "feat!: drop legacy config format",
]) {
  test(`accepts conventional commit: ${message}`, () =>
    assert.equal(lint(message), 0));
}

for (const message of [
  "add release tooling",
  "Fix: wrong case type",
  "",
  "random text with no type",
]) {
  test(`rejects non-conventional commit: ${JSON.stringify(message)}`, () =>
    assert.notEqual(lint(message), 0));
}

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changelogEntry } from "./release-preflight.mjs";

const dirs = [];
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

function changelog(contents) {
  const dir = mkdtempSync(join(tmpdir(), "changelog-entry-"));
  dirs.push(dir);
  const path = join(dir, "CHANGELOG.md");
  writeFileSync(path, contents);
  return path;
}

test("extracts the exact version section", () => {
  const path = changelog(
    "# pkg\n\n## 0.2.0\n\n- Newer\n\n## 0.1.0\n\n- Older\n",
  );
  assert.equal(changelogEntry("0.1.0", path), "- Older");
});

test("does not match a version that is a substring prefix of another heading", () => {
  const path = changelog("# pkg\n\n## 0.1.0-beta\n\n- Beta only\n");
  assert.throws(() => changelogEntry("0.1.0", path), /no "## 0\.1\.0" section/);
});

test("does not match a version that is a numeric extension of the heading", () => {
  const path = changelog("# pkg\n\n## 0.1.01\n\n- Wrong entry\n");
  assert.throws(() => changelogEntry("0.1.0", path), /no "## 0\.1\.0" section/);
});

test("does not match the version mentioned inside another section's body", () => {
  const path = changelog(
    "# pkg\n\n## 0.2.0\n\nSee also ## 0.1.0 for history.\n",
  );
  assert.throws(() => changelogEntry("0.1.0", path), /no "## 0\.1\.0" section/);
});

test("rejects an empty section instead of shipping blank release notes", () => {
  const path = changelog("# pkg\n\n## 0.1.0\n\n## 0.0.1\n\n- Old\n");
  assert.throws(() => changelogEntry("0.1.0", path), /is empty/);
});

test("rejects a section that is only whitespace", () => {
  const path = changelog("# pkg\n\n## 0.1.0\n\n   \n\n## 0.0.1\n\n- Old\n");
  assert.throws(() => changelogEntry("0.1.0", path), /is empty/);
});

test("throws when the changelog has no matching heading at all", () => {
  const path = changelog("# pkg\n\n## 0.2.0\n\n- Newer\n");
  assert.throws(() => changelogEntry("0.1.0", path), /no "## 0\.1\.0" section/);
});

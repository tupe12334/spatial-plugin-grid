// @vitest-environment node
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { states, stories, verifyInventory } from "./visual/registry";
const roots: string[] = [];
afterEach(() =>
  roots
    .splice(0)
    .forEach((root) => rmSync(root, { recursive: true, force: true })),
);
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !key.toUpperCase().startsWith("GIT_"),
  ),
);
function repo() {
  const root = mkdtempSync(join(tmpdir(), "spg-guard-"));
  roots.push(root);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
  git("init");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Test");
  mkdirSync(join(root, "tests/visual/baselines"), { recursive: true });
  writeFileSync(join(root, "tests/visual/baselines/a.png"), "original");
  writeFileSync(join(root, "README.md"), "committed docs");
  git("add", ".");
  git("commit", "-m", "fixture");
  const guard = () =>
    execFileSync(
      process.execPath,
      [join(process.cwd(), "scripts/baseline-guard.mjs")],
      { cwd: root, env, stdio: "pipe" },
    );
  return { root, git, guard };
}
for (const kind of [
  "unstaged",
  "staged",
  "untracked",
  "deleted",
  "staged deletion",
])
  test(`guard rejects ${kind} PNG`, () => {
    const { root, git, guard } = repo();
    const path = join(
      root,
      "tests/visual/baselines",
      kind === "untracked" ? "new.png" : "a.png",
    );
    if (kind.includes("delet")) rmSync(path);
    else writeFileSync(path, "changed");
    if (kind.startsWith("staged")) git("add", "-A");
    expect(guard).toThrow(/Baseline guard/);
  });
test("guard allows unrelated dirty docs and committed baselines", () => {
  const { root, git, guard } = repo();
  writeFileSync(join(root, "README.md"), "staged docs");
  git("add", "README.md");
  writeFileSync(join(root, "README.md"), "unstaged docs");
  writeFileSync(join(root, "notes.md"), "untracked docs");
  expect(guard).not.toThrow();
});
test("inventory requires every story exactly once", () => {
  expect(() => verifyInventory(stories)).not.toThrow();
  expect(() => verifyInventory([...stories, "new--story"])).toThrow(
    /inventory/,
  );
  expect(() => verifyInventory(stories.slice(1))).toThrow(/inventory/);
});
test("direct screenshot filename collision regression", () => {
  const entries = states.map((entry) => ({ ...entry }));
  entries[entries.length - 1]!.name = entries[0]!.name;
  expect(() => verifyInventory(stories, entries)).toThrow(/collision/);
});

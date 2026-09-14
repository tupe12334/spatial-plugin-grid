// @vitest-environment node
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import {
  states,
  stories,
  verifyInventory,
  verifyBaselines,
} from "./visual/registry";
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
  expect(() => verifyInventory(stories, entries)).toThrow(
    `Screenshot filename collision at tests/visual/baselines/${entries[0]!.name}.png: ${entries[0]!.story} and ${entries[entries.length - 1]!.story}`,
  );
});

for (const kind of [
  "unstaged baseline",
  "staged baseline",
  "untracked baseline",
  "deleted baseline",
  "staged deletion baseline",
  "unstaged source",
  "staged source",
  "untracked source",
  "deleted source",
  "untracked config",
  "source under docs",
  "dirty hook",
  "wrong ref",
]) {
  test(`actual Git push rejects ${kind}`, () => {
    const { root, git } = repo();
    cpSync(join(process.cwd(), "scripts"), join(root, "scripts"), {
      recursive: true,
    });
    cpSync(join(process.cwd(), ".husky"), join(root, ".husky"), {
      recursive: true,
    });
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src/input.ts"), "export const value = 1;\n");
    git("add", ".");
    git("commit", "-m", "validation inputs");
    git("config", "core.hooksPath", ".husky/_");
    mkdirSync(join(root, "docs"));
    const remote = join(root, "remote.git");
    git("init", "--bare", remote);
    // Bare receiver lives inside the fixture, so exclude it from input checks.
    writeFileSync(join(root, ".git/info/exclude"), "remote.git/\n");
    let ref = "HEAD:refs/heads/review";
    if (kind === "wrong ref") ref = "HEAD~1:refs/heads/older";
    else {
      const relative = kind.includes("baseline")
        ? `tests/visual/baselines/${kind.startsWith("untracked") ? "new" : "a"}.png`
        : kind === "dirty hook"
          ? ".husky/pre-push"
          : kind === "source under docs"
            ? "docs/input.ts"
            : kind === "untracked config"
              ? "new.config.js"
              : `src/${kind.startsWith("untracked") ? "new" : "input"}.ts`;
      const path = join(root, relative);
      if (kind.includes("delet")) rmSync(path);
      else if (kind === "dirty hook")
        writeFileSync(path, "# dirty hook\nnode scripts/pre-push.mjs\n");
      else writeFileSync(path, "changed\n");
      if (kind.startsWith("staged")) git("add", "-A");
    }
    const pushed = spawnSync("git", ["push", remote, ref], {
      cwd: root,
      env,
      encoding: "utf8",
    });
    expect(pushed.status).not.toBe(0);
    expect(pushed.stderr + pushed.stdout).toMatch(
      kind === "wrong ref"
        ? /is not checkout HEAD/
        : kind.includes("baseline")
          ? /Baseline guard/
          : /Validation input guard/,
    );
    expect(
      git("--git-dir", remote, "for-each-ref", "refs/heads").toString(),
    ).toBe("");
  });
}

const inputGuard = pathToFileURL(
  join(process.cwd(), "scripts/input-guard.mjs"),
).href;
function runInputGuard(root: string, code = "guard()") {
  return execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { guard, checkPush, head } from ${JSON.stringify(inputGuard)}; ${code}`,
    ],
    { cwd: root, env, stdio: "pipe" },
  );
}
test("input guard permits staged, unstaged and untracked unrelated documentation", () => {
  const { root, git } = repo();
  writeFileSync(join(root, "README.md"), "staged");
  git("add", "README.md");
  writeFileSync(join(root, "README.md"), "unstaged");
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "docs/notes.md"), "untracked");
  expect(() => runInputGuard(root)).not.toThrow();
});
test("post-suite guard detects inputs changed after initial guard", () => {
  const { root } = repo();
  expect(() =>
    runInputGuard(
      root,
      `guard(); const { writeFileSync } = await import('node:fs'); writeFileSync('package.json', '{}'); guard();`,
    ),
  ).toThrow(/Validation input guard/);
});
test("post-suite guard rejects HEAD movement", () => {
  const { root, git } = repo();
  const previous = git("rev-parse", "HEAD").toString().trim();
  git("commit", "--allow-empty", "-m", "new head");
  expect(() =>
    runInputGuard(root, `guard(${JSON.stringify(previous)})`),
  ).toThrow(/HEAD changed/);
});
test("push input checks every ref and permits deletions and HEAD aliases", () => {
  const { root, git } = repo();
  const sha = git("rev-parse", "HEAD").toString().trim();
  const zero = "0".repeat(40);
  const good = `refs/heads/main ${sha} refs/heads/main ${zero}\n(delete) ${zero} refs/heads/old ${sha}\n`;
  expect(() =>
    runInputGuard(root, `checkPush(${JSON.stringify(good)})`),
  ).not.toThrow();
  expect(() =>
    runInputGuard(
      root,
      `checkPush(${JSON.stringify(good + `refs/heads/other ${"1".repeat(40)} refs/heads/other ${zero}\n`)})`,
    ),
  ).toThrow(/is not checkout HEAD/);
  expect(() => runInputGuard(root, `checkPush('malformed')`)).toThrow(
    /Invalid Git pre-push input/,
  );
});

test("baseline inventory rejects missing and extra paths", () => {
  const names = states.map(({ name }) => `${name}.png`);
  expect(() => verifyBaselines(names)).not.toThrow();
  expect(() => verifyBaselines(names.slice(1))).toThrow(`Missing: ${names[0]}`);
  expect(() => verifyBaselines([...names, "obsolete.png"])).toThrow(
    "extra: obsolete.png",
  );
});

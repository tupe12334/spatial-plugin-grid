import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { URL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

test("real pre-push input accepts only tags and branches targeting checkout HEAD", () => {
  const dir = mkdtempSync(join(tmpdir(), "push-guard-"));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  try {
    git("init", "-q", "-b", "main");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    git("commit", "--allow-empty", "-qm", "chore: initial");
    const old = git("rev-parse", "HEAD");
    git("commit", "--allow-empty", "-qm", "chore: current");
    const head = git("rev-parse", "HEAD");
    const runner = join(dir, "guard.mjs");
    writeFileSync(
      runner,
      `import { checkPush } from ${JSON.stringify(new URL("./input-guard.mjs", import.meta.url).href)}; import { readFileSync } from "node:fs"; checkPush(readFileSync(0, "utf8"));`,
    );
    writeFileSync(
      join(dir, ".git/hooks/pre-push"),
      `#!/bin/sh\nexec "${process.execPath}" "${runner}"\n`,
      { mode: 0o755 },
    );
    const bare = join(dir, "remote.git");
    git("init", "-q", "--bare", bare);
    git("remote", "add", "origin", bare);
    for (const annotated of [false, true]) {
      const tag = annotated ? "annotated" : "lightweight";
      git("tag", ...(annotated ? ["-a", "-m", "fixture"] : []), tag);
      git("push", "origin", `refs/tags/${tag}`);
      assert.equal(
        git("--git-dir", bare, "rev-parse", `refs/tags/${tag}^{commit}`),
        head,
      );
    }
    git("tag", "-a", "-m", "old", "old", old);
    assert.throws(() => git("push", "origin", "refs/tags/old"));
    const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], {
      cwd: dir,
      input: "blob",
      encoding: "utf8",
    }).trim();
    git("tag", "blob", blob);
    assert.throws(() => git("push", "origin", "refs/tags/blob"));
    const annotatedSha = git("rev-parse", "refs/tags/annotated");
    for (const [ref, sha, succeeds] of [
      ["refs/heads/main", head, true],
      ["refs/heads/main", old, false],
      ["refs/heads/main", annotatedSha, false],
      ["refs/tags/unknown", "f".repeat(40), false],
      ["refs/tags/malformed", "oops", false],
      ["refs/tags/blob", blob, false],
    ]) {
      const result = spawnSync(process.execPath, [runner], {
        cwd: dir,
        input: `${ref} ${sha} ${ref} ${"0".repeat(40)}\n`,
        encoding: "utf8",
      });
      assert.equal(
        result.status === 0,
        succeeds,
        `${ref} ${sha}: ${result.stderr}`,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import { execFileSync } from "node:child_process";
import { guard as baselineGuard } from "./baseline-guard.mjs";

export function head() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
}

export function checkPush(input, expectedHead = head()) {
  for (const line of input.split(/\r?\n/).filter(Boolean)) {
    const fields = line.trim().split(/\s+/);
    if (
      fields.length !== 4 ||
      !fields[1].match(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/)
    )
      throw new Error("Invalid Git pre-push input; expected ref/SHA pairs.");
    const [ref, sha] = fields;
    if (/^0+$/.test(sha)) continue; // Deletions have no source to validate.
    let commit = sha;
    if (ref.startsWith("refs/tags/")) {
      try {
        commit = execFileSync(
          "git",
          ["rev-parse", "--verify", `${sha}^{commit}`],
          {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
          },
        ).trim();
      } catch {
        throw new Error(
          "Pre-push guard: tag source must resolve to a known commit.",
        );
      }
    }
    if (commit !== expectedHead)
      throw new Error(
        `Pre-push guard: ${ref} (${sha}) is not checkout HEAD (${expectedHead}). Check out the commit you intend to push, commit or stash validation inputs, then push HEAD. Push other commits separately from their own checkout.`,
      );
  }
}

export function guard(expectedHead = head()) {
  if (head() !== expectedHead)
    throw new Error(
      "Validation HEAD changed during the suite; rerun validation.",
    );
  baselineGuard();
  // Fail closed for all inputs, including newly introduced root configuration.
  // Only documentation outside the source/test/config trees is exempt.
  const output = execFileSync(
    "git",
    [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
      "--",
      ".",
      ...["md", "txt", "png", "jpg", "svg", "log", "pdf"].map(
        (extension) => `:(top,glob,exclude)docs/**/*.${extension}`,
      ),
      ":(top,glob,exclude)*.md",
      ":(top,exclude)LICENSE",
    ],
    { encoding: "utf8" },
  );
  if (output)
    throw new Error(
      "Validation input guard: commit or stash staged, unstaged, deleted and untracked source, tests, configuration, package, hook and build inputs before validation. Unrelated docs may remain dirty.\n" +
        output.replaceAll("\0", "\n"),
    );
  console.log(`Validation inputs: clean at ${expectedHead}`);
}

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export function guard(cwd = process.cwd(), env = process.env) {
  const output = execFileSync(
    "git",
    [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
      "--",
      "tests/visual/baselines",
    ],
    { cwd, env, encoding: "utf8" },
  );
  if (output)
    throw new Error(
      "Baseline guard: commit reviewed baseline changes (including staged, deleted and untracked files) before validation. Use pnpm test:visual:update only intentionally.\n" +
        output.replaceAll("\0", "\n"),
    );
  console.log("Baseline guard: committed and clean");
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  guard();

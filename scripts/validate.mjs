import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { guard, head } from "./input-guard.mjs";
export function validate(expectedHead = head()) {
  guard(expectedHead);
  if (process.versions.node.split(".")[0] !== "24")
    throw new Error("Validation requires Node 24 and pnpm 9.15.9.");
  const version = spawnSync("pnpm", ["--version"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (version.status !== 0 || version.stdout.trim() !== "9.15.9")
    throw new Error("Validation requires pnpm 9.15.9.");
  try {
    for (const script of [
      "lint",
      "typecheck",
      "test:types",
      "test",
      "build",
      "test:pack",
      "build-storybook",
      "test:browsers",
    ]) {
      console.log(`\nValidation gate: ${script}`);
      const result = spawnSync("pnpm", [script], {
        stdio: "inherit",
        shell: process.platform === "win32",
      });
      if (result.error || result.status !== 0)
        throw new Error(`${script} failed: ${result.error || result.status}`);
    }
  } finally {
    guard(expectedHead);
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  validate();

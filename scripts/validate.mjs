import { spawnSync } from "node:child_process";
import { guard } from "./baseline-guard.mjs";
guard();
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
  guard();
}

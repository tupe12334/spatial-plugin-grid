import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const mode = process.argv[2];
if (!["visual", "update", "all"].includes(mode) || process.argv.length !== 3)
  throw new Error(
    "Use pnpm test:visual, test:visual:update or test:browsers (no extra arguments).",
  );
if (
  JSON.parse(readFileSync("package.json", "utf8")).devDependencies[
    "@playwright/test"
  ] !== "1.63.0"
)
  throw new Error(
    "Update the canonical Docker image and exact Playwright dependency together.",
  );
const image =
  "mcr.microsoft.com/playwright:v1.63.0-noble@sha256:bc6ab0d6d44ff4826e4cb8c1e6d801e185bfc42bb0753f8e2a30efc70db054c7";
const run = (args) => {
  const result = spawnSync("docker", args, { stdio: "inherit" });
  if (result.error || result.status !== 0)
    throw new Error(
      "Docker browser validation failed. Start Docker with Linux containers, enable linux/amd64 emulation on ARM, allow workspace file sharing and access to MCR/npm. No host screenshot fallback. " +
        (result.error || result.status),
    );
};
run(["info", "--format", "{{.ServerVersion}}"]);
for (const path of [
  "tests/visual/baselines",
  "test-results",
  "playwright-report",
])
  mkdirSync(path, { recursive: true });
// Copy only test inputs; never mount host node_modules into Linux. No host ports published.
const uid = process.platform === "win32" ? 1000 : process.getuid();
const gid = process.platform === "win32" ? 1000 : process.getgid();
const command = `set -eu
mkdir -p /work
cp /source/package.json /source/pnpm-lock.yaml /source/playwright*.ts /work/
tar -C /source --exclude=tests/visual/baselines -cf - tests src storybook-static | tar -C /work -xf -
cd /work
npm install --global pnpm@9.15.9
pnpm install --frozen-lockfile --ignore-scripts
# Change only private container files, never chown the host bind mounts.
find /work -xdev \\( -path /work/tests/visual/baselines -o -path /work/test-results -o -path /work/playwright-report \\) -prune -o -exec chown ${uid}:${gid} {} +
mkdir -p /tmp/browser-home
chown ${uid}:${gid} /tmp/browser-home
export HOME=/tmp/browser-home
export SPG_CANONICAL_VISUAL=1
export SPG_UPDATE_BASELINES=${mode === "update" ? "1" : "0"}
exec setpriv --reuid=${uid} --regid=${gid} --clear-groups bash -ec '
 echo "Browser writer UID:GID=$(id -u):$(id -g)"
 test -w /work && test -w /work/test-results && test -w /work/playwright-report
${mode === "all" ? "pnpm exec playwright test --config playwright.config.ts\n" : ""}pnpm exec playwright test --config playwright.visual.config.ts
'
`;
run([
  "run",
  "--rm",
  "--init",
  "--platform",
  "linux/amd64",
  "--shm-size=1g",
  "-e",
  "CI=1",
  "-e",
  "TZ=UTC",
  "-e",
  "LANG=C.UTF-8",
  "-e",
  "SPG_TEST_PORT=16166",
  "--mount",
  `type=bind,source=${resolve(".")},target=/source,readonly`,
  "--mount",
  `type=bind,source=${resolve("tests/visual/baselines")},target=/work/tests/visual/baselines${mode === "update" ? "" : ",readonly"}`,
  "--mount",
  `type=bind,source=${resolve("test-results")},target=/work/test-results`,
  "--mount",
  `type=bind,source=${resolve("playwright-report")},target=/work/playwright-report`,
  image,
  "bash",
  "-c",
  command,
]);

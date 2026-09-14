# Local validation and screenshot review

Use Node 24, pnpm 9.15.9 and Docker with Linux containers. A fresh
`pnpm install --frozen-lockfile` installs Husky through `prepare` and sets
`core.hooksPath=.husky/_`. Every normal `git push` forwards Git’s ref/SHA input to `scripts/pre-push.mjs`.
Every non-deletion pushed SHA must equal checkout HEAD; check out other commits
and push them separately. Do not bypass hooks. Manual `pnpm validate` needs no stdin.

`pnpm validate` guards HEAD and clean source, configuration, tests, packages,
hooks, build inputs and committed baselines first, then runs lint, typecheck,
unit tests, library build, React 18/19 packed-consumer smoke, one Storybook
build, the full 20-test functional E2E suite and screenshot comparisons, then guards
these inputs again even if a gate fails. Dirty unrelated documentation is allowed.
No command calls the hook recursively. CI uses exactly this entry point; repository Actions permissions are managed
separately. Local validation does not imply a remote CI result.

Browser commands consume an already-built `storybook-static`:

- `pnpm build-storybook`: build after source/story changes.
- `pnpm test:browsers`: functional E2E plus screenshot check in Docker.
- `pnpm test:visual`: screenshot check only in Docker.
- `pnpm test:visual:update`: explicitly create/update baseline PNGs.
- `pnpm test:baseline-guard`: fast Git cleanliness check.
- `pnpm test:e2e`: optional host functional tests; `SPG_TEST_PORT` defaults
  to 16166, with strict port ownership and no server reuse.

The Docker runner pins official Playwright 1.63.0 Noble **linux/amd64** by
platform manifest digest in `scripts/browser-docker.mjs`; the exact npm
Playwright version and bundled Chromium match. Docker's pinned font packages
supply the actual system-ui fonts, with no host fonts mounted. Viewport
1280×900 (narrow/RTL 390×844), DPR 1, en-US, UTC, dark color scheme,
font-render-hinting, CPU rendering with GPU/software GPU fallback disabled,
partial raster disabled, one raster thread, one worker, zero retries and zero
differing-pixel allowance are fixed. Reduced-motion cases explicitly emulate that preference. Only screenshot
tests disable animations/transitions/carets; functional motion assertions remain
unchanged. Screenshot navigation loads the actual declared Storybook fonts before importing
the entry module, then waits for the stage and five unchanged animation frames
of transcript geometry, scroll positions, transforms and opacity. It does not
replace fonts or rewrite product layout. Playwright also waits for stable
consecutive screenshots.

The screenshot color threshold is **0.003**, with `maxDiffPixels: 0`.
Playwright's pixelmatch comparator uses normalized YIQ color distance (0–1),
not a percentage of pixels or an RGB channel allowance. Its squared cutoff is
`35215 * threshold²`; pixels above it that pixelmatch counts as different still
fail the comparison. Pixelmatch's existing antialias handling is unchanged.
Native amd64 CI failed 30 of 40 states at threshold 0, with 1–10 counted pixels
per state. Across every pixel in all 30 captured actual/expected PNG pairs,
the maximum normalized distance was 0.0027740013094393837. The 0.003 cutoff
accepts those demonstrated raster rounding differences; no masks, retries,
baseline regeneration or renderer flags were added. A direct installed-Playwright
comparator regression accepts the measured worst color pair and rejects a single
high-contrast pixel. See [threshold evidence](evidence/pre-push/README.md).

Check mode uses Playwright's `updateSnapshots: "none"` (never update), verifies
the exact PNG inventory and mounts baselines read-only. There is no automatic
host fallback. The explicit update command mounts only baselines writable;
inspect diffs and commit reviewed PNGs before running the full validation/hook.
Delete obsolete PNGs intentionally when removing registry entries.

The registry checks all exported stories against the built Storybook index,
requires one unique default image per story and rejects filename collisions.
Additional states cover plugin size/group geometry and inert occlusion, expanded
united and standalone stages, live theme, counter and transcript interactions.
Narrow and RTL assert four columns before capture. Existing diagnostic PNGs
under `test-results` are not baselines.

Dependencies install as root inside the container, then `setpriv` drops to the
host UID/GID for browser execution and artifact writes (1000:1000 on Windows
with Docker Desktop file sharing). Only private container files are chowned;
host paths are never made world-writable.

Docker publishes no host ports; its fresh server uses internal 16166. Neither
stale host 16066 nor user preview 16067 is touched. On ARM enable amd64
emulation in Docker Desktop; on Windows use Linux containers and workspace
file sharing. Docker/MCR/npm access is required, including initial image pull
and isolated dependency installs. Failures are actionable errors, never skips.
Host Node runs the nonbrowser gates; container Node is supplied by the pinned
image. This tests one canonical Chromium/Linux renderer, not Safari/Firefox or
native host rendering. No paid services or publishing are involved.

On failure inspect `test-results/visual` (actual/diff/trace) and
`playwright-report/visual`; functional artifacts use `test-results` and
`playwright-report`. The delivery evidence is in `docs/evidence/pre-push`.

Upstream setup references: [Playwright Docker](https://playwright.dev/docs/docker)
and [Husky install lifecycle](https://typicode.github.io/husky/get-started.html).

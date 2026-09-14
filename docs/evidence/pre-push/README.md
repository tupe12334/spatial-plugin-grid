# Pre-push validation evidence — 2026-09-14

Local pre-commit proofs, with Node 24.11.0, pnpm 9.15.9 and the pinned
Playwright 1.63.0 Noble linux/amd64 image. Browser runs used Docker Desktop
on macOS with amd64 emulation; the browser writer reported UID:GID 501:20.

- Two consecutive full screenshot checks: **40/40 passed each**, zero pixel
  tolerance, zero retries, updates disabled and baseline mount read-only.
  All 40 baseline SHA-256 hashes were identical before and after both checks.
- Mismatch negative: replaced the reference-workspace baseline with the light
  baseline. **1 failed, 39 passed**, with 1,125,761 differing pixels; exit 1.
- Missing negative: removed the reference-workspace baseline. Inventory check
  rejected it by filename, exit 1, and did not recreate the missing PNG.
- Both negatives restored the complete original SHA-256 inventory exactly.
- 26 guard/inventory tests and four runner tests passed independently. These
  include **13 actual Git push rejections** through installed Husky hooks into
  isolated bare repositories, with empty receiver refs verified. Cases cover
  staged/unstaged/untracked/deleted baselines, source changes, configuration,
  hooks, source under docs and an older pushed commit. Every inherited `GIT_*`
  variable is removed from isolated test environments. Runner tests verify
  the before/after guard, including failed gates and post-suite mutations.
- Native Linux filesystem ownership probe: real Chromium screenshot and HTML
  report files were owned by **12345:12345** after root dependency installation
  and `setpriv`, with no host ownership or permission changes.

The reproduced tiny mismatch was at composer border pixels (340,859–860),
not text. The harness now loads actual declared Storybook fonts before mounting,
waits for stable transcript layout/scroll/styles, disables partial raster and
GPU/software GPU fallback, and uses one raster thread. This combined setup
produced the two clean checks above; individual flag causality was not isolated.
Fifteen reviewed baselines changed by 1–55 pixels at curved edges. Product code,
fonts, screenshot thresholds and the 14 functional E2E tests are unchanged.
A mount-readiness timeout during the diagnostic update led to a 15-second
readiness limit; subsequent full checks passed without retries.

Representative images: [counter state](../../../tests/visual/baselines/counter-clicked.png),
[appended transcript](../../../tests/visual/baselines/transcript-appended.png),
and [deliberate mismatch diff](negative-mismatch-diff.png).

The installed `.husky/_/pre-push` hook is invoked after committing, with actual
HEAD in Git-format ref/SHA stdin, so the delivery response can report the exact
validated commit and full gate result. It runs lint, typecheck, unit tests,
build, React 18/19 packed-consumer smoke, one Storybook build, 14 functional
E2E tests and 40 strict screenshot states, then checks HEAD and inputs again.
Delivery uses a normal hook-protected Git push and a reviewed pull request.
This change does not modify repository Actions permissions; they were initially
disabled and enabled separately during concurrent Pages setup.

Raw local diagnostic logs and reproduction scripts are ephemeral and are not
required to run the checks. Reproduce the positive comparison with two consecutive
`pnpm test:visual` runs; run `pnpm test` for isolated push-guard regressions and
`pnpm validate` for the full gate. For negative screenshot proof, back up a PNG,
replace it with a different state (then remove it), require `pnpm test:visual`
to fail in each case, and restore the exact original bytes before validation.
Windows Docker Desktop and a native Linux host were not exercised end-to-end;
the native Linux ownership probe covers the file-writer privilege boundary.

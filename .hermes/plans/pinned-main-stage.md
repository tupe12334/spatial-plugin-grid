# Pinned-expanded main stage

Scope: focused current-preset enhancement from origin/main 8af1730. Preserve the canonical docs/plugin-agnostic-contract-plan branch and its unrelated generic-layout plan; do not implement that architecture.

1. Add failing standalone and grid interaction tests for locking expanded stage over 22–23. Exercise wheel/touch/keyboard/Escape/Collapse/render-context collapse attempts, pending downward intent across lock/unlock, callbacks, covered occupied cells, overlapping neighbor expansion, focus/inert and unlock-then-collapse restoration.
2. Introduce coherent typed lock state/control at grid boundary and standalone MainStage semantics; lock implies expanded. Centralize collapse guard, clear pending downward intent across lock transitions. Add accessible icon toggle next to Collapse, pressed state, focus styling, tooltip and disabled/aria-disabled collapse explanation. Unlock leaves expanded and requires fresh normal intent or explicit collapse.
3. While pinned, keep stage topmost over intersecting panels regardless of subsequent expansion; covered panels remain inert, coordinates do not reflow. Preserve existing latest-expansion behavior when unpinned and animated collapse coverage.
4. Document API and behavior, add standalone/integrated stories and native browser regressions. Register intentional screenshots and update using pinned Linux/amd64 Docker only; inspect changed images and commit baselines.
5. Run lint/typecheck/unit/build/packed consumer/Storybook/browser/visual/baseline guards through pnpm validate and installed prepush without bypasses. Obtain independent review, fix findings and rerun invalidated gates. Push focused PR, verify CI and merge current main, read back remote merge SHA.
6. Preserve canonical branch. Serve a clean merged isolated worktree on localhost:6006 after verifying the existing listener belongs to this project; confirm HTTP and real isolated-browser lock interaction. Report PR, exact checks, files, SHA and server worktree/process.

## Delivery boundary confirmed by user

Implement and validate in `feat/pinned-main-stage`, then stop at a pushed PR against `main` ready for independent Hermes review. Hermes owns the review, merge, remote merge verification and port 6006 preview. Do not touch the existing server or canonical worktree. This supersedes the merge/preview actions in steps 5–6 above.

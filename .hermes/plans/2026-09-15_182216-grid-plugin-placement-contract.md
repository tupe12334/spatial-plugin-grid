# Plugin-Agnostic Layout Contract Implementation Plan

> **For Hermes:** Implement task-by-task after approval, with delegated coding and independent spec/code review. This document is planning only.

**Goal:** Introduce a plugin-agnostic, type-safe layout contract for every plugin: named states, per-state footprints, anchoring, allowed transitions and compatible placement. Migrate the agent as one consumer of this contract, not its organizing special case.

**Architecture:** Separate grid topology, plugin-declared state footprints/transition policy, and host placement. A generic layout engine derives rectangles from an explicitly declared anchor alignment and validates every supported state, without knowing plugin identity, content, or state-name meaning. The main-stage 2×1-to-2×2 behavior is one example, not a universal rule.

**Tech Stack:** Existing React 18/19, strict TypeScript 5.7, Vite, Storybook, Vitest, Playwright, scoped semantic CSS variables and pre-push visual validation.

---

## Primary scope: a contract update for ALL plugins

The user explicitly requires a plugin-agnostic contract update, not a main-stage-only enhancement.

- State names are arbitrary literal keys: `compact`/`detail`, `collapsed`/`expanded`, `summary`/`full`, or a single `default` state. Core must not branch on those names.
- Each plugin declares its supported state footprints and transitions. A single-state plugin is valid; not every plugin expands, and not every plugin uses two/four cells.
- Anchor alignment is explicit generic data: top-left, top-right, bottom-left or bottom-right. The host supplies its coordinate. Bounds must be checked for every rectangle produced by that contract.
- Expansion capacity is derived from all declared states, not assumed to be 2×2. Current occupancy is the current state's rectangle; possible future occupancy is not permanently reserved.
- Triggers belong to plugin content: a chart button, inspector action or agent scroll may all call the same typed state-transition API. Core never interprets wheel events as agent behavior.
- Main-stage styling is orthogonal to placement. It must not change allowed anchors, minimum dimensions, focus privileges or occupancy rules.
- Generic type/runtime tests and at least two non-agent examples must pass before the agent adapter is introduced. Extraction of AgentPlugin is an integration task after the contract works independently.

## Main-stage example of the generic contract — supersedes the earlier interpretation

The user clarified: **“the main stage is a 4 blocks because it can be extended, but the collapsed view is only the bottom two.”**

- Do not interpret the agent as permanently occupying a six-cell 3×2 rectangle.
- Do not declare a global two-row minimum and then introduce an exception for collapse.
- Model separate state footprints: collapsed = 2 columns × 1 row; expanded = 2 columns × 2 rows, anchored to the same bottom edge.
- Two rows are required for the expansion envelope, not the collapsed visible footprint.
- A vertical pair such as 24+34 is a column within an expanded stage, not sufficient on its own for the four-cell main stage.
- All six listed horizontal pairs can serve as collapsed positions when the immediately preceding row supplies the upper pair. This follows the latest clarification and replaces the earlier assumed lower-region-only restriction.

### Placement table for the bottom-left-anchored 2×1 / 2×2 example

| Collapsed bottom pair | Expanded envelope |
| --- | --- |
| 21,22 | 11,12 / 21,22 |
| 22,23 | 12,13 / 22,23 |
| 23,24 | 13,14 / 23,24 |
| 31,32 | 21,22 / 31,32 |
| 32,33 | 22,23 / 32,33 |
| 33,34 | 23,24 / 33,34 |

Top-row collapsed pairs 11+12, 12+13, 13+14 are invalid: expansion upward would leave the grid. Top-row cells may nevertheless be covered by an agent anchored on row 2. A collapsed pair may not start in column 4 because its second column would lie outside the grid. No row wrapping, diagonal pairing or vertical collapsed pair.

The agent therefore has valid bottom-left anchors 21,22,23,31,32,33. Prefer explicit `{row, column}` coordinates in the implementation, with labels retained for UX/documentation.

## Inspected current code

Repository: `/Users/ofek/dev/git/github/tupe12334/spatial-plugin-grid`; inspected `main` at `8af1730` when drafting. Reinspect before execution because other work may land.

- `src/layout.ts` omits 32/33 from plugin homes, embeds old left/right groups, and requires every plugin to allow 1x1.
- `src/SpatialPluginGrid.tsx` imports MainStage, automatically mounts it, and maintains special stage state, layers and rectangles.
- `src/MainStage.tsx` contains tested transcript scrolling, append following and native event-order handling. Preserve this behavior during extraction.
- `src/index.ts` exports MainStage presentation but not a common-interface agent plugin.
- `LayoutPreset` currently only contains spacing/navbar settings.
- Existing regression suites live in `tests/layout.test.ts`, `tests/interaction.test.tsx`, `tests/browser/workspace.spec.ts`, `tests/visual/registry.ts` and `tests/visual/screenshots.spec.ts`.
- `pnpm validate` and Husky require committed inputs/baselines and run the full validation suite. Never bypass these gates.

## Proposed generic API (illustrative, not existing exports)

```tsx
const inspector = definePlugin({
  id: 'inspector',
  title: 'Inspector',
  layout: {
    anchor: 'bottom-left',
    states: {
      compact: { rows: 1, columns: 2 },
      detail: { rows: 2, columns: 2 },
    },
    transitions: { compact: ['detail'], detail: ['compact'] },
  },
  render: ({ state, transitionTo }) => (
    <Inspector mode={state} onOpen={() => transitionTo('detail')} />
  ),
});

const workspace = defineWorkspace(grid).place(inspector, {
  anchor: { row: 3, column: 3 },
  initialState: 'compact',
});
```

This deliberately uses a non-agent plugin and non-agent state names. `Inspector` is host UI; helper APIs are proposed, not implemented. State callbacks reject undeclared targets; disallowed transition edges are validated against current state. Runtime errors still protect callers whose current state is not statically narrowed. Terminal/single-state definitions are supported.

### Agent adapter usage (secondary example)

```tsx
const grid = defineGrid({ rows: [1, 2, 3], columns: [1, 2, 3, 4] });

const agent = createAgentPlugin({
  id: 'assistant',
  transcript,
  composer,
});

const workspace = defineWorkspace(grid).place(agent, {
  anchor: { row: 3, column: 3 },
  initialState: 'collapsed',
  appearance: 'main-stage',
});

// Collapsed: 33,34. Expanded: 23,24,33,34.
<SpatialPluginGrid workspace={workspace} />;
```

A custom plugin declares an equivalent reusable footprint contract rather than receiving agent-only privileges:

```ts
const footprints = {
  collapsed: { rows: 1, columns: 2 },
  expanded: { rows: 2, columns: 2 },
};
// Its placement policy is bottom-left anchored, extending upward/right.
```

Exact helper names can change while proving inference; public guarantees cannot. Use const generics/literal inference and constrain placement from an already-inferred plugin definition. Do not allow TypeScript to widen the grid or plugin requirements merely to accept an invalid anchor.

## Ownership boundaries

### Generic grid

- All twelve cells available; no reserved 32/33, automatic agent, fake content or hardcoded main-stage rectangles.
- Own validated placement, collision/overlay policy, layering, focus/inert behavior, geometry transitions and cleanup.
- Do not import AgentPlugin/MainStage from core grid rendering.
- Empty grid stays empty unless the consumer registers plugins. Demonstration placeholders belong in Storybook.
- Keep old ordinary-plugin expansion groups as optional explicit preset data, not universal grid constraints. Agent placement may cross those old group boundaries.

### Plugin definition

- Identity/title/content interface and named legal states with row/column footprints.
- State requirements describe the space occupied in each state; optional hard minima apply to every state only when genuinely required by that plugin.
- The agent defines collapsed 1-row/2-column and expanded 2-row/2-column footprints, with bottom anchoring.
- Use generic named transitions (for example `transitionTo('detail')`) rather than arbitrary loosely typed width/height mutation. The agent adapter maps its own expanded boolean to its declared state names.
- A custom plugin can declare different states; core does not branch on plugin ID/type being agent.

### Host placement

- Consumer chooses a compatible anchor and initial state; optional regions can further restrict placement.
- Validate ALL supported states before mounting, even when initial state is collapsed. A position that fits collapsed but cannot expand must fail immediately.
- Derive expanded/collapsed rectangles from a single anchor and state contract. Do not expose independently supplied rectangles that can disagree.
- Controls, callbacks, runtime state and geometry must share the same legal-state set.
- Validate ordinary initial occupancy conflicts. Expansion envelope overlap is allowed by policy because expansion overlays neighbors; it does not permanently reserve all four cells while collapsed.
- When collapsed, the upper two cells may contain other plugins. Expansion covers them; collapse reveals them again without moving/remounting them.

### Agent and main-stage appearance

- Export AgentPlugin/factory through the common registration API.
- Preserve MainStage as optional presentation export if useful, not a second special grid integration path.
- Main-stage emphasis is a shared appearance option that can also style a non-agent plugin.
- Keep one united surface, pinned composer, depth transcript and smooth upward expansion/downward collapse.
- Preserve newest behavior: downward native navigation collapses only upon reaching bottom, not on every downward wheel event. Do not reintroduce earlier scroll bugs.
- Keep explicit toggle, Escape, keyboard/touch equivalents, reduced-motion handling and proper cleanup.

## Static and runtime safety

Compile-time acceptance/rejection must cover:

1. Each of the six valid anchors in the table compiles.
2. Any anchor on row 1 rejects for the agent (insufficient upward expansion space).
3. Column-4 anchors reject (insufficient horizontal space).
4. Out-of-bounds rows/columns and unknown states reject.
5. A vertical 24+34 pair cannot masquerade as this plugin's collapsed footprint.
6. An expanded-only initial state must use the exact same valid anchor set.
7. A simple 1×1 plugin can occupy row 1/column 4, proving restrictions belong to footprints rather than globally banned cells.
8. Narrowed host regions reject otherwise valid anchors if any supported state leaves the region.
9. Requirements survive heterogeneous plugin collections and callback inference; avoid broad `PluginDefinition[]` types that erase them.

Use finite tuple types and bounded unions for legal anchors. Avoid an arbitrary-size arithmetic DSL. Runtime validation must enforce the same rules for dynamic data, JS consumers and unsafe external input. Errors identify plugin, state, anchor, required footprint and violated boundary. No silent relocation/clamping or fallback to a smaller size.

General minimum-dimension support remains valid for other plugins: a plugin declaring a hard two-row minimum cannot contain a one-row state. The agent instead declares different state footprints, avoiding that contradiction.

## Implementation tasks

### 1. Prove the type contract first

**Files:** Create `tests/types/placement.test-d.ts`, `tsconfig.type-tests.json`; modify `package.json` with `test:types`.

- Add passing fixtures for all six anchors and failing fixtures for top row, last column, unknown states, region violations and type widening.
- Verify fixtures fail before implementation and pass after introducing the type helpers.
- Use compiler negative-test annotations only in dedicated fixtures; no production casts or diagnostic suppression to force acceptance.
- Ensure the negative tests fail if the constraint is removed; prove consumer autocomplete and literal inference under TS 5.7.

### 2. Extract topology, footprint and anchor geometry

**Files:** Create `src/grid/types.ts`, `src/grid/defineGrid.ts`, `src/grid/placement.ts`, `tests/grid-placement.test.ts`; migrate generic ownership from `src/layout.ts`.

- Write failing tests enumerating every rectangle and occupied-cell set in the table.
- Implement all four declared anchor alignments as generic geometry. For bottom-left specifically, top row is anchor row minus state height plus one and left column is anchor column. Test top/right/bottom boundaries for each alignment; do not globally impose upward expansion.
- Validate bounds, contiguous region containment, positive dimensions and duplicate IDs/initial occupancy.
- Introduce one shared pure validator; use established schema tooling if parsing untyped configuration needs it, and retain custom math only for domain geometry.
- Run `pnpm test:types`, `pnpm typecheck`, `pnpm exec vitest run tests/grid-placement.test.ts`.

### 3. Build typed plugin/instance registration

**Files:** Create `src/plugins/types.ts`, `src/plugins/definePlugin.ts`, `src/grid/defineWorkspace.ts`, `tests/plugin-registration.test.ts`.

- Write failing tests for definitions preserving arbitrary named states, declared transition edges and state footprint constraints through registration. Cover a one-state 1×1 status plugin, a top-left compact/detail chart expanding right/down, and a bottom-left inspector expanding up/right before adding any agent fixture.
- Separate content/requirements from host anchor/appearance/initial state.
- Validate every reachable state at registration, not only the initial state.
- Define `reset()` as return to validated initial state, not unconditional 1x1; type resize/state callbacks to the plugin's declared states.
- Add runtime rejection tests using genuinely untyped data, alongside compile-time fixtures.

### 4. Remove the agent special case from grid core

**Files:** Modify `src/SpatialPluginGrid.tsx`, `src/styles.css`, `tests/layout.test.ts`; create `src/grid/PluginFrame.tsx` as needed.

- Add a failing test proving an empty/default grid does not render an agent.
- Remove MainStage import, stageRect constants, reserved-cell filtering and separate stage state/layer ownership.
- Render all registered plugins through one generic frame and geometry/state path.
- Retain overlay order, partial occlusion/inert behavior, focus recovery, transitions, no page scrolling and theme inheritance.
- Ensure upper-envelope occupants are not removed while agent is collapsed and are restored without reflow after collapse.

### 5. Export AgentPlugin and migrate presentation

**Files:** Create `src/plugins/agent/AgentPlugin.tsx`, `src/plugins/agent/createAgentPlugin.ts`; modify `src/MainStage.tsx`, `src/index.ts`, `src/styles.css`.

- Adapt existing transcript/composer component to the common plugin state context.
- Request collapsed/expanded transitions through the common API; no agent-specific exceptions in grid core.
- Preserve existing native wheel/touch/keyboard behavior, first older-navigation behavior, append-follow intent, scrollend ordering, reduced motion and cleanup.
- Verify the same component works at all six anchors, with a fixed composer bottom edge during animation.
- Remove the obsolete `SpatialPluginGrid.mainStage` special prop as part of the explicit API migration; do not retain two competing core models.

### 6. Migrate exports, preset and documentation

**Files:** Create `src/presets/agentWorkspace.ts`, `docs/plugin-placement.md`; modify `src/index.ts`, `README.md`, `scripts/pack-consumer.mjs`.

- Make generic grid the default and earlier workspace composition an opt-in preset.
- Document the table, bottom-left anchor semantics and distinction between expansion capacity and collapsed occupancy.
- Include complete no-agent, custom plugin and agent-at-33+34 examples.
- Migrate all in-repo consumers in one coherent change. Discover actual external consumers before changing their repositories.
- Propose pre-1.0 breaking release 0.2.0 with migration notes; no npm publication/tag creation as part of planning.
- Verify package exports/declarations and examples through packed React 18/19 consumers.

### 7. Storybook, browser and screenshot coverage

**Files:** Modify `stories/Workspace.stories.tsx`, `stories/MainStage.stories.tsx`; create `stories/AgentPlugin.stories.tsx`, `stories/PluginPlacement.stories.tsx`; update `tests/browser/workspace.spec.ts`, `tests/visual/registry.ts`, `tests/visual/screenshots.spec.ts` and baselines.

- Show generic empty/no-agent grid with all cells available.
- Add each of the six anchors in collapsed and expanded states; assert coordinates, not screenshots alone.
- Show another plugin in the upper pair while the agent is collapsed, covered while expanded and unchanged after collapse.
- Show non-agent plugins with different state names, footprints, directions and transition triggers: fixed 1×1 status, right/down-growing chart, and up-growing inspector. Prove that identical contracts produce identical legal placements regardless of plugin identity or appearance.
- Preserve light/dark, narrow/RTL, reduced motion, empty/populated transcript and dynamic content cases.
- Keep existing scrolling/following/event-order regressions; adapt integration fixtures instead of deleting them.
- Add invalid dynamic placement error story; compile-time errors remain in type fixtures/docs.
- Keep unique story/state baseline mapping and canonical pinned renderer. Review intentional PNG changes before committing.

### 8. Full verification and delivery (only after approval)

**Files:** Modify `scripts/validate.mjs`, `tests/validate-runner.test.ts` to include `test:types`; adjust release/package tests as needed.

1. Run focused tests first; retain explicit TDD failures before implementation.
2. Run `pnpm lint`, `pnpm typecheck`, `pnpm test:types`, `pnpm test`, `pnpm test:release`, `pnpm build`, `pnpm test:pack`.
3. Run `pnpm build-storybook && pnpm test:visual:update` for intended baseline updates, inspect outputs, and commit all source and baselines.
4. Run `pnpm validate` on committed input, then actual hook-protected push; no bypass or implicit baseline acceptance.
5. Open focused PR, resolve current-base/CI failures, review API and visuals, merge and sync canonical main.

## Acceptance criteria

- Default grid contains no implicit agent and all cells are available.
- Every plugin uses the same public contract; core has no agent/main-stage or collapsed/expanded state-name branches. Agent is an exported ordinary consumer, not the foundation of the contract.
- All six collapsed pairs expand to the matching four-cell envelopes in the table.
- Invalid anchors are rejected from each plugin’s declared geometry, not its identity. Top-row anchors are forbidden for the bottom-left 2×1/2×2 example but allowed for compatible top-left or single-cell contracts.
- Static literal mistakes produce TypeScript errors; dynamic mistakes produce actionable runtime errors.
- Common plugin API prevents invalid state transitions and preserves minimum requirements where declared.
- Expansion overlays, never reflows; upper-pair plugins return intact on collapse.
- Main stage remains one united panel, with smooth movement and pinned composer at every legal anchor.
- Existing interaction behavior, theme independence, type tests, screenshots, package-consumer checks and pre-push/CI all pass.

## Risks and scope limits

- A four-cell expansion envelope does not permanently reserve all four cells. Conflating capacity with current occupancy would hide usable plugins when collapsed.
- Bottom-left anchors replace old inward/home semantics only in the new common contract; preserve older group behavior as explicit preset state geometry where needed.
- Finite literal inference can be lost through arrays/unions; test it before rendering changes.
- This is a breaking API migration, not an additive second grid engine. Migrate exports/examples together.
- No drag-and-drop designer, backend, storage, arbitrary remote plugin execution or infinite-grid solver is required.

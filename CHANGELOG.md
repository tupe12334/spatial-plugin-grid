# spatial-plugin-grid

## 0.3.0

### Minor Changes

- 8be7d04: Add a generic `createFourActionGridPlugin` and `FourActionGrid` export: a titleless single-cell plugin with exactly four equal, border-separated action quadrants. Hosts supply typed action IDs, labels, optional icons and handlers.
- 463e6b5: Add a generic `createListPlugin` and `ListBlock` export so hosts and agents can mount any data collection as a validated compact/expanded list plugin without bespoke plugin code per data type.

## 0.2.1

### Patch Changes

- Add an opt-in preserve focus policy for nonmodal layout takeovers. `SpatialPluginGrid` now accepts `overlayFocus`, and `useLayoutTakeover` accepts `focus`; the default still focuses the first overlay action while `"preserve"` keeps focus in retained content unless it becomes covered.

## 0.2.0

### Minor Changes

- b52d1e4: Add opt-in drag-and-drop movement to the generic grid. Validate all plugin states, alignment, regions, per-placement permissions, occupied cells and both sides of swaps before accepting a move. Support mouse, touch, keyboard, cancellation, live target feedback and placement callbacks while retaining plugin identity.
- 9c66c4c: Replace the special-cased grid API with plugin-defined named states, footprints, transitions, four anchor alignments and all-state placement validation. The default grid is empty; register the conversation through createAgentPlugin, with any of six compatible bottom pairs. Add static region/minimum checks, Zod-backed dynamic validation, shared overlay/pinning behavior and non-agent examples.

  Breaking pre-1.0 migration: SpatialPluginGrid now takes workspace instead of plugins/mainStage. Use definePlugin and defineWorkspace, transitionTo/reset and per-placement state/pin callbacks. AgentWorkspace/GroupedPluginDefinition opt into the historical grouped preset through the same engine. Preserve conversation scrolling, reduced motion, composer anchoring and committed pin guards. See docs/plugin-placement.md.

- Add generic temporary layout regions and whole-card ActionBlock controls. Keep base registrations mounted and preserve placement, state and pinning. AgentWorkspace temporarily presents its retained stage compactly during takeover, restoring the underlying expanded/pinned state on dismissal. Host applications own data, authorization and durable lifecycle.

### Patch Changes

- d3ac23e: Highlight the full current-state footprint while moving a multi-cell plugin, with correct top/bottom and left/right anchor alignment. Pointer and keyboard previews now show every destination cell the plugin will occupy.
- 2c53289: Preserve the grabbed cell's offset from a plugin's anchor during pointer dragging. Multi-cell blocks can now preview and drop into leftmost footprints such as cells 31–32 when grabbed by their left-side handle, including expanded blocks and RTL layouts. Placement restrictions and keyboard anchor navigation remain unchanged.
- 4b5fbd3: Preserve the public bundle's React client boundary and verify it in packed React 18/19 consumers. Document embedded dashboard sizing, client-owned workspace definitions, and the generic API release prerequisite.
- c986213: Show a hovered multi-cell destination as one continuous block with an outer border only. Hide overlapping candidate outlines and the overlapping source frame while preserving content, disjoint options, placement permissions, and pointer and keyboard movement.

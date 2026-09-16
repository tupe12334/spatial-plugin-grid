# Plugin placement contract

## Three independent responsibilities

1. Grid topology: `defineGrid({ rows: [1,2,3], columns: [1,2,3,4] })`. Literal, consecutive one-based axes, bounded to eight cells per axis. The default grid contains no plugins.
2. Plugin requirements: identity, title, arbitrary named states, a row/column footprint per state, explicit directed transition edges, and an anchor alignment. A single state with no edges is valid. Optional hard minima apply to every state.
3. Host placement: one anchor coordinate, an initial state, optional containing region, appearance and callbacks. Every state must fit the grid/region at registration, even unreachable states or an expanded initial state.

State names have no built-in meaning. The core does not import conversation UI or interpret wheel/touch inputs. A `summary → detail` chart and `collapsed → expanded` agent follow the same geometry, layering, focus and pinning rules.

## Coordinates and alignments

Coordinates address physical cells, independent of text direction. For footprint `{rows:h,columns:w}` at `{row:r,column:c}`:

| Alignment | Top row | Left column |
|---|---|---|
| top-left | r | c |
| top-right | r | c-w+1 |
| bottom-left | r-h+1 | c |
| bottom-right | r-h+1 | c-w+1 |

The current rectangle is occupied. The union of possible footprints is capacity, not a permanent reservation. Initial rectangles may not overlap; expansion may overlay neighbors without moving or unmounting them. IDs must be unique. Runtime errors identify the plugin, state, anchor, required footprint and violated grid/region boundary. Malformed JS/JSON is validated with Zod; there is no clamping, relocation or smaller-state fallback.

## Non-agent example

```tsx
import { SpatialPluginGrid, defaultGrid, definePlugin, defineWorkspace } from "spatial-plugin-grid";
import "spatial-plugin-grid/styles.css";

const inspector = definePlugin({
  id: "inspector", title: "Inspector",
  layout: {
    anchor: "bottom-left",
    states: { compact: {rows:1,columns:2}, detail: {rows:2,columns:2} },
    transitions: { compact: ["detail"], detail: ["compact"] },
  },
  render: ({state,transitionTo,reset,pinned,setPinned}) => (
    <div className="spg-plugin-body">
      <p>{state}</p>
      <button onClick={() => state === "compact" ? transitionTo("detail") : reset()}>Toggle</button>
      <button onClick={() => setPinned(!pinned)}>Pin current state</button>
    </div>
  ),
});
const workspace = defineWorkspace(defaultGrid).place(inspector, {
  anchor: {row:3,column:3}, initialState: "compact",
  region: {row:2,column:3,rows:2,columns:2},
  appearance: "main-stage",
});
export const app = <SpatialPluginGrid workspace={workspace} />;
```

`state` and transition targets infer as `"compact" | "detail"`; unknown targets fail compilation. Allowed edges are checked against current runtime state, including retained callbacks and multiple requests in one batch. Same-state requests are no-ops. `reset()` explicitly returns to the host's initial state, not `1x1`, and may exit a terminal state. A pinned plugin cannot transition/reset until its unlock commits. Pinning itself never expands a plugin.

The literal `place` API rejects invalid coordinates without widening the plugin/grid to accept them. Avoid broad annotations that erase state literals; retain inferred definitions and chain heterogeneous placements. `placeDynamic` explicitly accepts runtime coordinates and performs the same all-state checks. `validatePlacement(grid, definition, unknownPlacement)` can validate JSON before mounting. Runtime validators also guard JavaScript and unsafe external inputs.

## Agent: six legal collapsed pairs

The agent's own adapter defines collapsed = one row/two columns, expanded = two rows/two columns, bottom-left aligned. It has no global two-row minimum. Only its expansion capacity requires the upper row.

| Anchor | Collapsed cells | Expanded cells |
|---|---|---|
| {row:2,column:1} | 21,22 | 11,12 / 21,22 |
| {row:2,column:2} | 22,23 | 12,13 / 22,23 |
| {row:2,column:3} | 23,24 | 13,14 / 23,24 |
| {row:3,column:1} | 31,32 | 21,22 / 31,32 |
| {row:3,column:2} | 32,33 | 22,23 / 32,33 |
| {row:3,column:3} | 33,34 | 23,24 / 33,34 |

Row 1 cannot provide upward expansion; column 4 cannot provide the second column. Vertical, diagonal and row-wrapped pairs are not this contract. These exclusions are footprint-derived, not banned cells: a one-cell status plugin may occupy any cell, including 14, 32 and 33.

```tsx
import { SpatialPluginGrid, defaultGrid, defineWorkspace, createAgentPlugin } from "spatial-plugin-grid";
const agent = createAgentPlugin({
  id: "assistant",
  transcript: [{id:"welcome",author:"Assistant",content:"Host-provided text"}],
  composer: <form onSubmit={event => event.preventDefault()}><input aria-label="Message" /></form>,
});
const workspace = defineWorkspace(defaultGrid).place(agent, {
  anchor: {row:3,column:3}, initialState: "collapsed", appearance: "main-stage",
  onStateChange: state => console.log(state),
  onPinnedChange: pinned => console.log(pinned),
});
export const app = <SpatialPluginGrid workspace={workspace} />;
```

The upper pair may contain other plugins while collapsed. Expansion makes them inert, and collapse reveals their preserved UI state. Composer anchoring, 480ms eased movement, reduced motion, transcript depth/fade, native bottom-only downward collapse, append-follow behavior and pin/unpin guards remain in the conversation adapter/presentation. The grid only consumes generic transition/pin requests. The agent expands before pinning; unlocking leaves it expanded.

## Appearance, layering and lifecycle

`appearance: "main-stage"` only selects a united visual surface. It does not alter placement, minima, capacity, transitions or focus privileges. The most recently changed noninitial state is layered above older states; pins take precedence over unpinned states. Partial occlusion makes the entire covered panel inert. Focus moves to the frontmost unobscured panel if its current panel becomes covered. During geometry animation, the old/new footprint union remains covered until the animation ends; no neighbor reflows.

The core owns ephemeral state keyed by plugin ID, not persistence. Keep ID, initial state and layout contract stable while mounted. Content/callback updates are supported. Remove a registration to drop its state; remount or use a different ID when replacing a contract. Per-ID error boundaries isolate content failures. The host owns portaled content outside the frame, data, themes, form submission and persistence.

## Migration from 0.1

- `SpatialPluginGrid.plugins` and `.mainStage` are removed. Register every plugin, including conversation, into `workspace`.
- Legacy `PluginDefinition` meant a home/size entry. The generic type is now parameterized by inferred states/alignment; prefer `definePlugin`, not a broad annotated array.
- `size`/`expanded`/`setSize`/`shrink` become named `state`/`transitionTo`/`reset`. Agent-specific booleans remain only in `MainStage` transcript/composer context.
- Expansion/lock callbacks move onto placement as `onStateChange`/`onPinnedChange`.
- `AgentWorkspace` and `GroupedPluginDefinition` explicitly opt into the old ten-home composition and grouped selectors. Those restrictions/helpers belong to the preset, not the generic grid.
- Existing semantic `--spg-*` variables and React 18/19 peer support remain. Import the CSS export and provide host colors.
- The minor Changeset proposes pre-1.0 `0.2.0`; versioning, publishing and tags remain separate approved operations.

See `tests/types/placement.test-d.ts` for compiler-negative guarantees, the runtime/browser suites for invalid dynamic input and geometry, and Storybook's PluginPlacement/AgentPlugin sections for interactive examples.

# Grid and placement

[Repository overview](../../README.md)

## Generic API (0.2 migration)

```tsx
import {
  SpatialPluginGrid,
  defaultGrid,
  definePlugin,
  defineWorkspace,
} from "spatial-plugin-grid";
import "spatial-plugin-grid/styles.css";

const chart = definePlugin({
  id: "chart",
  title: "Chart",
  layout: {
    anchor: "top-left",
    states: {
      summary: { rows: 1, columns: 1 },
      detail: { rows: 2, columns: 3 },
    },
    transitions: { summary: ["detail"], detail: ["summary"] },
  },
  render: ({ state, transitionTo, reset }) => (
    <div className="spg-plugin-body">
      <p>Chart: {state}</p>
      <button
        onClick={() => (state === "summary" ? transitionTo("detail") : reset())}
      >
        Toggle chart
      </button>
    </div>
  ),
});
const workspace = defineWorkspace(defaultGrid).place(chart, {
  anchor: { row: 1, column: 1 },
  initialState: "summary",
});
export const app = (
  <SpatialPluginGrid workspace={workspace} className="my-theme" />
);
export const empty = <SpatialPluginGrid className="my-theme" />;
```

Supply semantic colors from your [host theme](../README.md#theming). `defineGrid` accepts consecutive one-based tuples up to eight rows/columns. `definePlugin` preserves literal state names, footprints, legal transition targets and optional statewise minima. `defineWorkspace(grid).place(plugin, placement)` rejects incompatible literal anchors across ALL states. `placeDynamic` is the explicit runtime-validated boundary for dynamic coordinates. Zod-backed `validatePlacement` and `validatePlugin` accept unknown input.

`SpatialPluginGrid` accepts `workspace`, `navbar`, `navbarHeight` (64), `gap` (12), `padding` (12), `label`, `className`, `style`, `dir` and `onPluginError`. Placement supplies `anchor`, `initialState`, optional `region`, `appearance`, `animate`, `onStateChange` and `onPinnedChange`. `PluginContext` exposes inferred `state`, `transitionTo(name)`, `reset()`, `pinned` and `setPinned(boolean)`. Reset explicitly returns to the validated initial state, including from terminal states. Pinning freezes the current state; plugins choose whether to expand first. IDs and layout contracts must remain stable while mounted; remove a registration to discard its runtime state, or use a new ID/remount for a new contract.

Breaking change: `SpatialPluginGrid` no longer accepts the legacy `plugins` or `mainStage` props. Replace them with inferred definitions and a workspace. Replace `setSize`/`shrink` with `transitionTo`/`reset`; move state/pin callbacks onto placement. `createAgentPlugin` registers conversation UI through this same contract. `MainStage` remains standalone presentation. `appearance: "main-stage"` only changes styling; it grants no placement or focus privileges.

For the historical grouped layout, use the explicit `AgentWorkspace` preset and `GroupedPluginDefinition` in the [preset guide](../presets/README.md). It builds ordinary registrations, not a second engine. Its helper geometry and home restrictions are preset-specific. The generic grid never reserves cells 32/33.

See [placement rules, all six agent positions and full migration details](../../docs/plugin-placement.md). This change proposes a pre-1.0 minor release through Changesets; it does not publish or tag anything.

## Opt-in drag and drop

Pass `dragAndDrop` to `SpatialPluginGrid` to enable dedicated Move handles. The default remains disabled. Mouse and touch can drag to highlighted cells. Each destination highlights the plugin's entire current footprint, including every row and column it spans; the active destination is filled rather than highlighting only its anchor. With a focused handle, Enter/Space picks up, arrow keys cycle compatible anchors, Enter/Space drops, and Escape cancels. Other plugin controls retain their native input behavior. Physical cell coordinates do not reverse in RTL.

Movement uses the same placement contract as registration: every named state's footprint must fit the grid, alignment, and optional region at the destination. For example, a bottom-anchored main stage with a two-row expanded state cannot move to 11–14 even while collapsed. Main-stage appearance alone grants no special rules: compatible moves to other rows are allowed.

Placement options can narrow movement further:

```tsx
const workspace = defineWorkspace(defaultGrid).place(chart, {
  anchor: { row: 1, column: 1 },
  initialState: "summary",
  draggable: true, // false excludes this block from moves and swaps
  allowedAnchors: [
    { row: 1, column: 1 },
    { row: 2, column: 1 },
  ],
});
<SpatialPluginGrid
  workspace={workspace}
  dragAndDrop
  onPluginsMoved={(placements) => console.log(placements)}
/>;
```

`allowedAnchors` is optional (all geometrically compatible anchors by default), typed against all states, and runtime-validated at registration. An empty list prevents moves. Moves to empty space and atomic swaps are supported; both directions must be permitted and neither the initial nor current footprint may collide with another block. Expansion capacity may still overlap as before. Pinned, covered, or animating blocks cannot move or be swapped, and animation covers protect otherwise-empty cells beneath them. Invalid drops and cancellation never invoke the callback.

`onPluginsMoved` receives the complete `id → { row, column }` map once per accepted move, including both sides of a swap. Plugin state and mounted content stay attached to identity. Placements are local to each grid, not persisted; retain a stable workspace object across ordinary parent renders. Replacing the workspace deliberately resets all local placements to its declared anchors and cancels in-flight movement, avoiding stale permissions or collision-prone partial reconciliation. Host persistence is the caller's responsibility. The historical `AgentWorkspace` adapter is unchanged; opt into this feature through the generic `SpatialPluginGrid` API.

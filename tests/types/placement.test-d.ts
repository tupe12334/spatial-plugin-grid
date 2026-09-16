import {
  defineGrid,
  definePlugin,
  defineWorkspace,
} from "../../src/grid/contract";
import { createAgentPlugin } from "../../src/plugins/agent/createAgentPlugin";
const grid = defineGrid({ rows: [1, 2, 3], columns: [1, 2, 3, 4] });
const plugin = definePlugin({
  id: "inspector",
  title: "Inspector",
  layout: {
    anchor: "bottom-left",
    states: {
      compact: { rows: 1, columns: 2 },
      detail: { rows: 2, columns: 2 },
    },
    transitions: { compact: ["detail"], detail: ["compact"] },
  },
  render: ({ state, transitionTo }) => {
    const inferred: "compact" | "detail" = state;
    transitionTo(inferred);
    // @ts-expect-error unknown state
    transitionTo("wrong");
    return null;
  },
});
const ws = defineWorkspace(grid);
const agent = createAgentPlugin({ id: "agent" });
for (const row of [2, 3] as const)
  for (const column of [1, 2, 3] as const)
    for (const initialState of ["collapsed", "expanded"] as const)
      ws.place(agent, { anchor: { row, column }, initialState });
// @ts-expect-error agent capacity is invalid at the top, including expanded initial state
ws.place(agent, { anchor: { row: 1, column: 2 }, initialState: "expanded" });
ws.place(plugin, {
  anchor: { row: 3, column: 2 },
  initialState: "detail",
  region: { row: 2, column: 2, rows: 2, columns: 2 },
});
ws.place(plugin, {
  // @ts-expect-error region does not contain upward capacity
  anchor: { row: 3, column: 2 },
  initialState: "compact",
  region: { row: 3, column: 2, rows: 1, columns: 2 },
});
ws.place(plugin, {
  // @ts-expect-error region does not contain horizontal capacity
  anchor: { row: 3, column: 2 },
  initialState: "compact",
  region: { row: 2, column: 2, rows: 2, columns: 1 },
});
const tooSmall = definePlugin({
  id: "small",
  title: "Small",
  layout: {
    anchor: "top-left",
    minimum: { rows: 2, columns: 1 },
    // @ts-expect-error hard minimum applies to EVERY state
    states: { compact: { rows: 1, columns: 1 } },
    transitions: { compact: [] },
  },
  render: () => null,
});
const badEdge = definePlugin({
  id: "edge",
  title: "Edge",
  layout: {
    anchor: "top-left",
    states: { ready: { rows: 1, columns: 1 } },
    // @ts-expect-error unknown transition target
    transitions: { ready: ["wrong"] },
  },
  render: () => null,
});
// @ts-expect-error nonsequential axes
const badGrid = defineGrid({ rows: [1, 3], columns: [1, 2] });
const status = definePlugin({
  id: "status",
  title: "Status",
  layout: {
    anchor: "top-right",
    states: { ready: { rows: 1, columns: 1 } },
    transitions: { ready: [] },
  },
  render: () => null,
});
ws.place(status, { anchor: { row: 1, column: 4 }, initialState: "ready" });
const heterogeneous = ws
  .place(status, { anchor: { row: 1, column: 4 }, initialState: "ready" })
  .place(plugin, {
    anchor: { row: 3, column: 1 },
    initialState: "compact",
    onStateChange: (state) => {
      const inferred: "compact" | "detail" = state;
      void inferred;
    },
  });
void heterogeneous;
void tooSmall;
void badEdge;
void badGrid;
for (const row of [2, 3] as const)
  for (const column of [1, 2, 3] as const)
    for (const initialState of ["compact", "detail"] as const)
      ws.place(plugin, { anchor: { row, column }, initialState });
// @ts-expect-error expansion leaves grid
ws.place(plugin, { anchor: { row: 1, column: 1 }, initialState: "compact" });
// @ts-expect-error horizontal overflow
ws.place(plugin, { anchor: { row: 3, column: 4 }, initialState: "detail" });
// @ts-expect-error unknown initial state
ws.place(plugin, { anchor: { row: 3, column: 1 }, initialState: "missing" });
// @ts-expect-error grid bounds
ws.place(plugin, { anchor: { row: 4, column: 1 }, initialState: "compact" });
ws.place(plugin, {
  // @ts-expect-error containing region itself leaves the grid
  anchor: { row: 3, column: 2 },
  initialState: "compact",
  region: { row: 1, column: 1, rows: 8, columns: 8 },
});
const minimumPlugin = definePlugin({
  id: "minimum",
  title: "Minimum",
  layout: {
    anchor: "top-left",
    minimum: { rows: 2, columns: 2 },
    states: { full: { rows: 2, columns: 2 } },
    transitions: { full: [] },
  },
  render: () => null,
});
ws.place(minimumPlugin, {
  anchor: { row: 1, column: 1 },
  initialState: "full",
});
const broad: { row: number; column: number } = { row: 1, column: 4 };
// @ts-expect-error widened coordinates cannot prove compatibility
ws.place(plugin, { anchor: broad, initialState: "compact" });

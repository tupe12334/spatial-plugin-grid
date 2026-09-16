import { defaultGrid, definePlugin, defineWorkspace } from "../src";
const stage = definePlugin({
  id: "stage",
  title: "Stage",
  layout: {
    anchor: "bottom-left",
    states: {
      compact: { rows: 1, columns: 2 },
      expanded: { rows: 2, columns: 2 },
    },
    transitions: { compact: ["expanded"], expanded: ["compact"] },
  },
  render: () => null,
});
defineWorkspace(defaultGrid).place(stage, {
  anchor: { row: 3, column: 2 },
  initialState: "compact",
  allowedAnchors: [
    { row: 2, column: 1 },
    { row: 3, column: 3 },
  ],
});
defineWorkspace(defaultGrid).place(stage, {
  anchor: { row: 3, column: 2 },
  initialState: "compact",
  // @ts-expect-error Expanded state cannot fit above the first row.
  allowedAnchors: [{ row: 1, column: 2 }],
});
defineWorkspace(defaultGrid).place(stage, {
  anchor: { row: 3, column: 2 },
  initialState: "compact",
  // @ts-expect-error Both states extend beyond column four.
  allowedAnchors: [{ row: 3, column: 4 }],
});

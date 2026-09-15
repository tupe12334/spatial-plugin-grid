import { describe, expect, it } from "vitest";
import {
  defineGrid,
  definePlugin,
  defineWorkspace,
} from "../src/grid/contract";
const grid = defineGrid({ rows: [1, 2, 3], columns: [1, 2, 3, 4] });
const inspector = definePlugin({
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
  render: () => null,
});
describe("generic placement", () => {
  it.each([2, 3] as const)("all three bottom pairs on row %s", (row) => {
    for (const column of [1, 2, 3] as const) {
      const item = defineWorkspace(grid).place(inspector, {
        anchor: { row, column },
        initialState: "compact",
      }).plugins[0]!;
      expect(item.rectangles.compact).toEqual({
        row,
        column,
        rows: 1,
        columns: 2,
      });
      expect(item.rectangles.detail).toEqual({
        row: row - 1,
        column,
        rows: 2,
        columns: 2,
      });
    }
  });
  it("keeps an empty workspace empty", () =>
    expect(defineWorkspace(grid).plugins).toEqual([]));
  it("rejects duplicate IDs and initial collisions", () => {
    const ws = defineWorkspace(grid).place(inspector, {
      anchor: { row: 3, column: 2 },
      initialState: "compact",
    });
    expect(() =>
      ws.place(inspector, {
        anchor: { row: 2, column: 1 },
        initialState: "compact",
      }),
    ).toThrow(/Duplicate/);
    expect(() =>
      ws.place(
        { ...inspector, id: "other" },
        { anchor: { row: 3, column: 1 }, initialState: "compact" },
      ),
    ).toThrow(/overlap/);
  });
  it("does not reserve expansion capacity", () => {
    const status = definePlugin({
      id: "status",
      title: "Status",
      layout: {
        anchor: "top-left",
        states: { ready: { rows: 1, columns: 1 } },
        transitions: { ready: [] },
      },
      render: () => null,
    });
    expect(
      defineWorkspace(grid)
        .place(inspector, {
          anchor: { row: 3, column: 2 },
          initialState: "compact",
        })
        .place(status, { anchor: { row: 2, column: 2 }, initialState: "ready" })
        .plugins,
    ).toHaveLength(2);
  });
});

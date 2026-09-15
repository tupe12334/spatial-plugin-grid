import { expect, it } from "vitest";
import {
  defaultGrid,
  definePlugin,
  defineWorkspace,
  rectangleAt,
  validatePlacement,
  validatePlugin,
} from "../src/grid/contract";
import type { Alignment } from "../src/grid/types";
const definition = {
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
};
const external = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
it.each(["top-left", "top-right", "bottom-left", "bottom-right"] as const)(
  "validates all states in every cell for %s",
  (alignment) => {
    for (const row of [1, 2, 3])
      for (const column of [1, 2, 3, 4]) {
        const input = {
          ...definition,
          layout: { ...definition.layout, anchor: alignment },
        };
        const rect = rectangleAt({ row, column }, alignment, {
          rows: 2,
          columns: 2,
        });
        const valid =
          rect.row >= 1 &&
          rect.column >= 1 &&
          rect.row + rect.rows <= 4 &&
          rect.column + rect.columns <= 5;
        const call = () =>
          validatePlacement(
            defaultGrid,
            input,
            external({ anchor: { row, column }, initialState: "compact" }),
          );
        if (valid) expect(call().detail).toEqual(rect);
        else
          expect(call).toThrow(
            /inspector, state .*anchor .*footprint .*grid boundary/,
          );
      }
  },
);
it("runtime rejects unknown states, regions, minima and malformed config", () => {
  expect(() =>
    validatePlacement(
      defaultGrid,
      definition,
      external({ anchor: { row: 3, column: 2 }, initialState: "missing" }),
    ),
  ).toThrow(/unknown initial/);
  expect(() =>
    validatePlacement(
      defaultGrid,
      definition,
      external({
        anchor: { row: 3, column: 2 },
        initialState: "compact",
        region: { row: 3, column: 2, rows: 1, columns: 2 },
      }),
    ),
  ).toThrow(/detail.*region/);
  expect(() =>
    validatePlugin({
      ...definition,
      layout: { ...definition.layout, minimum: { rows: 2, columns: 2 } },
    }),
  ).toThrow(/compact.*minimum/);
  for (const layout of [
    { ...definition.layout, states: {} },
    { ...definition.layout, states: { compact: { rows: 0, columns: 2 } } },
    { ...definition.layout, transitions: { compact: ["detail"] } },
    { ...definition.layout, transitions: { compact: ["missing"], detail: [] } },
    {
      ...definition.layout,
      transitions: { compact: ["detail", "detail"], detail: [] },
    },
  ])
    expect(() => validatePlugin({ ...definition, layout })).toThrow();
  expect(() =>
    validatePlacement({ rows: [1, 3], columns: [1, 2] }, definition, {}),
  ).toThrow(/consecutive/);
});
it("identity and appearance never grant extra geometry permissions", () => {
  for (const id of ["agent", "inspector", "chart"])
    for (const appearance of ["panel", "main-stage"] as const) {
      expect(() =>
        validatePlacement(
          defaultGrid,
          { ...definition, id },
          {
            anchor: { row: 1, column: 2 },
            initialState: "compact",
            appearance,
          },
        ),
      ).toThrow(/grid boundary/);
    }
});
it("top-left chart, bottom-right inspector and terminal status coexist", () => {
  const create = (id: string, anchor: Alignment) =>
    definePlugin({
      id,
      title: id,
      layout: {
        anchor,
        states: {
          summary: { rows: 1, columns: 1 },
          full: { rows: 2, columns: 2 },
        },
        transitions: { summary: ["full"], full: [] },
      },
      render: () => null,
    });
  const ws = defineWorkspace(defaultGrid)
    .placeDynamic(create("chart", "top-left"), {
      anchor: { row: 1, column: 1 },
      initialState: "summary",
    })
    .placeDynamic(create("inspector", "bottom-right"), {
      anchor: { row: 3, column: 4 },
      initialState: "summary",
    });
  expect(ws.plugins.map((p) => p.rectangles.full)).toEqual([
    { row: 1, column: 1, rows: 2, columns: 2 },
    { row: 2, column: 3, rows: 2, columns: 2 },
  ]);
});

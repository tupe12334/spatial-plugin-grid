import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  SpatialPluginGrid,
  defaultGrid,
  definePlugin,
  defineWorkspace,
} from "../src";
import { planMove } from "../src/grid/movement";
import { intersects } from "../src/grid/contract";

afterEach(cleanup);
for (const shape of [
  { rows: 1, columns: 2 },
  { rows: 2, columns: 1 },
  { rows: 2, columns: 2 },
] as const) {
  it(`keeps only disjoint alternatives through every keyboard target for ${shape.rows}x${shape.columns}`, () => {
    const plugin = definePlugin({
      id: "panel",
      title: "Panel",
      layout: {
        anchor: "bottom-right",
        states: { normal: shape },
        transitions: { normal: [] },
      },
      render: () => <p>Retained content</p>,
    });
    const workspace = defineWorkspace(defaultGrid).placeDynamic(plugin, {
      anchor: { row: 3, column: 4 },
      initialState: "normal",
      animate: false,
    });
    const instance = workspace.plugins[0]!;
    const items = [
      {
        plugin: instance,
        state: "normal",
        pinned: false,
        covered: false,
        cover: null,
      },
    ];
    const targets = defaultGrid.rows
      .flatMap((row) => defaultGrid.columns.map((column) => ({ row, column })))
      .filter((target) => planMove(items, "panel", target));
    const { container } = render(
      <SpatialPluginGrid workspace={workspace} dragAndDrop />,
    );
    const handle = screen.getByRole("button", { name: "Move Panel" });
    fireEvent.keyDown(handle, { key: "Enter" });
    for (const target of targets) {
      const rect = instance.rectanglesAt(target)!.normal!;
      const key = `${target.row}${target.column}`;
      expect(
        container
          .querySelector('[data-drop-hover="true"]')
          ?.getAttribute("data-drop-target"),
      ).toBe(key);
      const expected = targets
        .filter(
          (candidate) =>
            candidate === target ||
            !intersects(rect, instance.rectanglesAt(candidate)!.normal!),
        )
        .map((candidate) => `${candidate.row}${candidate.column}`);
      expect(
        Array.from(
          container.querySelectorAll("[data-drop-target]"),
          (element) => element.getAttribute("data-drop-target"),
        ),
      ).toEqual(expected);
      expect(
        container
          .querySelector("[data-drag-source=true]")
          ?.getAttribute("data-drag-source-overlap"),
      ).toBe(String(intersects(rect, instance.rectangles.normal!)));
      expect(screen.getByText("Retained content")).toBeTruthy();
      fireEvent.keyDown(handle, { key: "ArrowRight" });
    }
    // Suppressed candidates remain navigable, including after wrapping.
    expect(
      container
        .querySelector('[data-drop-hover="true"]')
        ?.getAttribute("data-drop-target"),
    ).toBe(`${targets[0]!.row}${targets[0]!.column}`);
    fireEvent.keyDown(handle, { key: "Escape" });
    expect(container.querySelector("[data-drop-target]")).toBeNull();
  });
}

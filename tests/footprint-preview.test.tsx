import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  SpatialPluginGrid,
  defaultGrid,
  definePlugin,
  defineWorkspace,
} from "../src";
import type { Alignment, Coordinate } from "../src/grid/types";
afterEach(cleanup);
const cases: {
  alignment: Alignment;
  anchor: Coordinate;
  compact: [string, string];
  expanded: [string, string];
}[] = [
  {
    alignment: "top-left",
    anchor: { row: 1, column: 1 },
    compact: ["2 / span 1", "2 / span 2"],
    expanded: ["2 / span 2", "2 / span 2"],
  },
  {
    alignment: "top-right",
    anchor: { row: 1, column: 4 },
    compact: ["2 / span 1", "1 / span 2"],
    expanded: ["2 / span 2", "1 / span 2"],
  },
  {
    alignment: "bottom-left",
    anchor: { row: 3, column: 1 },
    compact: ["2 / span 1", "2 / span 2"],
    expanded: ["1 / span 2", "2 / span 2"],
  },
  {
    alignment: "bottom-right",
    anchor: { row: 3, column: 4 },
    compact: ["2 / span 1", "1 / span 2"],
    expanded: ["1 / span 2", "1 / span 2"],
  },
];
for (const scenario of cases) {
  it.each(["compact", "expanded"] as const)(
    `highlights the complete ${scenario.alignment} %s footprint, not its anchor or maximum state`,
    (initialState) => {
      const plugin = definePlugin({
        id: "panel",
        title: "Panel",
        layout: {
          anchor: scenario.alignment,
          states: {
            compact: { rows: 1, columns: 2 },
            expanded: { rows: 2, columns: 2 },
          },
          transitions: { compact: ["expanded"], expanded: ["compact"] },
        },
        render: () => null,
      });
      const workspace = defineWorkspace(defaultGrid).placeDynamic(plugin, {
        anchor: scenario.anchor,
        initialState,
        animate: false,
      });
      const { container } = render(
        <SpatialPluginGrid workspace={workspace} dragAndDrop />,
      );
      fireEvent.keyDown(screen.getByRole("button", { name: "Move Panel" }), {
        key: "Enter",
      });
      const preview = container.querySelector<HTMLElement>(
        '[data-drop-target="22"]',
      );
      expect(preview).not.toBeNull();
      expect(preview?.style.gridRow).toBe(scenario[initialState][0]);
      expect(preview?.style.gridColumn).toBe(scenario[initialState][1]);
      fireEvent.keyDown(window, { key: "Escape" });
      expect(container.querySelector("[data-drop-target]")).toBeNull();
    },
  );
}
it("single-cell blocks keep single-cell previews", () => {
  const plugin = definePlugin({
    id: "single",
    title: "Single",
    layout: {
      anchor: "top-left",
      states: { normal: { rows: 1, columns: 1 } },
      transitions: { normal: [] },
    },
    render: () => null,
  });
  const workspace = defineWorkspace(defaultGrid).place(plugin, {
    anchor: { row: 1, column: 1 },
    initialState: "normal",
  });
  const { container } = render(
    <SpatialPluginGrid workspace={workspace} dragAndDrop />,
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "Move Single" }), {
    key: "Enter",
  });
  const preview = container.querySelector<HTMLElement>(
    '[data-drop-target="22"]',
  );
  expect(preview?.style.gridRow).toBe("2 / span 1");
  expect(preview?.style.gridColumn).toBe("2 / span 1");
});

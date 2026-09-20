import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentWorkspace } from "../src/presets/AgentWorkspace";
import { directionalChanges } from "../src/presets/DirectionalControls";
import { pluginHomes, sizesFor } from "../src/presets/groupedLayout";
vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);
afterEach(cleanup);
describe("directional preset controls", () => {
  for (const home of pluginHomes) {
    it(`${home}: every legal size, physical edges and inverse callbacks`, () => {
      const changed = vi.fn();
      const { container } = render(
        <AgentWorkspace
          dir="rtl"
          onPluginSizeChange={changed}
          plugins={[
            {
              id: "tile",
              title: "Tile",
              home,
              allowedSizes: sizesFor(home),
              render: ({ size }) => <p>{size}</p>,
            },
          ]}
        />,
      );
      const vertical = home[0] === "1" ? "bottom" : "top";
      const horizontal = Number(home[1]) % 2 ? "right" : "left";
      for (const size of sizesFor(home).filter((size) => size !== "1x1")) {
        const edge = [
          size[2] === "2" ? vertical : "",
          size[0] === "2" ? horizontal : "",
        ]
          .filter(Boolean)
          .join("-");
        const button = screen.getByRole("button", {
          name: `Expand Tile ${edge} to ${size}`,
        });
        expect(button.getAttribute("data-edge")).toBe(edge);
        fireEvent.click(button);
        expect(changed).toHaveBeenLastCalledWith("tile", size);
        const shrink = screen.getByRole("button", {
          name: `Shrink Tile ${edge} to 1x1`,
        });
        expect(shrink).toBe(button);
        fireEvent.click(shrink);
        expect(changed).toHaveBeenLastCalledWith("tile", "1x1");
      }
      if (home[0] === "3")
        expect(container.querySelectorAll(".spg-edge-control")).toHaveLength(1);
      expect(screen.queryByRole("combobox")).toBeNull();
    });
  }
  it("supports sparse diagonal sizes and preserves keyboard focus on inversion", () => {
    render(
      <AgentWorkspace
        plugins={[
          {
            id: "sparse",
            title: "Sparse",
            home: "21",
            allowedSizes: ["1x1", "2x2"],
            render: () => null,
          },
        ]}
      />,
    );
    const button = screen.getByRole("button", {
      name: "Expand Sparse top-right to 2x2",
    });
    button.focus();
    fireEvent.click(button);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Shrink Sparse top-right to 1x1" }),
    );
  });
  it("does not invent geometry for nongeometric or mixed transitions", () => {
    expect(
      directionalChanges(
        { rows: 1, columns: 2 },
        ["same", "mixed"],
        { same: { rows: 1, columns: 2 }, mixed: { rows: 2, columns: 1 } },
        "bottom-left",
      ),
    ).toEqual([]);
  });
});

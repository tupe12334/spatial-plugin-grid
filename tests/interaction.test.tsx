import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SpatialPluginGrid, type PluginDefinition } from "../src";
const disconnect = vi.fn(),
  remove = vi.fn();
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {
        disconnect();
      }
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: remove,
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const plugins: PluginDefinition[] = [
  {
    id: "a",
    title: "A",
    home: "11",
    allowedSizes: ["1x1", "2x1"],
    render: ({ expanded }) => <button>{expanded ? "Large" : "Small"}</button>,
  },
  {
    id: "b",
    title: "B",
    home: "12",
    allowedSizes: ["1x1", "2x2"],
    render: () => <button>Other</button>,
  },
];
it("expands without renumbering, makes covered panel inert and recovers focus", () => {
  const callback = vi.fn();
  render(<SpatialPluginGrid plugins={plugins} onPluginSizeChange={callback} />);
  screen.getByText("Other").focus();
  fireEvent.change(screen.getByLabelText("A size"), {
    target: { value: "2x1" },
  });
  expect(screen.getByRole("region", { name: "B" }).inert).toBe(true);
  expect(document.activeElement).toBe(screen.getByLabelText("A size"));
  expect(screen.getByRole("region", { name: "A" }).dataset.home).toBe("11");
  expect(callback).toHaveBeenCalledWith("a", "2x1");
  fireEvent.keyDown(screen.getByLabelText("A size"), { key: "Escape" });
  expect(screen.getByRole("region", { name: "B" }).inert).toBe(false);
});
it("isolates render errors and reports to host", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const onError = vi.fn();
  render(
    <SpatialPluginGrid
      plugins={[
        {
          ...plugins[0]!,
          render: () => {
            throw new Error("failure");
          },
        },
        plugins[1]!,
      ]}
      onPluginError={onError}
    />,
  );
  expect(screen.getByRole("alert").textContent).toContain("could not render");
  expect(screen.getByText("Other")).toBeTruthy();
  expect(onError).toHaveBeenCalled();
  consoleError.mockRestore();
});
it("cleans observers and media listeners on unmount", () => {
  const view = render(<SpatialPluginGrid plugins={plugins} />);
  view.unmount();
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledTimes(1);
});
it("keyboard and directional touch change stage state", () => {
  render(<SpatialPluginGrid plugins={plugins} />);
  const history = screen.getByRole("log");
  fireEvent.keyDown(history, { key: "ArrowUp" });
  expect(
    screen
      .getByRole("button", { name: /Collapse/ })
      .getAttribute("aria-expanded"),
  ).toBe("true");
  fireEvent.keyDown(history, { key: "ArrowDown" });
  expect(screen.getByRole("button", { name: /Expand/ })).toBeTruthy();
  fireEvent.touchStart(history, { touches: [{ clientY: 200 }] });
  fireEvent.touchMove(history, { touches: [{ clientY: 100 }] });
  expect(screen.getByRole("button", { name: /Collapse/ })).toBeTruthy();
  fireEvent.touchMove(history, { touches: [{ clientY: 250 }] });
  expect(screen.getByRole("button", { name: /Expand/ })).toBeTruthy();
});

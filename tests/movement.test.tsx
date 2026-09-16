import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  SpatialPluginGrid,
  defaultGrid,
  definePlugin,
  defineWorkspace,
} from "../src";
import { planMove, type MovableItem } from "../src/grid/movement";
import type { Workspace } from "../src/grid/types";
const block = definePlugin({
  id: "a",
  title: "A",
  layout: {
    anchor: "top-left",
    states: { small: { rows: 1, columns: 1 } },
    transitions: { small: [] },
  },
  render: () => <input aria-label="Local content" defaultValue="retained" />,
});
const stage = definePlugin({
  id: "stage",
  title: "Stage",
  layout: {
    anchor: "bottom-left",
    states: { small: { rows: 1, columns: 2 }, large: { rows: 2, columns: 2 } },
    transitions: { small: ["large"], large: ["small"] },
  },
  render: () => null,
});
const ws = () =>
  defineWorkspace(defaultGrid)
    .place(block, { anchor: { row: 1, column: 1 }, initialState: "small" })
    .place(
      { ...block, id: "b", title: "B", render: () => null },
      { anchor: { row: 1, column: 2 }, initialState: "small" },
    )
    .place(stage, {
      anchor: { row: 3, column: 2 },
      initialState: "small",
      appearance: "main-stage",
    });
const items = (workspace: Workspace): MovableItem[] =>
  workspace.plugins.map((plugin) => ({
    plugin,
    state: plugin.initialState,
    pinned: false,
    covered: false,
    cover: null,
  }));
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("placement-aware movement", () => {
  it.each([1, 2, 3, 4])(
    "rejects main stage anchor 1%s even while collapsed",
    (column) => {
      expect(planMove(items(ws()), "stage", { row: 1, column })).toBeNull();
    },
  );
  it("allows the ordinary stage to move to a compatible empty anchor", () => {
    const next = planMove(items(ws()), "stage", { row: 2, column: 2 });
    expect(next?.find((p) => p.id === "stage")?.anchor).toEqual({
      row: 2,
      column: 2,
    });
  });
  it("moves to empty cells and swaps exact occupants atomically", () => {
    expect(
      planMove(items(ws()), "a", { row: 2, column: 4 })?.[0]?.anchor,
    ).toEqual({ row: 2, column: 4 });
    const swap = planMove(items(ws()), "a", { row: 1, column: 2 });
    expect(swap?.map((p) => p.anchor)).toEqual([
      { row: 1, column: 2 },
      { row: 1, column: 1 },
      { row: 3, column: 2 },
    ]);
  });
  it.each(["pinned", "covered"] as const)(
    "rejects %s source and destination",
    (key) => {
      const source = items(ws()).map((item, index) =>
        index === 0 ? { ...item, [key]: true } : item,
      );
      expect(planMove(source, "a", { row: 2, column: 4 })).toBeNull();
      expect(planMove(source, "b", { row: 1, column: 1 })).toBeNull();
    },
  );
  it("rejects empty cells under an expanded pinned stage", () => {
    const current = items(ws()).map((item) =>
      item.plugin.id === "stage"
        ? { ...item, state: "large", pinned: true }
        : item,
    );
    expect(planMove(current, "a", { row: 2, column: 2 })).toBeNull();
    expect(planMove(current, "a", { row: 2, column: 3 })).toBeNull();
  });
  it("protects animation covers and disallows moving a transitioning panel", () => {
    const current = items(ws()).map((item) =>
      item.plugin.id === "stage"
        ? { ...item, cover: { row: 2, column: 2, rows: 2, columns: 2 } }
        : item,
    );
    expect(planMove(current, "a", { row: 2, column: 2 })).toBeNull();
    expect(planMove(current, "stage", { row: 2, column: 1 })).toBeNull();
  });
  it("respects region, allowedAnchors and per-placement opt-out in both swap directions", () => {
    const restricted = defineWorkspace(defaultGrid)
      .place(block, {
        anchor: { row: 1, column: 1 },
        initialState: "small",
        allowedAnchors: [{ row: 1, column: 1 }],
        region: { row: 1, column: 1, rows: 1, columns: 2 },
      })
      .place(
        { ...block, id: "b", title: "B" },
        { anchor: { row: 1, column: 2 }, initialState: "small" },
      );
    expect(planMove(items(restricted), "a", { row: 1, column: 2 })).toBeNull();
    expect(planMove(items(restricted), "b", { row: 1, column: 1 })).toBeNull();
    const fixed = defineWorkspace(defaultGrid).place(block, {
      anchor: { row: 1, column: 1 },
      initialState: "small",
      draggable: false,
    });
    expect(planMove(items(fixed), "a", { row: 1, column: 2 })).toBeNull();
    expect(
      restricted.plugins[0]?.rectanglesAt({ row: 2, column: 1 }),
    ).toBeNull();
  });
  it("rejects malformed dynamic permission data and incompatible permitted anchors", () => {
    expect(() =>
      defineWorkspace(defaultGrid).placeDynamic(stage, {
        anchor: { row: 3, column: 2 },
        initialState: "small",
        allowedAnchors: [{ row: 1, column: 2 }],
      }),
    ).toThrow();
    expect(() =>
      defineWorkspace(defaultGrid).placeDynamic(
        block,
        JSON.parse(
          '{"anchor":{"row":1,"column":1},"initialState":"small","draggable":"yes"}',
        ),
      ),
    ).toThrow();
  });
  it("does not alter the caller's immutable workspace", () => {
    const original = ws();
    planMove(items(original), "a", { row: 1, column: 2 });
    expect(original.plugins[0]?.anchor).toEqual({ row: 1, column: 1 });
  });
  it("disabled by default; keyboard swaps retain plugin content and report full placements once", () => {
    const workspace = ws(),
      callback = vi.fn();
    const { rerender } = render(<SpatialPluginGrid workspace={workspace} />);
    expect(screen.queryByLabelText("Move A")).toBeNull();
    rerender(
      <SpatialPluginGrid
        workspace={workspace}
        dragAndDrop
        onPluginsMoved={callback}
      />,
    );
    const input = screen.getByLabelText("Local content");
    fireEvent.change(input, { target: { value: "edited" } });
    fireEvent.keyDown(screen.getByLabelText("Move A"), { key: "Enter" });
    fireEvent.keyDown(screen.getByLabelText("Move A"), { key: "Enter" });
    expect(screen.getByLabelText("Local content")).toBe(input);
    expect((input as HTMLInputElement).value).toBe("edited");
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({
      a: { row: 1, column: 2 },
      b: { row: 1, column: 1 },
      stage: { row: 3, column: 2 },
    });
  });
  it("cancels on Escape and when permission is disabled mid-drag", () => {
    const workspace = ws(),
      callback = vi.fn();
    const { rerender } = render(
      <SpatialPluginGrid
        workspace={workspace}
        dragAndDrop
        onPluginsMoved={callback}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText("Move A"), { key: "Enter" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelectorAll("[data-drop-target]").length).toBe(0);
    fireEvent.keyDown(screen.getByLabelText("Move A"), { key: "Enter" });
    rerender(
      <SpatialPluginGrid workspace={workspace} onPluginsMoved={callback} />,
    );
    expect(document.querySelectorAll("[data-drop-target]").length).toBe(0);
    expect(callback).not.toHaveBeenCalled();
  });
  it("host workspace replacement resets placements and cancels stale moves without collisions", () => {
    const callback = vi.fn();
    const { rerender } = render(
      <SpatialPluginGrid
        workspace={ws()}
        dragAndDrop
        onPluginsMoved={callback}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText("Move A"), { key: "Enter" });
    fireEvent.keyDown(screen.getByLabelText("Move A"), { key: "Enter" });
    fireEvent.keyDown(screen.getByLabelText("Move A"), { key: "Enter" });
    rerender(
      <SpatialPluginGrid
        workspace={ws()}
        dragAndDrop
        onPluginsMoved={callback}
      />,
    );
    expect(screen.getByRole("region", { name: "A" }).dataset.home).toBe("11");
    expect(screen.getByRole("region", { name: "B" }).dataset.home).toBe("12");
    expect(document.querySelectorAll("[data-drop-target]").length).toBe(0);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

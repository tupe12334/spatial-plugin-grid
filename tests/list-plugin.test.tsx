import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createListPlugin, defineWorkspace, defaultGrid } from "../src";
import type { ListItem } from "../src";

afterEach(cleanup);

const items: ListItem[] = [
  { id: "prod", label: "Production", description: "Live tenant" },
  { id: "staging", label: "Staging", badge: "default" },
];

it("createListPlugin produces a validated compact/expanded plugin", () => {
  const plugin = createListPlugin({ id: "systems", title: "Systems", items });
  expect(plugin.layout.states).toEqual({
    compact: { rows: 1, columns: 1 },
    expanded: { rows: 1, columns: 2 },
  });
  // The returned plugin registers against the default grid without error.
  expect(() =>
    defineWorkspace(defaultGrid).place(plugin, {
      anchor: { row: 3, column: 1 },
      initialState: "compact",
    }),
  ).not.toThrow();
});

it("empty items render the empty label in both states", () => {
  const plugin = createListPlugin({
    id: "systems",
    title: "Systems",
    items: [],
    emptyLabel: "No systems",
  });
  for (const state of ["compact", "expanded"] as const) {
    cleanup();
    const { container } = render(
      <div className="spg-plugin-body">{plugin.render(context(state))}</div>,
    );
    expect(screen.getByText("No systems")).toBeTruthy();
    expect(container.querySelector("ul.spg-list")).toBeNull();
  }
});

function context(state: "compact" | "expanded") {
  return {
    state,
    pinned: false,
    transitionTo: () => {},
    reset: () => {},
    setPinned: () => {},
  };
}

describe("rendered list", () => {
  it("activates items with their id", () => {
    const onItemActivate = vi.fn();
    const plugin = createListPlugin({
      id: "systems",
      title: "Systems",
      items,
      onItemActivate,
    });
    render(
      <div className="spg-plugin-body">
        {plugin.render(context("compact"))}
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Staging/ }));
    expect(onItemActivate).toHaveBeenCalledWith("staging");
  });

  it("compact density hides descriptions and badges", () => {
    const plugin = createListPlugin({ id: "systems", title: "Systems", items });
    const { container } = render(
      <div className="spg-plugin-body">{plugin.render(context("compact"))}</div>,
    );
    expect(screen.queryByText("Live tenant")).toBeNull();
    expect(container.querySelector(".spg-list-item-badge")).toBeNull();
    expect(
      container.querySelector('.spg-list[data-density="compact"]'),
    ).not.toBeNull();
  });

  it("full density exposes descriptions, badges and selected state", () => {
    const plugin = createListPlugin({
      id: "systems",
      title: "Systems",
      items: [
        {
          id: "prod",
          label: "Production",
          description: "Live tenant",
          selected: true,
        },
        { id: "staging", label: "Staging", badge: "default" },
      ],
    });
    const { container } = render(
      <div className="spg-plugin-body">{plugin.render(context("expanded"))}</div>,
    );
    expect(screen.getByText("Live tenant")).toBeTruthy();
    expect(screen.getByText("default")).toBeTruthy();
    expect(
      container.querySelector('.spg-list-item[data-selected="true"]'),
    ).not.toBeNull();
  });

  it("renders non-interactive items when no activation handler is given", () => {
    const plugin = createListPlugin({ id: "systems", title: "Systems", items });
    render(
      <div className="spg-plugin-body">{plugin.render(context("compact"))}</div>,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

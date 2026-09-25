import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createFourActionGridPlugin,
  defaultGrid,
  defineWorkspace,
  FourActionGrid,
} from "../src";

afterEach(cleanup);

const actions = [
  { id: "plan", label: "Plan" },
  { id: "build", label: "Build", icon: "B" },
  { id: "review", label: "Review" },
  { id: "share", label: "Share", disabled: true },
] as const;

const context = {
  state: "ready" as const,
  pinned: false,
  transitionTo: () => {},
  reset: () => {},
  setPinned: () => {},
};

it("createFourActionGridPlugin produces a validated single-cell plugin", () => {
  const plugin = createFourActionGridPlugin({
    id: "quick-actions",
    title: "Quick actions",
    actions,
  });
  expect(plugin.title).toBe("Quick actions");
  expect(plugin.layout.states).toEqual({ ready: { rows: 1, columns: 1 } });
  expect(plugin.layout.transitions).toEqual({ ready: [] });
  for (const row of [1, 2, 3] as const)
    for (const column of [1, 2, 3, 4] as const)
      expect(() =>
        defineWorkspace(defaultGrid).place(plugin, {
          anchor: { row, column },
          initialState: "ready",
        }),
      ).not.toThrow();
});

it("renders four titleless actions in order and reports the typed id", () => {
  const onAction = vi.fn<(id: (typeof actions)[number]["id"]) => void>();
  const plugin = createFourActionGridPlugin({
    id: "quick-actions",
    title: "Quick actions",
    actions,
    onAction,
  });
  const { container } = render(<>{plugin.render(context)}</>);
  const buttons = screen.getAllByRole("button");
  expect(buttons.map(({ textContent }) => textContent)).toEqual([
    "Plan",
    "BBuild",
    "Review",
    "Share",
  ]);
  expect(container.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull();
  expect(screen.queryByText("Quick actions")).toBeNull();
  expect(
    container
      .querySelector(".spg-four-action-grid-icon")
      ?.getAttribute("aria-hidden"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Build" }));
  expect(onAction).toHaveBeenCalledWith("build");
});

it("disabled actions do not report activation", () => {
  const onAction = vi.fn();
  render(<FourActionGrid actions={actions} onAction={onAction} />);
  const share = screen.getByRole("button", { name: "Share" });
  expect(share).toHaveProperty("disabled", true);
  fireEvent.click(share);
  expect(onAction).not.toHaveBeenCalled();
});

it("renders without an action handler", () => {
  render(<FourActionGrid actions={actions} />);
  expect(() =>
    fireEvent.click(screen.getByRole("button", { name: "Plan" })),
  ).not.toThrow();
});

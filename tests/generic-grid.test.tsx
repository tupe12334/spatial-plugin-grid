import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import {
  SpatialPluginGrid,
  defaultGrid,
  definePlugin,
  defineWorkspace,
  type PluginContext,
} from "../src";
beforeEach(() => vi.stubGlobal("matchMedia", () => ({ matches: true })));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("default renderer has no implicit agent or reserved panel", () => {
  const view = render(<SpatialPluginGrid />);
  expect(view.container.querySelectorAll("[data-spg-panel]")).toHaveLength(0);
  expect(screen.queryByRole("log")).toBeNull();
});
it("arbitrary chart transitions, reset, pin and cover preserve neighboring state", () => {
  let controls: PluginContext<"summary" | "full" | "terminal"> | undefined;
  const chart = definePlugin({
    id: "chart",
    title: "Chart",
    layout: {
      anchor: "top-left",
      states: {
        summary: { rows: 1, columns: 1 },
        full: { rows: 2, columns: 2 },
        terminal: { rows: 1, columns: 2 },
      },
      transitions: { summary: ["full"], full: ["terminal"], terminal: [] },
    },
    render: (ctx) => {
      controls = ctx;
      return (
        <button onClick={() => ctx.transitionTo("full")}>Open chart</button>
      );
    },
  });
  function Counter() {
    const [count, setCount] = useState(0);
    return <button onClick={() => setCount(count + 1)}>Count {count}</button>;
  }
  const status = definePlugin({
    id: "status",
    title: "Status",
    layout: {
      anchor: "top-left",
      states: { ready: { rows: 1, columns: 1 } },
      transitions: { ready: [] },
    },
    render: () => <Counter />,
  });
  render(
    <SpatialPluginGrid
      workspace={defineWorkspace(defaultGrid)
        .place(chart, {
          anchor: { row: 1, column: 1 },
          initialState: "summary",
          animate: false,
          appearance: "main-stage",
        })
        .place(status, {
          anchor: { row: 2, column: 2 },
          initialState: "ready",
        })}
    />,
  );
  fireEvent.click(screen.getByText("Count 0"));
  expect(() => act(() => controls!.transitionTo("terminal"))).toThrow(
    /not allowed/,
  );
  screen.getByText("Count 1").focus();
  fireEvent.click(screen.getByText("Open chart"));
  expect(screen.getByRole("region", { name: "Status" }).inert).toBe(true);
  expect(document.activeElement).toBe(screen.getByText("Open chart"));
  act(() => controls!.setPinned(true));
  act(() => controls!.reset());
  expect(screen.getByRole("region", { name: "Chart" }).dataset.state).toBe(
    "full",
  );
  act(() => controls!.setPinned(false));
  act(() => controls!.transitionTo("terminal"));
  expect(() => act(() => controls!.transitionTo("full"))).toThrow(
    /not allowed/,
  );
  act(() => controls!.reset());
  expect(screen.getByRole("region", { name: "Status" }).inert).toBe(false);
  expect(screen.getByText("Count 1")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Chart" }).dataset.state).toBe(
    "summary",
  );
});
it("reset returns to a non-smallest initial state", () => {
  let context: PluginContext<"small" | "large"> | undefined;
  const p = definePlugin({
    id: "inspector",
    title: "Inspector",
    layout: {
      anchor: "bottom-right",
      states: {
        small: { rows: 1, columns: 1 },
        large: { rows: 2, columns: 2 },
      },
      transitions: { small: ["large"], large: ["small"] },
    },
    render: (ctx) => {
      context = ctx;
      return null;
    },
  });
  render(
    <SpatialPluginGrid
      workspace={defineWorkspace(defaultGrid).place(p, {
        anchor: { row: 3, column: 4 },
        initialState: "large",
        animate: false,
      })}
    />,
  );
  act(() => context!.transitionTo("small"));
  act(() => context!.reset());
  expect(screen.getByRole("region", { name: "Inspector" }).dataset.state).toBe(
    "large",
  );
});

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  SpatialPluginGrid,
  defaultGrid,
  definePlugin,
  defineWorkspace,
  validatePlacement,
} from "../src";
import "../src/styles.css";
import "./demo.css";
const meta = {
  title: "PluginPlacement",
  component: SpatialPluginGrid,
  args: {
    className: "demo-theme",
    navbar: <span>Plugin-defined states · No implicit conversation</span>,
  },
} satisfies Meta<typeof SpatialPluginGrid>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
function Count() {
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
  render: () => (
    <div className="spg-plugin-body">
      <h3>Status</h3>
      <p>One state. One cell.</p>
      <Count />
    </div>
  ),
});
const chart = definePlugin({
  id: "chart",
  title: "Chart",
  layout: {
    anchor: "top-left",
    states: {
      summary: { rows: 1, columns: 1 },
      detail: { rows: 2, columns: 3 },
    },
    transitions: { summary: ["detail"], detail: ["summary"] },
  },
  render: ({ state, transitionTo, reset }) => (
    <div className="spg-plugin-body">
      <h3>Chart · {state}</h3>
      <p>Grows right and down to 3 columns × 2 rows.</p>
      <button
        onClick={() => (state === "summary" ? transitionTo("detail") : reset())}
      >
        {state === "summary" ? "Open chart" : "Reset chart"}
      </button>
    </div>
  ),
});
const inspector = definePlugin({
  id: "inspector",
  title: "Inspector",
  layout: {
    anchor: "bottom-right",
    states: {
      compact: { rows: 1, columns: 2 },
      detail: { rows: 2, columns: 2 },
    },
    transitions: { compact: ["detail"], detail: ["compact"] },
  },
  render: ({ state, transitionTo, reset, pinned, setPinned }) => (
    <div className="spg-plugin-body">
      <h3>Inspector · {state}</h3>
      <p>
        Bottom-right anchored. Shared main-stage appearance, without an agent.
      </p>
      <button
        onClick={() => (state === "compact" ? transitionTo("detail") : reset())}
      >
        {state === "compact" ? "Inspect" : "Reset inspector"}
      </button>
      <button onClick={() => setPinned(!pinned)}>
        {pinned ? "Unpin inspector" : "Pin inspector"}
      </button>
    </div>
  ),
});
const mixed = defineWorkspace(defaultGrid)
  .place(chart, { anchor: { row: 1, column: 1 }, initialState: "summary" })
  .place(status, { anchor: { row: 1, column: 4 }, initialState: "ready" })
  .place(inspector, {
    anchor: { row: 3, column: 4 },
    initialState: "compact",
    appearance: "main-stage",
  });
export const NonAgentPlugins: Story = { args: { workspace: mixed } };
export const DragAndDrop: Story = {
  args: {
    workspace: mixed,
    dragAndDrop: true,
    navbar: (
      <span>
        Drag a Move handle, or press Enter, arrows, Enter. Escape cancels. Each
        block keeps its own placement rules.
      </span>
    ),
  },
};
export const DragAndDropRTL: Story = {
  args: { ...DragAndDrop.args, dir: "rtl" },
};
export const Light: Story = {
  args: { workspace: mixed, className: "demo-theme demo-light" },
};
export const NarrowRTL: Story = {
  args: {
    workspace: mixed,
    dir: "rtl",
    style: { width: "390px", maxWidth: "100%" },
  },
};
export const AllCells: Story = {
  args: {
    workspace: defaultGrid.rows.reduce(
      (workspace, row) =>
        defaultGrid.columns.reduce(
          (ws, column) =>
            ws.placeDynamic(
              {
                ...status,
                id: `cell-${row}${column}`,
                title: `Cell ${row}${column}`,
                render: () => (
                  <div className="spg-plugin-body">
                    Cell {row}
                    {column}
                  </div>
                ),
              },
              { anchor: { row, column }, initialState: "ready" },
            ),
          workspace,
        ),
      defineWorkspace(defaultGrid),
    ),
  },
};
export const InvalidDynamicPlacement: Story = {
  render: () => {
    let error = "";
    try {
      validatePlacement(
        defaultGrid,
        inspector,
        JSON.parse('{"anchor":{"row":1,"column":1},"initialState":"compact"}'),
      );
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    return (
      <div className="spg-root demo-theme">
        <p role="alert">{error}</p>
      </div>
    );
  },
};

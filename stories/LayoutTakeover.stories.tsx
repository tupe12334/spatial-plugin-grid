import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ActionBlock, AgentWorkspace, type LayoutTakeoverRegion } from "../src";
import "../src/styles.css";
import "./demo.css";

const systems = [
  "Billing",
  "Inventory",
  "Support",
  "Analytics",
  "HR",
  "Logistics",
  "CRM",
  "Finance",
];
function SystemsPickerDemo() {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const regions: LayoutTakeoverRegion[] = systems.map((label, index) => ({
    id: `choice-${label}`,
    title: label,
    rect: {
      row: index < 4 ? 1 : 2,
      column: (index % 4) + 1,
      rows: 1,
      columns: 1,
    },
    render: () => (
      <ActionBlock
        label={label}
        description={`Page ${page}`}
        selected={selected === label}
        onActivate={() => setSelected(label)}
      />
    ),
  }));
  regions.push(
    {
      id: "previous",
      title: "Previous page",
      rect: { row: 3, column: 1, rows: 1, columns: 1 },
      render: () => (
        <ActionBlock
          label="Previous"
          disabled={page === 1}
          onActivate={() => setPage(page - 1)}
        />
      ),
    },
    {
      id: "next",
      title: "Next page",
      rect: { row: 3, column: 4, rows: 1, columns: 1 },
      render: () => (
        <ActionBlock label="Next" onActivate={() => setPage(page + 1)} />
      ),
    },
  );
  return (
    <AgentWorkspace
      className="demo-theme"
      plugins={[
        {
          id: "clock",
          title: "Clock",
          home: "11",
          allowedSizes: ["1x1", "2x2"],
          render: ({ setSize }) => (
            <button onClick={() => setSize("2x2")}>Expand clock</button>
          ),
        },
      ]}
      mainStage={{
        title: "Agent",
        composer: (
          <textarea
            aria-label="Draft"
            placeholder="Keep chatting while choosing"
          />
        ),
      }}
      takeover={{ open, onOpenChange: setOpen, regions }}
      navbar={
        <button onClick={() => setOpen((value) => !value)}>
          {open ? "Close picker" : "Open picker"}
        </button>
      }
    />
  );
}
const meta = {
  title: "LayoutTakeover",
  component: SystemsPickerDemo,
} satisfies Meta<typeof SystemsPickerDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SystemsPicker: Story = {};

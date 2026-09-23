import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ActionBlock, SpatialPluginGrid, useLayoutTakeover } from "../src";
import "../src/styles.css";
import "./demo.css";
const options = [
  { id: "billing", label: "Billing", description: "Invoices and plans" },
  { id: "inventory", label: "Inventory", description: "Stock and orders" },
  { id: "support", label: "Support", description: "Tickets and macros" },
  { id: "analytics", label: "Analytics", description: "Dashboards" },
];
function ActionBlockCards() {
  const [selected, setSelected] = useState("billing");
  const overlay = useLayoutTakeover({
    open: true,
    onOpenChange() {},
    regions: options.map((option, index) => ({
      id: option.id,
      title: option.label,
      rect: { row: 1, column: index + 1, rows: 1, columns: 1 },
      render: () => (
        <ActionBlock
          label={option.label}
          description={option.description}
          selected={option.id === selected}
          onActivate={() => setSelected(option.id)}
        />
      ),
    })),
  });
  return (
    <div className="demo-theme">
      <SpatialPluginGrid overlay={overlay} />
    </div>
  );
}
const meta = {
  title: "ActionBlock",
  component: ActionBlockCards,
} satisfies Meta<typeof ActionBlockCards>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Cards: Story = {};

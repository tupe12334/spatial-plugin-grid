import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  SpatialPluginGrid,
  createListPlugin,
  defaultGrid,
  defineWorkspace,
  type ListItem,
} from "../src";
import "../src/styles.css";
import "./demo.css";
const items: ListItem[] = [
  {
    id: "prod",
    label: "Production",
    description: "Live tenant",
    badge: "live",
    icon: "🟢",
  },
  {
    id: "staging",
    label: "Staging",
    description: "Preview tenant",
    icon: "🟡",
  },
  { id: "dev", label: "Development", description: "Local tenant", icon: "🔵" },
];
function ListDemo() {
  const [selected, setSelected] = useState("prod");
  const plugin = createListPlugin({
    id: "systems",
    title: "Systems",
    items: items.map((item) => ({ ...item, selected: item.id === selected })),
    emptyLabel: "No systems",
    onItemActivate: setSelected,
  });
  const workspace = defineWorkspace(defaultGrid).place(plugin, {
    anchor: { row: 3, column: 1 },
    initialState: "compact",
  });
  return (
    <SpatialPluginGrid
      className="demo-theme"
      workspace={workspace}
      navbar={<span>Generic list plugin · Expand for descriptions</span>}
    />
  );
}
const meta = {
  title: "ListPlugin",
  component: ListDemo,
} satisfies Meta<typeof ListDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

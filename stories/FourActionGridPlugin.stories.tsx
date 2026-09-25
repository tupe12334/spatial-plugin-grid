import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  SpatialPluginGrid,
  createFourActionGridPlugin,
  defaultGrid,
  defineWorkspace,
  type FourActions,
} from "../src";
import "../src/styles.css";
import "./demo.css";
const actions = [
  { id: "plan", label: "Plan", icon: "🗺️" },
  { id: "build", label: "Build", icon: "🛠️" },
  { id: "review", label: "Review", icon: "🔍" },
  { id: "share", label: "Share", icon: "📤" },
] as const satisfies FourActions;
function FourActionGridDemo() {
  const [last, setLast] = useState<string>("none");
  const plugin = createFourActionGridPlugin({
    id: "quick-actions",
    title: "Quick actions",
    actions,
    onAction: setLast,
  });
  const workspace = defineWorkspace(defaultGrid).place(plugin, {
    anchor: { row: 1, column: 1 },
    initialState: "ready",
  });
  return (
    <SpatialPluginGrid
      className="demo-theme"
      workspace={workspace}
      navbar={<span>Generic four-action plugin · Last action: {last}</span>}
    />
  );
}
const meta = {
  title: "FourActionGridPlugin",
  component: FourActionGridDemo,
} satisfies Meta<typeof FourActionGridDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  SpatialPluginGrid,
  createAgentPlugin,
  defaultGrid,
  definePlugin,
  defineWorkspace,
} from "../src";
import "../src/styles.css";
import "./demo.css";
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>Upper count {count}</button>
  );
}
const upper = definePlugin({
  id: "upper",
  title: "Upper occupant",
  layout: {
    anchor: "top-left",
    states: { ready: { rows: 1, columns: 1 } },
    transitions: { ready: [] },
  },
  render: () => (
    <div className="spg-plugin-body">
      <p>Available while collapsed</p>
      <Counter />
    </div>
  ),
});
const agent = createAgentPlugin({
  id: "assistant",
  title: "Conversation",
  transcript: [
    "Can this conversation sit somewhere else?",
    "Yes. The host chooses a compatible anchor.",
    "What happens to the panels above it?",
    "They stay available while the conversation is collapsed.",
    "And when I expand it?",
    "I cover them without moving or resetting their content.",
    "Is the conversation a special case in the grid?",
    "No. Charts, inspectors and conversations share the same contract.",
  ].map((content, index) => ({
    id: String(index),
    author: index % 2 ? "AGENT" : "YOU",
    content,
  })),
  composer: (
    <form onSubmit={(event) => event.preventDefault()}>
      <input aria-label="Message" placeholder="Ask anything…" />
      <button aria-label="Send preview message">↑</button>
    </form>
  ),
});
const at = (row: 2 | 3, column: 1 | 2 | 3) =>
  defineWorkspace(defaultGrid)
    .place(agent, {
      anchor: { row, column },
      initialState: "collapsed",
      appearance: "main-stage",
    })
    .placeDynamic(upper, {
      anchor: { row: row - 1, column },
      initialState: "ready",
    });
const meta = {
  title: "AgentPlugin",
  component: SpatialPluginGrid,
  args: {
    className: "demo-theme",
    navbar: (
      <span>
        Conversation is an ordinary plugin · Expand to cover the upper occupant
      </span>
    ),
  },
} satisfies Meta<typeof SpatialPluginGrid>;
export default meta;
type Story = StoryObj<typeof meta>;
export const At21: Story = { args: { workspace: at(2, 1) } };
export const At22: Story = { args: { workspace: at(2, 2) } };
export const At23: Story = { args: { workspace: at(2, 3) } };
export const At31: Story = { args: { workspace: at(3, 1) } };
export const At32: Story = { args: { workspace: at(3, 2) } };
export const At33: Story = { args: { workspace: at(3, 3) } };

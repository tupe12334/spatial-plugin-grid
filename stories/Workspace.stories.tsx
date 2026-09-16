import { useState, type CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  AgentWorkspace,
  MainStage,
  pluginHomes,
  sizesFor,
  type GroupedPluginDefinition,
  type TranscriptEntry,
} from "../src";
import "../src/styles.css";
import "./demo.css";
const plugins: GroupedPluginDefinition[] = pluginHomes.map((home) => ({
  id: home,
  title: `Plugin ${home}`,
  home,
  allowedSizes: sizesFor(home),
  render: ({ expanded, shrink }) => (
    <div className="demo-plugin">
      <strong>{home}</strong>
      <span>Plugin {home}</span>
      {expanded && <button onClick={shrink}>Return home</button>}
    </div>
  ),
}));
const transcript: TranscriptEntry[] = [
  "Let's give this workspace a little more breathing room.",
  "Of course. A quiet layout, clear sections, and space to focus.",
  "Keep the navigation above the blocks.",
  "The top space is reserved for your navigation.",
  "And keep our conversation right here.",
  "Right here. Scroll back whenever you need — your message bar stays in place.",
].map((content, index) => ({
  id: String(index),
  author: index % 2 ? "AGENT" : "YOU",
  content,
}));
function Composer() {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setValue("");
      }}
    >
      <input
        aria-label="Message"
        placeholder="Ask anything…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button aria-label="Send preview message">↑</button>
    </form>
  );
}
const meta = {
  title: "Workspace",
  excludeStories: ["StageExample"],
  component: AgentWorkspace,
  args: {
    plugins,
    mainStage: { transcript, composer: <Composer /> },
    className: "demo-theme",
    navbar: <span>Agent Workspace</span>,
  },
} satisfies Meta<typeof AgentWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ReferenceWorkspace: Story = {};
export const AllSizesAndGroups: Story = {
  args: {
    navbar: (
      <span>
        Use each size selector: top groups expand inward; bottom slots expand
        upward.
      </span>
    ),
  },
};
export const Light: Story = { args: { className: "demo-theme demo-light" } };
export const Dark: Story = {};
export const EmptyStage: Story = {
  args: { mainStage: { composer: <Composer /> } },
};
export const PopulatedStage: Story = {};
export const CustomPlugin: Story = {
  args: {
    plugins: [
      {
        id: "counter",
        title: "Host counter",
        home: "11",
        allowedSizes: ["1x1", "2x2"],
        render: (context) => <Counter expanded={context.expanded} />,
      },
    ],
  },
};
function Counter({ expanded }: { expanded: boolean }) {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      Host count {count} · {expanded ? "expanded" : "home"}
    </button>
  );
}
export const ReducedMotion: Story = {
  args: { className: "demo-theme demo-reduced" },
  parameters: {
    docs: {
      description: {
        story:
          "This story previews motion-free rendering. Browser tests additionally enforce the OS preference and verify final geometry.",
      },
    },
  },
};
export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
  args: { style: { width: "390px", maxWidth: "100%" } },
};
export const RTL: Story = { args: { dir: "rtl" } };
export const ThemeUpdates: Story = {
  render: (args) => {
    const [light, setLight] = useState(false);
    return (
      <AgentWorkspace
        {...args}
        className={`demo-theme ${light ? "demo-light" : ""}`}
        navbar={<button onClick={() => setLight(!light)}>Change theme</button>}
      />
    );
  },
};
export const Cleanup: Story = {
  render: (args) => {
    const [shown, setShown] = useState(true);
    return (
      <>
        <button className="demo-mount" onClick={() => setShown(!shown)}>
          Toggle mount
        </button>
        {shown && <AgentWorkspace {...args} />}
      </>
    );
  },
};
export const PluginFailure: Story = {
  args: {
    plugins: [
      ...plugins.filter((plugin) => plugin.home !== "11"),
      {
        id: "broken",
        title: "Broken plugin",
        home: "11",
        allowedSizes: ["1x1"],
        render: () => {
          throw new Error("Story failure");
        },
      },
    ],
  },
};
export function StageExample({ empty = false }: { empty?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="spg-root demo-theme"
      style={
        { position: "relative", height: expanded ? 600 : 320 } as CSSProperties
      }
    >
      <MainStage
        expanded={expanded}
        onExpandedChange={setExpanded}
        transcript={empty ? [] : transcript}
        composer={<Composer />}
      />
    </div>
  );
}

export const PinnableStage: Story = {
  args: {
    navbar: (
      <span>
        Lock the conversation, then expand plugin 11 or 14 over its occupied
        neighbors.
      </span>
    ),
    mainStage: {
      transcript: Array.from({ length: 30 }, (_, index) => ({
        id: String(index),
        author: "AGENT",
        content: `Message ${index + 1} · Read older messages while the stage stays pinned.`,
      })),
      composer: ({ locked, setLocked, setExpanded }) => (
        <>
          <Composer />
          <button onClick={() => setLocked(!locked)}>
            Host {locked ? "unlock" : "lock"}
          </button>
          <button onClick={() => setExpanded(false)}>Host collapse</button>
        </>
      ),
    },
  },
};

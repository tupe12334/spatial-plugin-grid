import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { MainStage, SpatialPluginGrid } from "../src";
import { StageExample } from "./Workspace.stories";
export default {
  title: "MainStage",
  component: MainStage,
  render: () => <StageExample />,
} satisfies Meta<typeof MainStage>;
export const Populated: StoryObj<typeof MainStage> = {};
export const Empty: StoryObj<typeof MainStage> = {
  render: () => <StageExample empty />,
};
export const HostRenderProps: StoryObj<typeof MainStage> = {
  args: {
    expanded: false,
    onExpandedChange: () => {},
    transcript: ({ expanded }) => (
      <p>Host transcript · {expanded ? "expanded" : "collapsed"}</p>
    ),
    composer: ({ setExpanded }) => (
      <button onClick={() => setExpanded(true)}>Host composer</button>
    ),
  },
  render: function HostStage(args) {
    const [expanded, setExpanded] = useState(false);
    return (
      <div
        className="spg-root demo-theme"
        style={{ position: "relative", height: 320 }}
      >
        <MainStage
          {...args}
          expanded={expanded}
          onExpandedChange={setExpanded}
        />
      </div>
    );
  },
};

export const AppendingTranscript: StoryObj<typeof MainStage> = {
  render: function AppendingStage() {
    const [count, setCount] = useState(30);
    const [revision, setRevision] = useState(0);
    return (
      <div className="spg-root demo-theme" style={{ height: 320 }}>
        <MainStage
          expanded={false}
          onExpandedChange={() => {}}
          title={`Conversation ${revision}`}
          transcript={Array.from({ length: count }, (_, index) => ({
            id: String(index),
            author: "AGENT",
            content: `Message ${index + 1}`,
          }))}
          composer={
            <>
              <button onClick={() => setCount(count + 1)}>
                Append message
              </button>
              <button onClick={() => setRevision(revision + 1)}>
                Rerender
              </button>
            </>
          }
        />
      </div>
    );
  },
};

export const ResizingTranscript: StoryObj<typeof MainStage> = {
  render: () => (
    <SpatialPluginGrid
      className="demo-theme"
      plugins={[]}
      mainStage={{
        transcript: Array.from({ length: 30 }, (_, index) => ({
          id: String(index),
          author: "AGENT",
          content: `Message ${index + 1}`,
        })),
        composer: <input aria-label="Message" />,
      }}
    />
  ),
};

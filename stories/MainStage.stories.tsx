import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { MainStage } from "../src";
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

import { MainStage, type MainStageProps } from "../../MainStage";
import { definePlugin } from "../../grid/contract";
export type AgentPluginOptions = Omit<
  MainStageProps,
  "expanded" | "onExpandedChange" | "locked" | "onLockedChange"
> & { id: string };
/** Conversation behavior is an ordinary plugin; the grid never interprets it. */
export function createAgentPlugin({ id, ...props }: AgentPluginOptions) {
  return definePlugin({
    id,
    title: props.title ?? "Main stage",
    layout: {
      anchor: "bottom-left",
      states: {
        collapsed: { rows: 1, columns: 2 },
        expanded: { rows: 2, columns: 2 },
      },
      transitions: { collapsed: ["expanded"], expanded: ["collapsed"] },
    },
    render: ({ state, transitionTo, pinned, setPinned }) => (
      <MainStage
        {...props}
        expanded={state === "expanded"}
        onExpandedChange={(expanded) =>
          transitionTo(expanded ? "expanded" : "collapsed")
        }
        locked={pinned}
        onLockedChange={setPinned}
      />
    ),
  });
}

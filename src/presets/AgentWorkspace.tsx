import type { ReactNode } from "react";
import { DirectionalControls } from "./DirectionalControls";
import {
  SpatialPluginGrid,
  type SpatialPluginGridProps,
} from "../SpatialPluginGrid";
import type { MainStageProps } from "../MainStage";
import { defaultGrid, definePlugin, defineWorkspace } from "../grid/contract";
import type { Alignment, Footprint } from "../grid/types";
import { createAgentPlugin } from "../plugins/agent/createAgentPlugin";
import {
  useLayoutTakeover,
  type LayoutTakeoverOptions,
} from "../layout/useLayoutTakeover";
import {
  agentWorkspace,
  validateRegistry,
  type LayoutPreset,
  type PluginSize,
  type RegistryEntry,
} from "./groupedLayout";
export interface GroupedPluginContext {
  size: PluginSize;
  expanded: boolean;
  setSize: (size: PluginSize) => void;
  shrink: () => void;
}
export interface GroupedPluginDefinition extends RegistryEntry {
  render: (context: GroupedPluginContext) => ReactNode;
}
export interface AgentWorkspaceProps
  extends Pick<
    SpatialPluginGridProps,
    "navbar" | "className" | "style" | "dir" | "onPluginError"
  > {
  plugins: readonly GroupedPluginDefinition[];
  mainStage?: Omit<
    MainStageProps,
    "expanded" | "onExpandedChange" | "locked" | "onLockedChange"
  >;
  preset?: LayoutPreset;
  /** Covers host-defined regions while retaining the compact stage and committed base state. */
  takeover?: LayoutTakeoverOptions;
  onPluginSizeChange?: (id: string, size: PluginSize) => void;
  onStageLockedChange?: (locked: boolean) => void;
  onStageExpandedChange?: (expanded: boolean) => void;
}
const footprints: Record<PluginSize, Footprint> = {
  "1x1": { rows: 1, columns: 1 },
  "2x1": { rows: 1, columns: 2 },
  "1x2": { rows: 2, columns: 1 },
  "2x2": { rows: 2, columns: 2 },
};
/** Optional historical grouped composition, implemented entirely through registration. */
export function AgentWorkspace({
  plugins,
  mainStage,
  preset = agentWorkspace,
  takeover,
  onPluginSizeChange,
  onStageLockedChange,
  onStageExpandedChange,
  ...props
}: AgentWorkspaceProps) {
  validateRegistry(plugins);
  let workspace = defineWorkspace(defaultGrid);
  for (const plugin of plugins) {
    const row = Number(plugin.home[0]),
      column = Number(plugin.home[1]);
    const alignment: Alignment =
      row === 1
        ? column % 2
          ? "top-left"
          : "top-right"
        : column % 2
          ? "bottom-left"
          : "bottom-right";
    const states = Object.fromEntries(
      plugin.allowedSizes.map((size) => [size, footprints[size]]),
    );
    const transitions = Object.fromEntries(
      plugin.allowedSizes.map((size) => [
        size,
        plugin.allowedSizes.filter((target) => target !== size),
      ]),
    );
    const definition = definePlugin({
      id: plugin.id,
      title: plugin.title,
      layout: { anchor: alignment, states, transitions },
      render: ({ state, transitionTo, reset }) => {
        const size = plugin.allowedSizes.find((size) => size === state);
        if (!size) throw new Error(`Invalid grouped state ${state}`);
        return (
          <div
            className="spg-directional-panel"
            data-horizontal-edge={alignment.endsWith("left") ? "right" : "left"}
          >
            <DirectionalControls
              title={plugin.title}
              current={footprints[size]}
              targets={transitions[size] ?? []}
              states={footprints}
              alignment={alignment}
              transitionTo={transitionTo}
            />
            <div className="spg-plugin-header">
              <span className="spg-home">{plugin.home}</span>
            </div>
            <div className="spg-plugin-body">
              {plugin.render({
                size,
                expanded: size !== "1x1",
                setSize: transitionTo,
                shrink: reset,
              })}
            </div>
          </div>
        );
      },
    });
    workspace = workspace.placeDynamic(definition, {
      anchor: { row, column },
      initialState: "1x1",
      animate: false,
      onStateChange: (state) => {
        const size = plugin.allowedSizes.find((size) => size === state);
        if (size) onPluginSizeChange?.(plugin.id, size);
      },
    });
  }
  workspace = workspace.place(
    createAgentPlugin({ id: "agent", ...mainStage }),
    {
      anchor: { row: 3, column: 2 },
      initialState: "collapsed",
      appearance: "main-stage",
      onStateChange: (state) => onStageExpandedChange?.(state === "expanded"),
      onPinnedChange: (pinned) => onStageLockedChange?.(pinned),
    },
  );
  const overlay = useLayoutTakeover(
    takeover ?? { open: false, onOpenChange: () => {}, regions: [] },
  );
  return (
    <SpatialPluginGrid
      {...props}
      workspace={workspace}
      overlay={overlay}
      {...(takeover?.focus ? { overlayFocus: takeover.focus } : {})}
      presentationStates={takeover?.open ? { agent: "collapsed" } : {}}
      onOverlayDismiss={() => takeover?.onOpenChange(false)}
      gap={preset.gap}
      padding={preset.padding}
      navbarHeight={preset.navbarHeight}
      label={preset.name}
    />
  );
}

export { SpatialPluginGrid } from "./SpatialPluginGrid";
export type { SpatialPluginGridProps } from "./SpatialPluginGrid";
export {
  defineGrid,
  definePlugin,
  defineWorkspace,
  defaultGrid,
  validatePlacement,
  validatePlugin,
  rectangleAt,
  intersects,
} from "./grid/contract";
export type {
  Alignment,
  Axis,
  Coordinate,
  Dimension,
  Footprint,
  GridDefinition,
  Placement,
  PluginContext,
  PluginDefinition,
  PluginInstance,
  Rectangle,
  Region,
  CompatibleAnchor,
  States,
  StateName,
  Transitions,
  ValidAnchor,
  Workspace,
} from "./grid/types";
export { createAgentPlugin } from "./plugins/agent/createAgentPlugin";
export type { AgentPluginOptions } from "./plugins/agent/createAgentPlugin";
export { AgentWorkspace } from "./presets/AgentWorkspace";
export type {
  AgentWorkspaceProps,
  GroupedPluginDefinition,
  GroupedPluginContext,
} from "./presets/AgentWorkspace";
export { MainStage } from "./MainStage";
export type {
  MainStageProps,
  StageRenderContext,
  TranscriptEntry,
} from "./MainStage";
export {
  agentWorkspace,
  geometry,
  pluginHomes,
  sizesFor,
  validateRegistry,
} from "./presets/groupedLayout";
export type {
  LayoutPreset,
  PluginHome,
  PluginSize,
  Rect,
  RegistryEntry,
} from "./presets/groupedLayout";
import "./styles.css";

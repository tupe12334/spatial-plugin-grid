import {
  Component,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  agentWorkspace,
  geometry,
  intersects,
  validateRegistry,
  type LayoutPreset,
  type PluginSize,
  type Rect,
  type RegistryEntry,
} from "./layout";
import { MainStage, type MainStageProps } from "./MainStage";
export interface PluginRenderContext {
  size: PluginSize;
  expanded: boolean;
  setSize: (size: PluginSize) => void;
  shrink: () => void;
}
export interface PluginDefinition extends RegistryEntry {
  render: (context: PluginRenderContext) => ReactNode;
}
export interface SpatialPluginGridProps {
  plugins: readonly PluginDefinition[];
  mainStage?: Omit<MainStageProps, "expanded" | "onExpandedChange">;
  preset?: LayoutPreset;
  navbar?: ReactNode;
  className?: string;
  style?: CSSProperties;
  dir?: "ltr" | "rtl";
  onPluginSizeChange?: (id: string, size: PluginSize) => void;
  onStageExpandedChange?: (expanded: boolean) => void;
  onPluginError?: (id: string, error: Error, info: ErrorInfo) => void;
}
class PluginBoundary extends Component<
  {
    children: ReactNode;
    id: string;
    onError: SpatialPluginGridProps["onPluginError"];
  },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(this.props.id, error, info);
  }
  render() {
    return this.state.failed ? (
      <p role="alert">This plugin could not render.</p>
    ) : (
      this.props.children
    );
  }
}
function PluginContent({
  plugin,
  context,
}: {
  plugin: PluginDefinition;
  context: PluginRenderContext;
}) {
  return plugin.render(context);
}
interface State {
  sizes: Record<string, PluginSize>;
  layers: Record<string, number>;
  clock: number;
  stage: boolean;
  stageLayer: number;
  stageCover: boolean;
}
const stageRect = (expanded: boolean): Rect => ({
  column: 2,
  row: expanded ? 2 : 3,
  columns: 2,
  rows: expanded ? 2 : 1,
});
export function SpatialPluginGrid({
  plugins,
  mainStage,
  preset = agentWorkspace,
  navbar,
  className = "",
  style,
  dir,
  onPluginSizeChange,
  onStageExpandedChange,
  onPluginError,
}: SpatialPluginGridProps) {
  validateRegistry(plugins);
  if (
    [preset.gap, preset.padding, preset.navbarHeight].some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  )
    throw new Error("Layout dimensions must be finite and nonnegative");
  const [state, setState] = useState<State>({
    sizes: {},
    layers: {},
    clock: 0,
    stage: false,
    stageLayer: 0,
    stageCover: false,
  });
  const root = useRef<HTMLDivElement>(null);
  const sizeOf = (plugin: PluginDefinition): PluginSize => {
    const size = state.sizes[plugin.id] ?? "1x1";
    return plugin.allowedSizes.includes(size) ? size : "1x1";
  };
  const setSize = (plugin: PluginDefinition, size: PluginSize) => {
    if (!plugin.allowedSizes.includes(size))
      throw new Error(`Size ${size} is not allowed for ${plugin.id}`);
    setState((previous) => ({
      ...previous,
      sizes: { ...previous.sizes, [plugin.id]: size },
      layers: {
        ...previous.layers,
        [plugin.id]: size === "1x1" ? 0 : previous.clock + 1,
      },
      clock: previous.clock + 1,
    }));
    onPluginSizeChange?.(plugin.id, size);
  };
  const setExpanded = (expanded: boolean) => {
    if (state.stage === expanded) return;
    setState((previous) => ({
      ...previous,
      stage: expanded,
      stageCover: true,
      stageLayer: expanded ? previous.clock + 1 : previous.stageLayer,
      clock: previous.clock + 1,
    }));
    onStageExpandedChange?.(expanded);
  };
  useLayoutEffect(() => {
    if (state.stage || !state.stageCover) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const timer = setTimeout(
      () =>
        setState((previous) => ({
          ...previous,
          stageCover: false,
          stageLayer: 0,
        })),
      media.matches ? 0 : 490,
    );
    return () => clearTimeout(timer);
  }, [state.stage, state.stageCover]);
  const items = plugins.map((plugin) => ({
    plugin,
    size: sizeOf(plugin),
    rect: geometry(plugin.home, sizeOf(plugin)),
    layer: sizeOf(plugin) === "1x1" ? 0 : (state.layers[plugin.id] ?? 0),
  }));
  const covered = new Set(
    items
      .filter(
        (item) =>
          items.some(
            (other) =>
              other.layer > item.layer && intersects(other.rect, item.rect),
          ) ||
          (state.stageCover &&
            state.stageLayer > item.layer &&
            intersects(stageRect(true), item.rect)),
      )
      .map((item) => item.plugin.id),
  );
  const stageCovered = items.some(
    (item) =>
      item.layer > state.stageLayer &&
      intersects(item.rect, stageRect(state.stageCover)),
  );
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const panels = Array.from(
      element.querySelectorAll<HTMLElement>("[data-spg-panel]"),
    );
    for (const panel of panels)
      if (panel.dataset.covered !== "true") panel.inert = false;
    for (const panel of panels) {
      const hidden = panel.dataset.covered === "true";
      if (hidden && panel.contains(document.activeElement)) {
        const front = Array.from(
          element.querySelectorAll<HTMLElement>(
            '[data-spg-panel][data-covered="false"]',
          ),
        ).sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];
        front
          ?.querySelector<HTMLElement>('select,button,[tabindex="0"]')
          ?.focus();
      }
      panel.inert = hidden;
    }
  });
  return (
    <div
      ref={root}
      className={`spg-root ${className}`}
      dir={dir}
      style={
        {
          ...style,
          "--spg-gap": `${preset.gap}px`,
          "--spg-padding": `${preset.padding}px`,
          "--spg-navbar-height": `${preset.navbarHeight}px`,
        } as CSSProperties
      }
    >
      <div className="spg-navbar">{navbar}</div>
      <div className="spg-grid" aria-label={preset.name}>
        {items.map(({ plugin, size, rect, layer }) => (
          <section
            key={plugin.id}
            className="spg-plugin"
            data-spg-panel="plugin"
            data-home={plugin.home}
            data-size={size}
            data-covered={covered.has(plugin.id)}
            aria-label={plugin.title}
            style={{
              gridColumn: `${rect.column} / span ${rect.columns}`,
              gridRow: `${rect.row} / span ${rect.rows}`,
              zIndex: layer,
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSize(plugin, "1x1");
            }}
          >
            <div className="spg-plugin-header">
              <span className="spg-home">{plugin.home}</span>
              <label>
                <span className="spg-sr-only">{plugin.title} size</span>
                <select
                  value={size}
                  onChange={(event) => {
                    const selected = plugin.allowedSizes.find(
                      (value) => value === event.target.value,
                    );
                    if (selected) setSize(plugin, selected);
                  }}
                >
                  {plugin.allowedSizes.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="spg-plugin-body">
              <PluginBoundary
                key={plugin.id}
                id={plugin.id}
                onError={onPluginError}
              >
                <PluginContent
                  plugin={plugin}
                  context={{
                    size,
                    expanded: size !== "1x1",
                    setSize: (value) => setSize(plugin, value),
                    shrink: () => setSize(plugin, "1x1"),
                  }}
                />
              </PluginBoundary>
            </div>
          </section>
        ))}
        <div
          className="spg-stage"
          data-spg-panel="stage"
          data-covered={stageCovered}
          data-expanded={state.stage}
          style={{ zIndex: state.stageLayer }}
          onTransitionEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              event.propertyName === "height" &&
              !state.stage
            )
              setState((previous) => ({
                ...previous,
                stageCover: false,
                stageLayer: 0,
              }));
          }}
        >
          <MainStage
            {...mainStage}
            expanded={state.stage}
            onExpandedChange={setExpanded}
          />
        </div>
      </div>
    </div>
  );
}

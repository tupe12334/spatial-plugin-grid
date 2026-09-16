import {
  Component,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { defaultGrid, defineWorkspace, intersects } from "./grid/contract";
import { useMovement } from "./grid/useMovement";
import { sameAnchor } from "./grid/movement";
import type {
  Coordinate,
  PluginContext,
  PluginInstance,
  Rectangle,
  Workspace,
} from "./grid/types";
export interface SpatialPluginGridProps {
  workspace?: Workspace;
  dragAndDrop?: boolean;
  onPluginsMoved?: (placements: Readonly<Record<string, Coordinate>>) => void;
  navbar?: ReactNode;
  navbarHeight?: number;
  gap?: number;
  padding?: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
  dir?: "ltr" | "rtl";
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
function Content({
  plugin,
  context,
}: {
  plugin: PluginInstance;
  context: PluginContext<string>;
}) {
  return plugin.render(context);
}
interface Entry {
  state: string;
  pinned: boolean;
  layer: number;
  cover: Rectangle | null;
  revision: number;
  settleAt: number;
}
interface State {
  entries: ReadonlyMap<string, Entry>;
  clock: number;
}
const empty = defineWorkspace(defaultGrid);
function union(a: Rectangle, b: Rectangle): Rectangle {
  const row = Math.min(a.row, b.row),
    column = Math.min(a.column, b.column);
  return {
    row,
    column,
    rows: Math.max(a.row + a.rows, b.row + b.rows) - row,
    columns: Math.max(a.column + a.columns, b.column + b.columns) - column,
  };
}
function initial(plugin: PluginInstance): Entry {
  return {
    state: plugin.initialState,
    pinned: false,
    layer: 0,
    cover: null,
    revision: 0,
    settleAt: 0,
  };
}
export function SpatialPluginGrid({
  workspace = empty,
  dragAndDrop = false,
  onPluginsMoved,
  navbar,
  navbarHeight = 64,
  gap = 12,
  padding = 12,
  label = "Plugin workspace",
  className = "",
  style,
  dir,
  onPluginError,
}: SpatialPluginGridProps) {
  if ([navbarHeight, gap, padding].some((n) => !Number.isFinite(n) || n < 0))
    throw new Error("Layout dimensions must be finite and nonnegative");
  const [state, setState] = useState<State>({ entries: new Map(), clock: 0 });
  const committed = useRef(state),
    pending = useRef<State | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState({
    workspace,
    plugins: workspace.plugins,
  });
  const plugins =
    placement.workspace === workspace ? placement.plugins : workspace.plugins;
  useLayoutEffect(() => {
    setPlacement((previous) =>
      previous.workspace === workspace
        ? previous
        : { workspace, plugins: workspace.plugins },
    );
  }, [workspace]);
  useLayoutEffect(() => {
    committed.current = state;
    pending.current = null;
  });
  const entryOf = (plugin: PluginInstance, source = state) =>
    source.entries.get(plugin.id) ?? initial(plugin);
  const change = (
    plugin: PluginInstance,
    update: { state?: string; pinned?: boolean },
    reset = false,
  ) => {
    const source = pending.current ?? committed.current,
      current = entryOf(plugin, source);
    const name = update.state ?? current.state;
    if (!Object.hasOwn(plugin.rectangles, name))
      throw new Error(`Plugin ${plugin.id}: unknown state ${name}`);
    if (name !== current.state) {
      if (entryOf(plugin, committed.current).pinned || current.pinned) return;
      if (!reset && !plugin.transitions[current.state]?.includes(name))
        throw new Error(
          `Plugin ${plugin.id}: transition ${current.state} → ${name} is not allowed`,
        );
    }
    const pinned = update.pinned ?? current.pinned;
    if (name === current.state && pinned === current.pinned) return;
    const revision = source.clock + 1;
    const next: Entry = {
      state: name,
      pinned,
      revision,
      settleAt: name !== current.state ? Date.now() + 490 : current.settleAt,
      layer:
        name === current.state
          ? current.layer
          : name === plugin.initialState
            ? plugin.animate
              ? current.layer
              : 0
            : revision,
      cover:
        name !== current.state && plugin.animate
          ? union(
              current.cover ?? plugin.rectangles[current.state]!,
              plugin.rectangles[name]!,
            )
          : current.cover,
    };
    const nextState = {
      entries: new Map(source.entries).set(plugin.id, next),
      clock: revision,
    };
    pending.current = nextState;
    setState(nextState);
    if (name !== current.state) plugin.onStateChange(name);
    if (pinned !== current.pinned) plugin.onPinnedChange(pinned);
  };
  useLayoutEffect(() => {
    const live = new Set(workspace.plugins.map((p) => p.id));
    if ([...state.entries.keys()].some((id) => !live.has(id)))
      setState((previous) => ({
        ...previous,
        entries: new Map([...previous.entries].filter(([id]) => live.has(id))),
      }));
  }, [workspace, state.entries]);
  useLayoutEffect(() => {
    const timers = workspace.plugins.flatMap((plugin) => {
      const entry = state.entries.get(plugin.id);
      if (!entry?.cover) return [];
      const timer = setTimeout(
        () =>
          setState((previous) => {
            const latest = previous.entries.get(plugin.id);
            if (!latest || latest.revision !== entry.revision) return previous;
            return {
              ...previous,
              entries: new Map(previous.entries).set(plugin.id, {
                ...latest,
                cover: null,
                layer: latest.state === plugin.initialState ? 0 : latest.layer,
              }),
            };
          }),
        matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : Math.max(0, entry.settleAt - Date.now()),
      );
      return [timer];
    });
    return () => timers.forEach(clearTimeout);
  }, [state.entries, workspace]);
  const items = plugins.map((plugin) => {
    const entry = entryOf(plugin),
      rect = plugin.rectangles[entry.state];
    if (!rect)
      throw new Error(
        `Plugin ${plugin.id}: current state ${entry.state} was removed; remount the grid to replace its contract`,
      );
    return {
      plugin,
      entry,
      rect,
      layer: entry.pinned ? state.clock + 1 + entry.layer : entry.layer,
    };
  });
  const covered = new Set(
    items
      .filter((item) =>
        items.some(
          (other) =>
            other.layer > item.layer &&
            intersects(other.entry.cover ?? other.rect, item.rect),
        ),
      )
      .map((item) => item.plugin.id),
  );
  const movable = items.map(({ plugin, entry }) => ({
    plugin,
    ...entry,
    covered: covered.has(plugin.id),
  }));
  const movement = useMovement({
    workspace,
    enabled: dragAndDrop,
    items: movable,
    grid,
    onMove: (next) => {
      setPlacement({ workspace, plugins: next });
      onPluginsMoved?.(
        Object.fromEntries(
          next.map((plugin) => [plugin.id, { ...plugin.anchor }]),
        ),
      );
    },
  });
  useLayoutEffect(() => {
    const panels = Array.from(
      root.current?.querySelectorAll<HTMLElement>("[data-spg-panel]") ?? [],
    );
    for (const panel of panels)
      if (panel.dataset.covered !== "true") panel.inert = false;
    for (const panel of panels) {
      const hidden = panel.dataset.covered === "true";
      if (hidden && panel.contains(document.activeElement)) {
        const front = panels
          .filter((p) => p.dataset.covered !== "true")
          .sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];
        (
          front?.querySelector<HTMLElement>('select,button,[tabindex="0"]') ??
          front
        )?.focus();
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
          "--spg-gap": `${gap}px`,
          "--spg-padding": `${padding}px`,
          "--spg-navbar-height": `${navbarHeight}px`,
        } as CSSProperties
      }
    >
      <div className="spg-navbar">{navbar}</div>
      <div
        ref={grid}
        className="spg-grid"
        aria-label={label}
        style={{
          gridTemplateColumns: `repeat(${workspace.grid.columns.length},minmax(0,1fr))`,
          gridTemplateRows: `repeat(${workspace.grid.rows.length},minmax(0,1fr))`,
        }}
      >
        {items.map(({ plugin, entry, rect, layer }) => {
          const base = plugin.rectangles[plugin.initialState]!;
          const width = rect.columns / base.columns,
            height = rect.rows / base.rows;
          const dimension = (ratio: number) =>
            `calc(${ratio * 100}% + ${(ratio - 1) * gap}px)`;
          return (
            <section
              key={plugin.id}
              className={`spg-frame ${plugin.appearance === "main-stage" ? "spg-stage" : "spg-plugin"}${dragAndDrop ? " spg-draggable" : ""}`}
              data-spg-panel="plugin"
              data-plugin-id={plugin.id}
              data-drag-source={movement.drag?.id === plugin.id || undefined}
              data-home={`${plugin.anchor.row}${plugin.anchor.column}`}
              data-size={entry.state}
              data-state={entry.state}
              data-at-home={entry.state === plugin.initialState}
              data-pinned={entry.pinned}
              data-covered={covered.has(plugin.id)}
              aria-label={plugin.title}
              tabIndex={-1}
              style={{
                gridColumn: `${base.column} / span ${base.columns}`,
                gridRow: `${base.row} / span ${base.rows}`,
                alignSelf: plugin.alignment.startsWith("bottom")
                  ? "end"
                  : "start",
                justifySelf: plugin.alignment.endsWith("right")
                  ? "end"
                  : "start",
                width: dimension(width),
                height: dimension(height),
                zIndex: layer,
                transition: plugin.animate ? undefined : "none",
              }}
              onTransitionEnd={(event) => {
                if (
                  event.target === event.currentTarget &&
                  ["height", "width"].includes(event.propertyName)
                )
                  setState((previous) => {
                    const latest = previous.entries.get(plugin.id);
                    if (!latest?.cover) return previous;
                    return {
                      ...previous,
                      entries: new Map(previous.entries).set(plugin.id, {
                        ...latest,
                        cover: null,
                        layer:
                          latest.state === plugin.initialState
                            ? 0
                            : latest.layer,
                      }),
                    };
                  });
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape")
                  change(plugin, { state: plugin.initialState }, true);
              }}
            >
              {dragAndDrop && (
                <div className="spg-move-toolbar">
                  <button
                    {...movement.handle({
                      plugin,
                      ...entry,
                      covered: covered.has(plugin.id),
                    })}
                  >
                    ⠿ Move
                  </button>
                </div>
              )}
              <PluginBoundary id={plugin.id} onError={onPluginError}>
                <Content
                  plugin={plugin}
                  context={{
                    state: entry.state,
                    pinned: entry.pinned,
                    transitionTo: (name) => change(plugin, { state: name }),
                    reset: () =>
                      change(plugin, { state: plugin.initialState }, true),
                    setPinned: (pinned) => change(plugin, { pinned }),
                  }}
                />
              </PluginBoundary>
            </section>
          );
        })}
        {movement.targets.map((target) => (
          <div
            key={`${target.row}:${target.column}`}
            className="spg-drop-target"
            data-drop-target={`${target.row}${target.column}`}
            data-drop-hover={
              !!movement.drag?.target &&
              sameAnchor(target, movement.drag.target)
            }
            style={{ gridRow: target.row, gridColumn: target.column }}
          />
        ))}
      </div>
      {dragAndDrop && (
        <p className="spg-sr-only" role="status" aria-live="polite">
          {movement.announcement}
        </p>
      )}
    </div>
  );
}

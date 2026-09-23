import { z } from "zod";
import type {
  Alignment,
  Axis,
  Coordinate,
  Footprint,
  GridDefinition,
  Placement,
  PluginDefinition,
  PluginInstance,
  Rectangle,
  StateName,
  States,
  CompatibleAnchor,
  Region,
  MinimumCheck,
  Workspace,
} from "./types";
const dimension = z.number().int().min(1).max(8);
const footprint = z.object({ rows: dimension, columns: dimension });
const coordinate = z.object({ row: dimension, column: dimension });
const rectangle = coordinate.extend({ rows: dimension, columns: dimension });
const gridSchema = z.object({
  rows: z.array(dimension).min(1).max(8),
  columns: z.array(dimension).min(1).max(8),
});
const definitionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  layout: z.object({
    anchor: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]),
    states: z.record(z.string().min(1), footprint),
    transitions: z.record(z.string(), z.array(z.string())),
    minimum: footprint.optional(),
  }),
  render: z.custom<(context: never) => unknown>(
    (value) => typeof value === "function",
  ),
});
const placementSchema = z.object({
  anchor: coordinate,
  draggable: z.boolean().optional(),
  allowedAnchors: z.array(coordinate).optional(),
  initialState: z.string(),
  appearance: z.enum(["panel", "main-stage", "overlay"]).optional(),
  animate: z.boolean().optional(),
  region: rectangle.optional(),
});
function validateGrid(value: unknown) {
  const grid = gridSchema.parse(value);
  for (const axis of [grid.rows, grid.columns])
    if (axis.some((n, index) => n !== index + 1))
      throw new Error(
        "Grid axes must enumerate consecutive cells starting at 1",
      );
  return grid;
}
export function defineGrid<const R extends Axis, const C extends Axis>(
  grid: GridDefinition<R, C>,
): GridDefinition<R, C> {
  validateGrid(grid);
  Object.freeze(grid.rows);
  Object.freeze(grid.columns);
  return Object.freeze(grid);
}
/** The schema and domain rules are also usable at untyped JS/JSON boundaries. */
export function validatePlugin(value: unknown): void {
  const plugin = definitionSchema.parse(value);
  const { states, transitions, minimum } = plugin.layout;
  if (!Object.keys(states).length)
    throw new Error(`Plugin ${plugin.id} needs at least one state`);
  for (const [name, size] of Object.entries(states)) {
    if (minimum && (size.rows < minimum.rows || size.columns < minimum.columns))
      throw new Error(
        `Plugin ${plugin.id}, state ${name}: footprint ${size.rows}x${size.columns} violates minimum ${minimum.rows}x${minimum.columns}`,
      );
    if (!Object.hasOwn(transitions, name))
      throw new Error(`Plugin ${plugin.id}: missing transitions for ${name}`);
  }
  for (const [name, targets] of Object.entries(transitions)) {
    if (
      !Object.hasOwn(states, name) ||
      targets.some((target) => !Object.hasOwn(states, target))
    )
      throw new Error(
        `Plugin ${plugin.id}: unknown transition state at ${name}`,
      );
    if (new Set(targets).size !== targets.length)
      throw new Error(`Plugin ${plugin.id}: duplicate transition at ${name}`);
  }
}
export function definePlugin<
  const S extends States,
  const A extends Alignment,
  const M extends Footprint | undefined = undefined,
>(
  definition: PluginDefinition<S, A> & {
    layout: { minimum?: M; states: MinimumCheck<S, M> };
  },
): PluginDefinition<S, A> {
  validatePlugin(definition);
  // Freeze contract data so registration validation cannot later be invalidated.
  for (const size of Object.values(definition.layout.states))
    Object.freeze(size);
  for (const edges of Object.values(definition.layout.transitions))
    Object.freeze(edges);
  Object.freeze(definition.layout.states);
  Object.freeze(definition.layout.transitions);
  if (definition.layout.minimum) Object.freeze(definition.layout.minimum);
  Object.freeze(definition.layout);
  return Object.freeze(definition);
}
export function rectangleAt(
  anchor: Coordinate,
  alignment: Alignment,
  size: Pick<Rectangle, "rows" | "columns">,
): Rectangle {
  return {
    row: anchor.row - (alignment.startsWith("bottom") ? size.rows - 1 : 0),
    column:
      anchor.column - (alignment.endsWith("right") ? size.columns - 1 : 0),
    rows: size.rows,
    columns: size.columns,
  };
}
export function intersects(a: Rectangle, b: Rectangle): boolean {
  return (
    a.column < b.column + b.columns &&
    b.column < a.column + a.columns &&
    a.row < b.row + b.rows &&
    b.row < a.row + a.rows
  );
}
function contains(outer: Rectangle, inner: Rectangle) {
  return (
    inner.row >= outer.row &&
    inner.column >= outer.column &&
    inner.row + inner.rows <= outer.row + outer.rows &&
    inner.column + inner.columns <= outer.column + outer.columns
  );
}
export function validatePlacement(
  gridValue: unknown,
  definitionValue: unknown,
  placementValue: unknown,
): Readonly<Record<string, Rectangle>> {
  const grid = validateGrid(gridValue);
  validatePlugin(definitionValue);
  const plugin = definitionSchema.parse(definitionValue);
  const placement = placementSchema.parse(placementValue);
  if (!Object.hasOwn(plugin.layout.states, placement.initialState))
    throw new Error(
      `Plugin ${plugin.id}: unknown initial state ${placement.initialState}`,
    );
  const boundary = {
    row: 1,
    column: 1,
    rows: grid.rows.length,
    columns: grid.columns.length,
  };
  if (placement.region && !contains(boundary, placement.region))
    throw new Error(`Plugin ${plugin.id}: region leaves grid boundary`);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(plugin.layout.states).map(([name, size]) => {
        const rect = rectangleAt(placement.anchor, plugin.layout.anchor, size);
        for (const [label, bound] of [
          ["grid", boundary],
          ["region", placement.region],
        ] as const) {
          if (bound && !contains(bound, rect))
            throw new Error(
              `Plugin ${plugin.id}, state ${name}, anchor (${placement.anchor.row},${placement.anchor.column}), footprint ${size.rows}x${size.columns}: leaves ${label} boundary`,
            );
        }
        return [name, Object.freeze(rect)];
      }),
    ),
  );
}
function hasState<S extends States>(
  states: S,
  name: string,
): name is StateName<S> {
  return Object.hasOwn(states, name);
}
class WorkspaceBuilder<G extends GridDefinition<Axis, Axis>>
  implements Workspace
{
  readonly plugins: readonly PluginInstance[];
  constructor(
    readonly grid: G,
    plugins: readonly PluginInstance[] = [],
  ) {
    this.plugins = Object.freeze([...plugins]);
    Object.freeze(this);
  }
  place<
    const S extends States,
    const A extends Alignment,
    const R extends Region | undefined = undefined,
  >(
    plugin: PluginDefinition<S, A>,
    placement: Omit<
      Placement<
        StateName<NoInfer<S>>,
        Coordinate & CompatibleAnchor<G, NoInfer<S>, NoInfer<A>, NoInfer<R>>
      >,
      "region"
    > & { readonly region?: R },
  ): WorkspaceBuilder<G> {
    return this.placeDynamic(plugin, placement);
  }
  /** Explicit runtime-only boundary for dynamic configuration. All geometry is still validated. */
  placeDynamic<S extends States, A extends Alignment>(
    plugin: PluginDefinition<S, A>,
    placement: Placement<StateName<S>>,
  ): WorkspaceBuilder<G> {
    const rectangles = validatePlacement(this.grid, plugin, placement);
    const allowedAnchors = placement.allowedAnchors?.map((anchor) =>
      Object.freeze({ ...anchor }),
    );
    for (const anchor of allowedAnchors ?? [])
      validatePlacement(this.grid, plugin, { ...placement, anchor });
    const region = placement.region
      ? Object.freeze({ ...placement.region })
      : undefined;
    const movementPlacement = { ...placement, region };
    const rect = rectangles[placement.initialState]!;
    for (const existing of this.plugins) {
      if (existing.id === plugin.id)
        throw new Error(`Duplicate plugin id: ${plugin.id}`);
      if (intersects(rect, existing.rectangles[existing.initialState]!))
        throw new Error(
          `Initial occupancy overlap: ${plugin.id} and ${existing.id}`,
        );
    }
    const instance: PluginInstance = Object.freeze({
      id: plugin.id,
      title: plugin.title,
      initialState: placement.initialState,
      appearance: placement.appearance ?? "panel",
      animate: placement.animate ?? true,
      anchor: Object.freeze({ ...placement.anchor }),
      alignment: plugin.layout.anchor,
      draggable: placement.draggable ?? true,
      rectanglesAt: (anchor: Coordinate) => {
        if (
          allowedAnchors &&
          !allowedAnchors.some(
            (value) =>
              value.row === anchor.row && value.column === anchor.column,
          )
        )
          return null;
        try {
          return validatePlacement(this.grid, plugin, {
            ...movementPlacement,
            anchor,
          });
        } catch {
          return null;
        }
      },
      rectangles,
      transitions: Object.freeze(
        Object.fromEntries(
          Object.entries(plugin.layout.transitions).map(([key, edges]) => [
            key,
            Object.freeze([...edges]),
          ]),
        ),
      ),
      render: (context: import("./types").PluginContext<string>) => {
        if (!hasState(plugin.layout.states, context.state))
          throw new Error(
            `Plugin ${plugin.id}: unknown state ${context.state}`,
          );
        return plugin.render({ ...context, state: context.state });
      },
      onStateChange: (state: string) => {
        if (hasState(plugin.layout.states, state))
          placement.onStateChange?.(state);
      },
      onPinnedChange: (pinned: boolean) => placement.onPinnedChange?.(pinned),
    });
    return new WorkspaceBuilder(this.grid, [...this.plugins, instance]);
  }
}
export function defineWorkspace<G extends GridDefinition<Axis, Axis>>(
  grid: G,
): WorkspaceBuilder<G> {
  defineGrid(grid);
  return new WorkspaceBuilder(grid);
}
export const defaultGrid = defineGrid({
  rows: [1, 2, 3],
  columns: [1, 2, 3, 4],
});

import { z } from "zod";
import { intersects } from "../grid/contract";
import type { PluginInstance, Workspace } from "../grid/types";

const dimension = z.number().int().positive();
const rectangleSchema = z.object({
  row: dimension,
  column: dimension,
  rows: dimension,
  columns: dimension,
});

/** Overlay regions are disjoint, bounded and never aliases of base registrations. */
export function validateOverlays(
  workspace: Workspace,
  overlays: readonly PluginInstance[],
) {
  const ids = new Set(workspace.plugins.map(({ id }) => id));
  const rectangles: z.infer<typeof rectangleSchema>[] = [];
  for (const plugin of overlays) {
    if (ids.has(plugin.id))
      throw new Error(`Duplicate plugin id: ${plugin.id}`);
    ids.add(plugin.id);
    const rect = rectangleSchema.parse(plugin.rectangles[plugin.initialState]);
    if (
      rect.row + rect.rows - 1 > workspace.grid.rows.length ||
      rect.column + rect.columns - 1 > workspace.grid.columns.length
    )
      throw new Error("Overlay region exceeds grid bounds");
    if (rectangles.some((other) => intersects(rect, other)))
      throw new Error("Overlay regions must not overlap");
    rectangles.push(rect);
  }
}

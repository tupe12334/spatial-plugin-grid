import { intersects } from "./contract";
import type { Coordinate, PluginInstance, Rectangle } from "./types";

export interface MovableItem {
  readonly plugin: PluginInstance;
  readonly state: string;
  readonly pinned: boolean;
  readonly covered: boolean;
  readonly cover: Rectangle | null;
}
export const sameAnchor = (a: Coordinate, b: Coordinate): boolean =>
  a.row === b.row && a.column === b.column;

/** Validate an entire atomic move, including the reverse leg of a swap. */
export function planMove(
  items: readonly MovableItem[],
  id: string,
  target: Coordinate,
): readonly PluginInstance[] | null {
  const source = items.find((item) => item.plugin.id === id);
  if (
    !source ||
    !source.plugin.draggable ||
    source.pinned ||
    source.covered ||
    source.cover ||
    sameAnchor(source.plugin.anchor, target)
  )
    return null;
  const occupant = items.find((item) => sameAnchor(item.plugin.anchor, target));
  if (
    occupant &&
    (!occupant.plugin.draggable ||
      occupant.pinned ||
      occupant.covered ||
      occupant.cover)
  )
    return null;
  const changed = new Set([id, ...(occupant ? [occupant.plugin.id] : [])]);
  const result: PluginInstance[] = [];
  for (const item of items) {
    if (!changed.has(item.plugin.id)) {
      result.push(item.plugin);
      continue;
    }
    const anchor = item === source ? target : source.plugin.anchor;
    const rectangles = item.plugin.rectanglesAt(anchor);
    if (!rectangles) return null;
    result.push({ ...item.plugin, anchor: { ...anchor }, rectangles });
  }
  // Expansion capacity may overlap, but neither home occupancy nor current
  // occupancy may collide as a consequence of a move. Unchanged overlays are
  // left alone, including their conservative animation covers.
  for (let a = 0; a < items.length; a++) {
    for (let b = a + 1; b < items.length; b++) {
      const left = result[a]!,
        right = result[b]!;
      if (!changed.has(left.id) && !changed.has(right.id)) continue;
      const leftItem = items[a]!,
        rightItem = items[b]!;
      if (
        intersects(
          left.rectangles[left.initialState]!,
          right.rectangles[right.initialState]!,
        ) ||
        intersects(
          leftItem.cover ?? left.rectangles[leftItem.state]!,
          rightItem.cover ?? right.rectangles[rightItem.state]!,
        )
      )
        return null;
    }
  }
  return result;
}

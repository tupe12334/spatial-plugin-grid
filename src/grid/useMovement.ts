import {
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type RefObject,
} from "react";
import type { Coordinate, PluginInstance, Workspace } from "./types";
import { planMove, sameAnchor, type MovableItem } from "./movement";

interface Drag {
  id: string;
  target: Coordinate | null;
  pointerId: number | null;
  offset: Coordinate;
}
interface Options {
  workspace: Workspace;
  enabled: boolean;
  items: readonly MovableItem[];
  grid: RefObject<HTMLDivElement>;
  onMove: (plugins: readonly PluginInstance[]) => void;
}
export function useMovement(options: Options) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announcement, announce] = useState("");
  const live = useRef({ ...options, drag });
  useLayoutEffect(() => {
    live.current = { ...options, drag };
  });
  const signature = JSON.stringify(
    options.items.map(({ plugin, state, pinned, covered, cover }) => [
      plugin.id,
      plugin.anchor,
      state,
      pinned,
      covered,
      cover,
    ]),
  );
  useLayoutEffect(() => {
    if (live.current.drag)
      announce("Move cancelled: layout or permissions changed.");
    live.current.drag = null;
    setDrag(null);
  }, [options.workspace, options.enabled, signature]);
  const cells = options.workspace.grid.rows.flatMap((row) =>
    options.workspace.grid.columns.map((column) => ({ row, column })),
  );
  const targets = drag
    ? cells.filter((cell) => planMove(options.items, drag.id, cell))
    : [];
  const cancel = () => {
    live.current.drag = null;
    setDrag(null);
    announce("Move cancelled.");
  };
  const drop = (target: Coordinate | null) => {
    const current = live.current;
    if (!current.enabled || !current.drag || !target) {
      cancel();
      return;
    }
    const next = planMove(current.items, current.drag.id, target);
    if (!next) {
      cancel();
      return;
    }
    const title = current.items.find(
      (item) => item.plugin.id === current.drag?.id,
    )?.plugin.title;
    live.current.drag = null;
    setDrag(null);
    current.onMove(next);
    announce(`Moved ${title} to ${target.row}${target.column}.`);
  };
  const hitCell = (event: {
    clientX: number;
    clientY: number;
  }): Coordinate | null => {
    const { grid, workspace } = live.current;
    const element = grid.current;
    if (
      !element ||
      document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest(".spg-grid") !== element
    )
      return null;
    const rect = element.getBoundingClientRect(),
      css = getComputedStyle(element);
    const left = parseFloat(css.paddingLeft) || 0,
      right = parseFloat(css.paddingRight) || 0;
    const top = parseFloat(css.paddingTop) || 0,
      bottom = parseFloat(css.paddingBottom) || 0;
    const gapX = parseFloat(css.columnGap) || 0,
      gapY = parseFloat(css.rowGap) || 0;
    const width =
      (rect.width - left - right - gapX * (workspace.grid.columns.length - 1)) /
      workspace.grid.columns.length;
    const height =
      (rect.height - top - bottom - gapY * (workspace.grid.rows.length - 1)) /
      workspace.grid.rows.length;
    const x = event.clientX - rect.left - left,
      y = event.clientY - rect.top - top;
    if (x < 0 || y < 0 || width <= 0 || height <= 0) return null;
    const column = Math.floor(x / (width + gapX)) + 1,
      row = Math.floor(y / (height + gapY)) + 1;
    if (
      column > workspace.grid.columns.length ||
      row > workspace.grid.rows.length ||
      x % (width + gapX) > width ||
      y % (height + gapY) > height
    )
      return null;
    return { row, column };
  };
  const start = (
    id: string,
    pointerId: number | null,
    offset: Coordinate = { row: 0, column: 0 },
  ) => {
    if (!options.enabled) return;
    const target = cells.find((cell) => planMove(options.items, id, cell));
    if (!target) {
      announce("No permitted destinations for this block.");
      return;
    }
    setDrag({
      id,
      target: pointerId === null ? target : null,
      pointerId,
      offset,
    });
    announce(
      `Picked up ${options.items.find((item) => item.plugin.id === id)?.plugin.title}. Target ${target.row}${target.column}. Use arrows to choose, Enter to drop, Escape to cancel.`,
    );
  };
  useLayoutEffect(() => {
    if (!drag) return;
    const hit = (event: PointerEvent): Coordinate | null => {
      const cell = hitCell(event);
      const offset = live.current.drag?.offset;
      return cell && offset
        ? { row: cell.row + offset.row, column: cell.column + offset.column }
        : null;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== live.current.drag?.pointerId) return;
      const target = hit(event);
      setDrag((previous) => (previous ? { ...previous, target } : null));
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId === live.current.drag?.pointerId) drop(hit(event));
    };
    const abort = (event: PointerEvent) => {
      if (event.pointerId === live.current.drag?.pointerId) cancel();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", abort);
    window.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", abort);
      window.removeEventListener("keydown", escape, true);
    };
  }, [drag?.id, drag?.pointerId]);
  const handle = (
    item: MovableItem,
  ): ButtonHTMLAttributes<HTMLButtonElement> => ({
    type: "button",
    className: "spg-move-handle",
    "aria-label": `Move ${item.plugin.title}`,
    "aria-pressed": drag?.id === item.plugin.id,
    title:
      "Drag to move; Enter picks up, arrows choose, Enter drops, Escape cancels",
    disabled:
      !item.plugin.draggable || item.pinned || item.covered || !!item.cover,
    onPointerDown: (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      const grabbed = hitCell(event);
      if (!grabbed) return;
      event.preventDefault();
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      start(item.plugin.id, event.pointerId, {
        row: item.plugin.anchor.row - grabbed.row,
        column: item.plugin.anchor.column - grabbed.column,
      });
    },
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (drag?.id === item.plugin.id) drop(drag.target);
        else start(item.plugin.id, null);
      } else if (drag?.id === item.plugin.id && event.key.startsWith("Arrow")) {
        event.preventDefault();
        const delta =
          event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        const index = targets.findIndex(
          (cell) => drag.target && sameAnchor(cell, drag.target),
        );
        const target =
          targets[(index + delta + targets.length) % targets.length];
        if (target) {
          setDrag({ ...drag, target });
          announce(`Target ${target.row}${target.column}.`);
        }
      }
    },
  });
  return { drag, targets, announcement, handle };
}

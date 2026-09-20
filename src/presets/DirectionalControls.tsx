import type { Alignment, Footprint } from "../grid/types";

/** Geometry-only transitions; equal-footprint and mixed grow/shrink states are not arrows. */
export function directionalChanges<N extends string>(
  current: Footprint,
  targets: readonly N[],
  states: Readonly<Record<N, Footprint>>,
  alignment: Alignment,
) {
  return targets.flatMap((target) => {
    const next = states[target];
    const rows = next.rows - current.rows;
    const columns = next.columns - current.columns;
    if ((!rows && !columns) || rows * columns < 0) return [];
    const vertical = rows
      ? alignment.startsWith("top")
        ? "bottom"
        : "top"
      : "";
    const horizontal = columns
      ? alignment.endsWith("left")
        ? "right"
        : "left"
      : "";
    const edge = [vertical, horizontal].filter(Boolean).join("-");
    const shrinking = rows < 0 || columns < 0;
    const x = columns ? (horizontal === "right" ? 1 : -1) : 0;
    const y = rows ? (vertical === "bottom" ? 1 : -1) : 0;
    return [
      {
        target,
        edge,
        shrinking,
        rotation: (Math.atan2(y, x) * 180) / Math.PI + (shrinking ? 180 : 0),
      },
    ];
  });
}

export function DirectionalControls<N extends string>({
  title,
  current,
  targets,
  states,
  alignment,
  transitionTo,
}: {
  title: string;
  current: Footprint;
  targets: readonly N[];
  states: Readonly<Record<N, Footprint>>;
  alignment: Alignment;
  transitionTo: (state: N) => void;
}) {
  return directionalChanges(current, targets, states, alignment).map(
    ({ target, edge, shrinking, rotation }) => (
      <button
        type="button"
        key={edge}
        className="spg-edge-control"
        data-edge={edge}
        data-target-state={target}
        aria-label={`${shrinking ? "Shrink" : "Expand"} ${title} ${edge} to ${target}`}
        title={`${shrinking ? "Shrink" : "Expand"} ${edge} to ${target}`}
        onClick={() => transitionTo(target)}
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <path
            d="M4 12h16m-6-6 6 6-6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    ),
  );
}

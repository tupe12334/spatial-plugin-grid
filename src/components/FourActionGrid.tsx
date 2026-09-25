import type { ReactNode } from "react";

export interface FourAction<ActionId extends string = string> {
  readonly id: ActionId;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
}

/** Exactly four actions, rendered as a 2×2 grid in reading order. */
export type FourActions<ActionId extends string = string> = readonly [
  FourAction<ActionId>,
  FourAction<ActionId>,
  FourAction<ActionId>,
  FourAction<ActionId>,
];

export interface FourActionGridProps<ActionId extends string = string> {
  readonly id?: string;
  readonly actions: FourActions<ActionId>;
  readonly onAction?: ((id: ActionId) => void) | undefined;
  readonly className?: string | undefined;
}

/**
 * A titleless surface divided into four equal, border-separated action
 * quadrants. Hosts own action IDs, labels, icons and behavior.
 */
export function FourActionGrid<ActionId extends string>({
  id,
  actions,
  onAction,
  className = "",
}: FourActionGridProps<ActionId>) {
  return (
    <div id={id} className={`spg-four-action-grid ${className}`}>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="spg-four-action-grid-action"
          disabled={action.disabled}
          onClick={() => onAction?.(action.id)}
        >
          {action.icon && (
            <span className="spg-four-action-grid-icon" aria-hidden="true">
              {action.icon}
            </span>
          )}
          <span className="spg-four-action-grid-label">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

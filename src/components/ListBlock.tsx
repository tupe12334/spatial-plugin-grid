import type { ReactNode } from "react";

export interface ListItem {
  readonly id: string;
  readonly label: string;
  readonly description?: ReactNode;
  readonly icon?: ReactNode;
  readonly badge?: ReactNode;
  readonly selected?: boolean;
}

export type ListDensity = "compact" | "full";

export interface ListBlockProps {
  readonly id?: string;
  readonly items: readonly ListItem[];
  readonly density?: ListDensity | undefined;
  readonly emptyLabel?: string | undefined;
  readonly onItemActivate?: ((id: string) => void) | undefined;
  readonly className?: string | undefined;
}

function Item({
  item,
  density,
  onActivate,
}: {
  readonly item: ListItem;
  readonly density: ListDensity;
  readonly onActivate: ((id: string) => void) | undefined;
}) {
  const body = (
    <>
      {item.icon && (
        <span className="spg-list-item-icon" aria-hidden="true">
          {item.icon}
        </span>
      )}
      <span className="spg-list-item-main">
        <span className="spg-list-item-label">{item.label}</span>
        {density === "full" && item.description && (
          <span className="spg-list-item-description">{item.description}</span>
        )}
      </span>
      {density === "full" && item.badge != null && (
        <span className="spg-list-item-badge">{item.badge}</span>
      )}
    </>
  );
  const selectable = typeof onActivate === "function";
  return (
    <li className="spg-list-item" data-selected={item.selected || undefined}>
      {selectable ? (
        <button
          type="button"
          className="spg-list-item-button"
          aria-pressed={item.selected}
          onClick={() => onActivate(item.id)}
        >
          {body}
        </button>
      ) : (
        <div className="spg-list-item-static">{body}</div>
      )}
    </li>
  );
}

/**
 * A host-agnostic data list. The library owns structure and styling hooks;
 * items, labels and selection policy belong to the host.
 */
export function ListBlock({
  id,
  items,
  density = "full",
  emptyLabel,
  onItemActivate,
  className = "",
}: ListBlockProps) {
  if (!items.length) {
    return (
      <div id={id} className={`spg-list spg-list-empty ${className}`}>
        <p className="spg-list-empty-label">{emptyLabel ?? "No items"}</p>
      </div>
    );
  }
  return (
    <ul id={id} className={`spg-list ${className}`} data-density={density}>
      {items.map((item) => (
        <Item
          key={item.id}
          item={item}
          density={density}
          onActivate={onItemActivate}
        />
      ))}
    </ul>
  );
}

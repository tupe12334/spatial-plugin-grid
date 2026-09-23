import type { ReactNode } from "react";

export interface ActionBlockProps {
  readonly id?: string;
  readonly label: string;
  readonly description?: ReactNode;
  readonly icon?: ReactNode;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly onActivate: () => void;
  readonly className?: string;
}

/** A whole-card clickable action button, generic across any grid or picker use case. */
export function ActionBlock({
  id,
  label,
  description,
  icon,
  selected,
  disabled = false,
  onActivate,
  className = "",
}: ActionBlockProps) {
  return (
    <button
      type="button"
      id={id}
      className={`spg-action-block ${className}`}
      aria-pressed={selected}
      data-selected={selected || undefined}
      disabled={disabled}
      onClick={onActivate}
    >
      {icon && (
        <span className="spg-action-block-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="spg-action-block-label">{label}</span>
      {description && (
        <span className="spg-action-block-description">{description}</span>
      )}
    </button>
  );
}

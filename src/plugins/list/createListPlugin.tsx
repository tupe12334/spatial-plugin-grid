import { ListBlock, type ListItem } from "../../components/ListBlock";
import { definePlugin } from "../../grid/contract";

export interface ListPluginOptions {
  readonly id: string;
  readonly title: string;
  readonly items: readonly ListItem[];
  readonly emptyLabel?: string;
  readonly onItemActivate?: (id: string) => void;
  readonly className?: string;
}

/**
 * A generic data-driven list plugin. Hosts (and agents that mount plugins on
 * the host's behalf) can present any collection — systems, resources, results
 * — without writing a bespoke plugin per data type.
 */
export function createListPlugin({
  id,
  title,
  items,
  emptyLabel,
  onItemActivate,
  className,
}: ListPluginOptions) {
  return definePlugin({
    id,
    title,
    layout: {
      anchor: "bottom-left",
      states: {
        compact: { rows: 1, columns: 1 },
        expanded: { rows: 1, columns: 2 },
      },
      transitions: { compact: ["expanded"], expanded: ["compact"] },
    },
    render: ({ state }) => (
      <div className="spg-plugin-body">
        <ListBlock
          items={items}
          density={state === "expanded" ? "full" : "compact"}
          emptyLabel={emptyLabel}
          onItemActivate={onItemActivate}
          className={className}
        />
      </div>
    ),
  });
}

import {
  FourActionGrid,
  type FourActions,
} from "../../components/FourActionGrid";
import { definePlugin } from "../../grid/contract";

export interface FourActionGridPluginOptions<ActionId extends string = string> {
  readonly id: string;
  /** Accessible panel name; the surface itself renders no heading. */
  readonly title: string;
  readonly actions: FourActions<ActionId>;
  readonly onAction?: (id: ActionId) => void;
  readonly className?: string;
}

/**
 * A generic single-cell plugin presenting exactly four equal actions. The
 * surface is titleless and edge-to-edge; hosts own labels, icons and behavior.
 */
export function createFourActionGridPlugin<ActionId extends string>({
  id,
  title,
  actions,
  onAction,
  className,
}: FourActionGridPluginOptions<ActionId>) {
  return definePlugin({
    id,
    title,
    layout: {
      anchor: "top-left",
      states: { ready: { rows: 1, columns: 1 } },
      transitions: { ready: [] },
    },
    render: () => (
      <FourActionGrid
        actions={actions}
        onAction={onAction}
        className={className}
      />
    ),
  });
}

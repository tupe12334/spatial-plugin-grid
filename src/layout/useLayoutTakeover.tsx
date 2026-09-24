import type { ReactNode } from "react";
import type { PluginInstance, Rectangle } from "../grid/types";

export interface LayoutTakeoverContext {
  readonly close: () => void;
}

export interface LayoutTakeoverRegion {
  /** Must not collide with any plugin id already on the host's workspace. */
  readonly id: string;
  readonly title: string;
  /** Grid cells this region covers. Cells outside every region are left untouched: not covered, not inert. */
  readonly rect: Rectangle;
  readonly render: (context: LayoutTakeoverContext) => ReactNode;
}

export interface LayoutTakeoverOptions {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** One or more disjoint regions, e.g. a results block plus separate prev/next cells, leaving a retained plugin's cells out entirely. */
  readonly regions: readonly LayoutTakeoverRegion[];
  /**
   * `"first-action"` (default) focuses the first overlay action on open.
   * `"preserve"` leaves focus on whatever retained content already has it,
   * only rescuing focus that the takeover newly covers.
   */
  readonly focus?: "first-action" | "preserve";
}

function TakeoverRegionSurface({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="spg-takeover-region"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {children}
    </div>
  );
}

/**
 * Builds one always-on-top overlay plugin per region. Each covers only its
 * own rectangle (see `appearance: "overlay"` in SpatialPluginGrid), so a
 * plugin outside every region — such as a retained main stage — is never
 * marked covered/inert and keeps its normal place in tab order. Every other
 * plugin on the host's workspace stays completely untouched: pass the
 * result through `overlay`, not merged into `workspace`, so drag placement
 * and per-plugin state (expansion, pin) are never disturbed by open/close.
 */
export function useLayoutTakeover(
  options: LayoutTakeoverOptions,
): readonly PluginInstance[] {
  if (!options.open) return [];
  const seen = new Set<string>();
  const close = () => options.onOpenChange(false);
  return options.regions.map((region) => {
    if (seen.has(region.id))
      throw new Error(`Duplicate takeover region id: ${region.id}`);
    seen.add(region.id);
    return Object.freeze<PluginInstance>({
      id: region.id,
      title: region.title,
      initialState: "open",
      appearance: "overlay",
      animate: true,
      anchor: Object.freeze({
        row: region.rect.row,
        column: region.rect.column,
      }),
      alignment: "top-left",
      draggable: false,
      rectanglesAt: () => null,
      rectangles: Object.freeze({ open: Object.freeze({ ...region.rect }) }),
      transitions: Object.freeze({ open: Object.freeze([]) }),
      render: () => (
        <TakeoverRegionSurface onClose={close}>
          {region.render({ close })}
        </TakeoverRegionSurface>
      ),
      onStateChange: () => {},
      onPinnedChange: () => {},
    });
  });
}

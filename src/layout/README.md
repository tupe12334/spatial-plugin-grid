# Temporary layouts

[Repository overview](../../README.md)

## Takeover overlays

`AgentWorkspace` accepts `takeover: { open, onOpenChange, regions }`. Each region has a stable `id`, accessible `title`, one-based `rect: { row, column, rows, columns }`, and `render({ close })`. Regions must be disjoint and within grid bounds. Use regions at rows 1–2 and cells 31/34 to retain the stage at 32–33. The preset presents the same stage compactly while preserving its underlying expanded/pinned state; closing restores it without remounting its composer.

For arbitrary grids, `useLayoutTakeover(options)` returns overlay registrations for the separate `SpatialPluginGrid.overlay` prop. Keep the original `workspace` identity stable to preserve moved placements. Optional `presentationStates` maps retained plugin IDs to render-only named states, without changing their committed state or pin. `onOverlayDismiss` handles Escape across retained content and overlays. Covered base panels are inert; overlays and retained panels remain keyboard-accessible. Opening captures focus and closing restores the surviving opener.

`ActionBlock` renders a whole-card native button with `label`, optional `description`, `icon`, `selected`, `disabled`, and `onActivate`. Omit `selected` for navigation/actions that are not toggles. Hosts own loading/error content, pagination, authorized data and persistence; these primitives never synthesize chat messages or contain product-specific selection logic.

# UI components

`ActionBlock` rendersa whole-card native button with `label`, optional `description`, `icon`, `selected`, `disabled`, and `onActivate`. Omit `selected` for navigation/actions that are not toggles. Hosts own loading/error content, pagination, authorized data and persistence; these primitives never synthesize chat messages or contain product-specific selection logic.

Use it in [temporary layouts](../layout/README.md). Import shared styles and map [host theme tokens](../README.md#theming).

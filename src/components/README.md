# UI components

`ActionBlock` rendersa whole-card native button with `label`, optional `description`, `icon`, `selected`, `disabled`, and `onActivate`. Omit `selected` for navigation/actions that are not toggles. Hosts own loading/error content, pagination, authorized data and persistence; these primitives never synthesize chat messages or contain product-specific selection logic.

Use it in [temporary layouts](../layout/README.md). Import shared styles and map [host theme tokens](../README.md#theming).

`FourActionGrid` renders a titleless 2×2 surface of exactly four equal native buttons, separated by borders instead of raised cards. Each action has an `id`, `label`, optional `icon` and `disabled`; `onAction` receives the typed `id`. `createFourActionGridPlugin` mounts it as a single-cell plugin.

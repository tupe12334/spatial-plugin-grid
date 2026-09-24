# UI integration and theming

[Repository overview](../README.md)

## Embedded dashboard hosts and React Server Components

The [generic grid API](grid/README.md) targets the pending 0.2 release, not the published 0.1.0
API. Install a reviewed local tarball for integration testing, or wait for a
release containing these exports and the client boundary before depending on
them from a registry install. Building a tarball does not publish a release.

The distributed JavaScript entry starts with `"use client"` because it contains
interactive React components and hooks. This marks the **entire public entry**
as client code in React Server Component frameworks; there is no separate
server-only helpers entry. Create plugin definitions, render callbacks and the
workspace inside your host's client module, not in a Server Component that
passes functions across the serialization boundary. Keep the workspace identity
stable across ordinary renders (module scope for static definitions, or a
memoized host adapter for dynamic data). Fetching, authorization, persistence,
and mapping application theme tokens remain host responsibilities.

The default root fills the viewport. To embed it beneath an existing application
header or alongside a sidebar, give its parent a definite available height and
override the root geometry using the existing `style` prop:

```tsx
"use client";

import { SpatialPluginGrid } from "spatial-plugin-grid";
import "spatial-plugin-grid/styles.css";

export function Dashboard() {
  return (
    <section
      style={{ height: "calc(100dvh - 64px)", minHeight: 0, minWidth: 0 }}
    >
      <SpatialPluginGrid
        label="Dashboard workspace"
        navbarHeight={0}
        style={{
          position: "relative",
          inset: "auto",
          height: "100%",
          width: "100%",
        }}
      />
    </section>
  );
}
```

This example intentionally starts empty; pass a stable `workspace` built with
`definePlugin` and `defineWorkspace` as shown in the [grid guide](grid/README.md) to populate it. The 64px
header offset is illustrative: use your actual shell dimensions, give flex/grid
ancestors `min-height: 0` / `min-width: 0` where needed, and map all semantic theme
variables below. `navbarHeight={0}` avoids reserving a second internal navbar.
Import the CSS from the location permitted by your framework (for example its
root layout for global styles). The boundary does not disable server prerendering
or promise a particular framework's end-to-end compatibility; the packed smoke
test verifies the emitted directive, React 18/19 imports, types and CSS bundling.

## Theming

Supply all semantic variables on the grid or an ancestor. Runtime CSS contains no palette. For example, if your application already defines `--workspace-background` and `--panel-background`, map them explicitly:

```css
.my-workspace {
  --spg-canvas: var(--workspace-background);
  --spg-surface: var(--panel-background);
}
```

Those host names are illustrative, not assumed product tokens. Complete the following mapping using your actual theme:

| Variable               | Purpose                                |
| ---------------------- | -------------------------------------- |
| `--spg-canvas`         | Viewport background                    |
| `--spg-surface`        | Plugin surface                         |
| `--spg-surface-hover`  | Hover surface                          |
| `--spg-surface-raised` | Main stage surface                     |
| `--spg-control`        | Inputs and selectors                   |
| `--spg-foreground`     | Primary text                           |
| `--spg-muted`          | Secondary text and author labels       |
| `--spg-border`         | Frames and control borders             |
| `--spg-accent`         | Main-stage accent and primary action   |
| `--spg-accent-hover`   | Primary action hover                   |
| `--spg-on-accent`      | Primary action text                    |
| `--spg-focus`          | Keyboard focus outline                 |
| `--spg-shadow`         | Shadow color, including alpha          |
| `--spg-highlight`      | Inset highlight color, including alpha |

Theme updates use CSS inheritance immediately. All library selectors are scoped to `spg` classes. There are no body, main, or strong resets. Import styles once; ESM JS and declaration exports are separate from the explicit CSS export. React and React DOM are external peers.

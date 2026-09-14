# Spatial Plugin Grid

A React 18/19 library for a fixed viewport workspace: ten plugin homes and a united two-column main stage. Plugins expand over neighboring panels without changing their layout. Host applications own all data and actions. There is no backend, persistence, agent runtime, or shared registry singleton.

## Quickstart

This package is not published. Build and use a local tarball:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm pack
# In your host, install the resulting tarball.
```

```tsx
import {
  SpatialPluginGrid,
  type PluginDefinition,
} from "@tupe12334/spatial-plugin-grid";
import "@tupe12334/spatial-plugin-grid/styles.css";

const plugins: PluginDefinition[] = [
  {
    id: "notes",
    title: "Notes",
    home: "11",
    allowedSizes: ["1x1", "2x1", "1x2", "2x2"],
    render: ({ size, expanded, setSize, shrink }) => (
      <section>
        <p>Host-provided notes · {size}</p>
        <button onClick={() => (expanded ? shrink() : setSize("2x2"))}>
          {expanded ? "Return home" : "Expand notes"}
        </button>
      </section>
    ),
  },
];

export function Workspace() {
  return (
    <SpatialPluginGrid
      plugins={plugins}
      navbar={<nav aria-label="Workspace">Your navigation</nav>}
      mainStage={{
        title: "Conversation",
        transcript: [
          {
            id: "welcome",
            author: "Assistant",
            content: "Host-provided content",
          },
        ],
        composer: <YourComposer />,
      }}
      onPluginSizeChange={(id, size) => console.log(id, size)}
    />
  );
}
```

`YourComposer` is your own controlled form and submit callback. The library never submits or creates messages. Demo content and palettes exist only in stories.

## API

| Export                                                                  | Contract                                                                                                                                                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SpatialPluginGrid`                                                     | `plugins`, optional `mainStage`, `navbar`, `preset`, `className`, `style`, `dir`; optional `onPluginSizeChange(id,size)`, `onStageExpandedChange(expanded)`, `onPluginError(id,error,info)` |
| `PluginDefinition`                                                      | Immutable `id`, `title`, `home`, `allowedSizes`, and `render(context)`                                                                                                                      |
| `PluginRenderContext`                                                   | `size`, `expanded`, `setSize(size)`, `shrink()`; invalid requested sizes throw                                                                                                              |
| `MainStage`                                                             | Required `expanded` and `onExpandedChange`; optional `title`, `transcript`, `composer`                                                                                                      |
| `TranscriptEntry`                                                       | `id`, `author`, `content: ReactNode`                                                                                                                                                        |
| `StageRenderContext`                                                    | `expanded`, `setExpanded(boolean)`; accepted by transcript and composer render props                                                                                                        |
| `agentWorkspace` / `LayoutPreset`                                       | Default name, navbar height 64, gap 12, padding 12; pass finite nonnegative dimensions to customize spacing                                                                                 |
| `pluginHomes`, `sizesFor`, `geometry`, `intersects`, `validateRegistry` | Pure reusable layout and registry functions; geometry uses one-based physical columns and rows                                                                                              |

The grid owns expansion state; callbacks notify the host. `MainStage` can also be used independently as a controlled component in a host-sized `.spg-root` wrapper. Its parent controls expansion geometry; the grid provides the 480ms height animation. Registry validation runs on every render, rejects duplicate IDs/homes, reserved or invalid homes, duplicate/disallowed sizes, and requires `1x1`. Partial registries are allowed and leave empty cells. Plugin errors are isolated behind per-ID boundaries, preserving size controls; change the plugin ID to reset a failed instance. Keep IDs stable for the life of each plugin.

Custom transcript render props own their content semantics and styling. The built-in typed transcript supplies author labels, a centered layout, scroll-driven depth, and a log region. It initially scrolls to the latest message and follows appended messages when the reader is within 48px of the bottom. While following, it stays bottom-anchored throughout stage expansion, collapse, and other resizes; scrolling back to older messages preserves the reader's position instead. Composer render props receive stage controls, not a fabricated message API.

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

## Constraints, decisions, and limitations

The fixed physical grid is `11 12 13 14 / 21 22 23 24 / 31 [32+33] 34`. Top slots accept `1x1`, `2x1`, `1x2`, `2x2` within their left or right four-cell group. Bottom slots accept `1x1` and `1x2` upward over `21` or `24`. Labels retain their home numbers. RTL changes text direction, not physical cell addresses.

Expansion overlays use explicit grid placement and instance-local stacking order. The latest expansion wins. Even partially obscured panels become entirely inert so hidden controls cannot receive keyboard focus. Focus moves to the frontmost unobscured panel if needed. Shrink re-enables panels; it does not steal focus back. The stage conservatively reserves its full expanded area during collapse, avoiding early focus beneath an animated surface. Plugins must keep interactive content inside their panel: portaled content outside the root is host-owned and cannot be made inert by this library.

Main-stage wheel up expands; wheel down collapses. Ctrl-wheel is left for browser zoom. Finger-down movement expands and finger-up movement collapses after a 12px threshold. In the focused transcript, ArrowUp/PageUp/Home expand, ArrowDown/PageDown/End collapse. The toggle supports native Enter/Space, and Escape collapses from anywhere in the stage. These inputs retain native transcript scrolling. The composer remains anchored to the bottom throughout the 480ms `cubic-bezier(.22,1,.36,1)` animation. Reduced motion removes transitions, perspective, transforms, masks, and fading. Scroll/media listeners, observers, and collapse timers clean up on unmount.

This viewport component should occupy an application route without other page-flow content. The library itself causes no page overflow; host content outside it remains host-controlled. Four columns remain four columns on narrow screens; plugin bodies scroll internally and hosts should provide compact content. At extremely short viewport heights or oversized spacing settings, usable content area is necessarily limited. Presets customize spacing and naming, not the required three-by-four topology. No drag/drop, virtualization, persistence, server fetching, or publishing is included. Browser support targets modern browsers with `inert`, `ResizeObserver`, CSS `color-mix`, and dynamic viewport units.

## Development and validation

Node 24 and pnpm 9.15.9. Storybook core and React/Vite adapters are aligned at 10.5.4; React 18.3, TypeScript 5.7, Vite 6.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:pack
pnpm storybook
pnpm build-storybook
pnpm exec playwright install chromium
pnpm test:e2e
```

`test:pack` creates a real tarball, installs it into an isolated temporary consumer for React 18 and 19, compiles its TSX, imports the ESM package in Node, and bundles the CSS export through Vite. It deletes the temporary consumer afterward. Browser tests use isolated headless Chromium, cover every allowed size, both animation directions and intermediate geometry, composer anchoring, reduced-motion final geometry, input equivalents, focus protection, themes, narrow/RTL, and observer cleanup. Screenshots and traces are saved under `test-results`; CI uploads browser evidence. CI executes all noninteractive checks, including packed consumers and browser tests. No paid services are required.

See [captured browser evidence](docs/evidence/README.md) for the reference workspace, expanded stage, and narrow RTL layout.

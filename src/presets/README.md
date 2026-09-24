# Grouped workspace preset

[Repository overview](../../README.md)

## Opt-in grouped preset quickstart

For the pending generic API and its updated grouped preset export, build and use a local tarball:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm pack
# In your host, install the resulting tarball.
```

```tsx
import {
  AgentWorkspace,
  type GroupedPluginDefinition,
} from "spatial-plugin-grid";
import "spatial-plugin-grid/styles.css";

const plugins: GroupedPluginDefinition[] = [
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
    <AgentWorkspace
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

## Grouped preset API

| Export                                                                  | Contract                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AgentWorkspace`                                                        | `plugins`, optional `mainStage`, `navbar`, `preset`, `className`, `style`, `dir`; optional `onPluginSizeChange(id,size)`, `onStageExpandedChange(expanded)`, `onStageLockedChange(locked)`, `onPluginError(id,error,info)` |
| `GroupedPluginDefinition`                                               | Immutable `id`, `title`, `home`, `allowedSizes`, and `render(context)`                                                                                                                                                     |
| `GroupedPluginContext`                                                  | `size`, `expanded`, `setSize(size)`, `shrink()`; invalid requested sizes throw                                                                                                                                             |
| `MainStage`                                                             | Required `expanded` and `onExpandedChange`; optional `locked`, `onLockedChange`, `title`, `transcript`, `composer`                                                                                                         |
| `TranscriptEntry`                                                       | `id`, `author`, `content: ReactNode`                                                                                                                                                                                       |
| `StageRenderContext`                                                    | `expanded`, `setExpanded(boolean)`, `locked`, `setLocked(boolean)`; accepted by transcript and composer render props                                                                                                       |
| `agentWorkspace` / `LayoutPreset`                                       | Default name, navbar height 64, gap 12, padding 12; pass finite nonnegative dimensions to customize spacing                                                                                                                |
| `pluginHomes`, `sizesFor`, `geometry`, `intersects`, `validateRegistry` | Pure reusable layout and registry functions; geometry uses one-based physical columns and rows                                                                                                                             |

The grid owns expansion state; callbacks notify the host. `MainStage` can also be used independently as a controlled component in a host-sized `.spg-root` wrapper. Its parent controls expansion geometry; the grid provides the 480ms height animation. Grouped preset registry validation runs on every render, rejects duplicate IDs/homes, reserved or invalid homes, duplicate/disallowed sizes, and requires `1x1`. Partial registries are allowed and leave empty cells. Plugin errors are isolated behind per-ID boundaries, showing a fallback; change the plugin ID to reset a failed instance. Keep IDs stable for the life of each plugin.

Custom transcript render props own their content semantics and styling. The built-in typed transcript supplies author labels, a centered layout, scroll-driven depth, and a log region. It initially scrolls to the latest message and follows appended messages when the reader is within 48px of the bottom. While following, it stays bottom-anchored throughout stage expansion, collapse, and other resizes; scrolling back to older messages preserves the reader's position instead. Composer render props receive stage controls, not a fabricated message API.

## Grouped preset behavior and limitations

The opt-in AgentWorkspace preset arranges the physical grid as `11 12 13 14 / 21 22 23 24 / 31 [32+33] 34`. Top slots accept `1x1`, `2x1`, `1x2`, `2x2` within their left or right four-cell group. Bottom slots accept `1x1` and `1x2` upward over `21` or `24`. Labels retain their home numbers. RTL changes text direction, not physical cell addresses.

Expansion overlays use explicit grid placement and instance-local stacking order. The latest expansion wins unless the main stage is locked; a locked stage stays above every intersecting plugin, including later expansions. Even partially obscured panels become entirely inert so hidden controls cannot receive keyboard focus. Focus moves to the frontmost unobscured panel if needed. Shrink re-enables panels; it does not steal focus back. The stage conservatively reserves its full expanded area during collapse, avoiding early focus beneath an animated surface. Plugins must keep interactive content inside their panel: portaled content outside the root is host-owned and cannot be made inert by this library.

Main-stage wheel up expands; downward input collapses only at the actual transcript bottom (within 1px), including when native scrolling reaches it during that input. Midstream and near-bottom reading stays expanded; resize, appends, and programmatic scrolling without current downward input do not collapse. Empty or nonoverflowing transcripts are already at bottom. Ctrl-wheel is left for browser zoom. Finger-down movement expands and finger-up movement requests bottom-only collapse after a 12px threshold. In the focused transcript, ArrowUp/PageUp/Home expand, ArrowDown/PageDown/End/Space request bottom-only collapse; Shift+Space expands. The toggle supports native Enter/Space, and Escape collapses from anywhere in the stage. These inputs retain native transcript scrolling. The composer remains anchored to the bottom throughout the 480ms `cubic-bezier(.22,1,.36,1)` animation. Reduced motion removes transitions, perspective, transforms, masks, and fading. Scroll/media listeners, observers, and collapse timers clean up on unmount.

### Pinning the main stage

The lock icon beside Collapse pins the stage expanded over blocks 22–23 without moving any plugin. Occupied and partially overlapping plugin panels become inert; later overlapping expansions cannot obscure or disable the pinned chat. The toggle exposes its pressed state, an accessible action name and a tooltip. Collapse remains focusable with `aria-disabled` and an explanation while locked.

Wheel, touch, keyboard, Escape, Collapse and render-context `setExpanded(false)` cannot shrink a locked stage. Native transcript scrolling still works. Unlock keeps the stage expanded and restores ordinary expansion stacking; a newer overlapping plugin may then cover it. Pending downward intent is cleared on both lock transitions. A fresh downward action at the actual bottom or an explicit collapse is required to shrink it. The 48px append-follow threshold and 1px collapse threshold are unchanged.

The grid owns lock state and reports changes through `onStageLockedChange(locked)`; `mainStage` excludes the grid-owned expansion and lock props. Transcript and composer contexts expose `locked` and `setLocked(boolean)` alongside expansion controls. Locking a collapsed stage also reports expansion through `onStageExpandedChange(true)`.

Standalone `MainStage` keeps lock state locally by default. To control it, pass `locked` and `onLockedChange`; the parent must apply the requested state and preserve the expansion requested by `onExpandedChange(true)` when locking. Effective `expanded` is always true while locked, even if the parent supplies `expanded={false}`. The parent owns standalone geometry. Lock state is instance-local and is never persisted.

This viewport component should occupy an application route without other page-flow content. The library itself causes no page overflow; host content outside it remains host-controlled. Four columns remain four columns on narrow screens; plugin bodies scroll internally and hosts should provide compact content. At extremely short viewport heights or oversized spacing settings, usable content area is necessarily limited. Presets customize spacing and naming, not the required three-by-four topology. No drag/drop, virtualization, persistence, server fetching, or publishing is included. Browser support targets modern browsers with `inert`, `ResizeObserver`, CSS `color-mix`, and dynamic viewport units.

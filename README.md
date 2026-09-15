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
} from "spatial-plugin-grid";
import "spatial-plugin-grid/styles.css";

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
| `SpatialPluginGrid`                                                     | `plugins`, optional `mainStage`, `navbar`, `preset`, `className`, `style`, `dir`; optional `onPluginSizeChange(id,size)`, `onStageExpandedChange(expanded)`, `onStageLockedChange(locked)`, `onPluginError(id,error,info)` |
| `PluginDefinition`                                                      | Immutable `id`, `title`, `home`, `allowedSizes`, and `render(context)`                                                                                                                      |
| `PluginRenderContext`                                                   | `size`, `expanded`, `setSize(size)`, `shrink()`; invalid requested sizes throw                                                                                                              |
| `MainStage`                                                             | Required `expanded` and `onExpandedChange`; optional `locked`, `onLockedChange`, `title`, `transcript`, `composer`                                                                                                      |
| `TranscriptEntry`                                                       | `id`, `author`, `content: ReactNode`                                                                                                                                                        |
| `StageRenderContext`                                                    | `expanded`, `setExpanded(boolean)`, `locked`, `setLocked(boolean)`; accepted by transcript and composer render props                                                                                                        |
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

Expansion overlays use explicit grid placement and instance-local stacking order. The latest expansion wins unless the main stage is locked; a locked stage stays above every intersecting plugin, including later expansions. Even partially obscured panels become entirely inert so hidden controls cannot receive keyboard focus. Focus moves to the frontmost unobscured panel if needed. Shrink re-enables panels; it does not steal focus back. The stage conservatively reserves its full expanded area during collapse, avoiding early focus beneath an animated surface. Plugins must keep interactive content inside their panel: portaled content outside the root is host-owned and cannot be made inert by this library.

Main-stage wheel up expands; downward input collapses only at the actual transcript bottom (within 1px), including when native scrolling reaches it during that input. Midstream and near-bottom reading stays expanded; resize, appends, and programmatic scrolling without current downward input do not collapse. Empty or nonoverflowing transcripts are already at bottom. Ctrl-wheel is left for browser zoom. Finger-down movement expands and finger-up movement requests bottom-only collapse after a 12px threshold. In the focused transcript, ArrowUp/PageUp/Home expand, ArrowDown/PageDown/End/Space request bottom-only collapse; Shift+Space expands. The toggle supports native Enter/Space, and Escape collapses from anywhere in the stage. These inputs retain native transcript scrolling. The composer remains anchored to the bottom throughout the 480ms `cubic-bezier(.22,1,.36,1)` animation. Reduced motion removes transitions, perspective, transforms, masks, and fading. Scroll/media listeners, observers, and collapse timers clean up on unmount.

### Pinning the main stage

The lock icon beside Collapse pins the stage expanded over blocks 22–23 without moving any plugin. Occupied and partially overlapping plugin panels become inert; later overlapping expansions cannot obscure or disable the pinned chat. The toggle exposes its pressed state, an accessible action name and a tooltip. Collapse remains focusable with `aria-disabled` and an explanation while locked.

Wheel, touch, keyboard, Escape, Collapse and render-context `setExpanded(false)` cannot shrink a locked stage. Native transcript scrolling still works. Unlock keeps the stage expanded and restores ordinary expansion stacking; a newer overlapping plugin may then cover it. Pending downward intent is cleared on both lock transitions. A fresh downward action at the actual bottom or an explicit collapse is required to shrink it. The 48px append-follow threshold and 1px collapse threshold are unchanged.

The grid owns lock state and reports changes through `onStageLockedChange(locked)`; `mainStage` excludes the grid-owned expansion and lock props. Transcript and composer contexts expose `locked` and `setLocked(boolean)` alongside expansion controls. Locking a collapsed stage also reports expansion through `onStageExpandedChange(true)`.

Standalone `MainStage` keeps lock state locally by default. To control it, pass `locked` and `onLockedChange`; the parent must apply the requested state and preserve the expansion requested by `onExpandedChange(true)` when locking. Effective `expanded` is always true while locked, even if the parent supplies `expanded={false}`. The parent owns standalone geometry. Lock state is instance-local and is never persisted.

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

## npm publishing

Publishing automation is prepared; this does not mean the package is already on npm. The license remains `UNLICENSED`. Releases use Node 24, npm 11.6.1, and pnpm 9.15.9 on GitHub-hosted runners. See [npm trusted publishing requirements and configuration](https://docs.npmjs.com/trusted-publishers/).

### Owner bootstrap (one time, after merge)

OIDC cannot bootstrap this nonexistent package: its npm settings must exist before a trusted publisher can be configured. An owner with access to the `@tupe12334` scope must perform the initial publication from a clean, reviewed `main` checkout. These are manual owner actions, not actions performed by this PR:

1. Install Node 24 and pnpm 9.15.9, then run the full validation sequence below on the exact initial version (currently `0.1.0`).
2. Inspect `npm publish --dry-run --access public --registry https://registry.npmjs.org/ --tag latest`. Authenticate locally with `npm login --registry https://registry.npmjs.org/`, then run `npm publish --access public --registry https://registry.npmjs.org/ --tag latest`, completing npm's authentication/2FA prompts. This local bootstrap does not request GitHub provenance. If bootstrapping a prerelease version instead, use `next` for both commands.
3. In npm's settings for `spatial-plugin-grid`, add a **GitHub Actions** trusted publisher with these exact fields:

   | Field | Value |
   | --- | --- |
   | Organization or user | `tupe12334` |
   | Repository | `spatial-plugin-grid` |
   | Workflow filename | `publish.yml` (no directory prefix) |
   | Environment name | Leave empty (the workflow uses no environment) |
   | Allowed actions, if shown | Allow direct `npm publish` |

   The package's `repository.url` must continue to match this GitHub repository. No npm token or GitHub secret is used by the workflow.
4. The initial version is now consumed: do not publish a GitHub release for that same version expecting CI to republish it. Use a new version for the first automated release.

### Validate without publishing

After merge, run the **Publish npm** workflow using **Run workflow → main**, or:

```sh
gh workflow run publish.yml --ref main
```

Manual dispatch has no publish input and cannot enter the publish job. It synthesizes `v<package.version>`, validates main ancestry, runs the complete reusable CI suite, builds, and executes `npm publish --dry-run` with the selected `latest`/`next` tag. It creates no Git tag, GitHub release, or npm publication and has no OIDC permission. A successful dry run proves validation and packaging, not npm authentication or trusted publisher configuration.

Full local validation (same scripts as CI):

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:release
pnpm test:release-tooling
pnpm build
pnpm test:pack
pnpm storybook --ci --smoke-test --port 16067
pnpm build-storybook
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
npm publish --dry-run --access public --provenance --registry https://registry.npmjs.org/ --tag latest
```

For a prerelease dry run, use `--tag next`.

### Normal releases

Versioning and changelogs are owned exclusively by [Changesets](https://github.com/changesets/changesets); commit messages are enforced as [Conventional Commits](https://www.conventionalcommits.org/) by commitlint (`commitlint.config.mjs`, `.husky/commit-msg`, and the `Commitlint` GitHub Actions check, which lints only the commits in the current push/PR range — the pre-existing, non-conventional history on `main` is never re-checked). Tagging and the GitHub release are owned exclusively by [release-it](https://github.com/release-it/release-it) (`.release-it.json`), which never bumps the version, commits, or publishes to npm — npm publishing stays in `publish.yml`, triggered by the GitHub release release-it creates.

1. **Propose a change.** Land a normal PR; if it should ship a release, include a changeset (`pnpm changeset`, or `pnpm changeset add --empty` for changes that shouldn't release). `pnpm changeset status` reports pending changesets.
2. **Version PR.** Run `pnpm run version` (`changeset version`), then `pnpm install --lockfile-only` to consume the pending changesets, bump `package.json`, and update `CHANGELOG.md`. Open this as its own reviewed PR — version edits always go through review before a release, never as a side effect of releasing. Merge it into `main` after CI passes.
3. **Release.** From a clean, up-to-date local `main` checkout (`git checkout main && git pull`), run `pnpm release` (`release-it`). It requires a `GITHUB_TOKEN` env var (a `gh auth token`, or a classic/fine-grained PAT with `repo` scope, since the workflow-generated `GITHUB_TOKEN` in Actions cannot trigger another workflow run and is not usable here):

   ```sh
   GITHUB_TOKEN="$(gh auth token)" pnpm release
   ```

   release-it natively requires `main`, an upstream, and clean tracked files. The `before:init` hook (`scripts/release-preflight.mjs`) adds only repository policy: credentials, no untracked files or unconsumed changesets, exact `origin/main` equality, nonempty notes for the exact version, and no existing local/remote version tag. release-it then tags `v<package.version>` (annotated), pushes the tag, and creates a GitHub release named for that version with notes from the Changesets section (`release-preflight.mjs --notes` — no separate generator). It performs no version bump, no commit, and no `npm publish`.
4. **Prerelease.** The same flow supports prerelease versions (e.g. `0.2.0-rc.1`): give the version PR a prerelease version via `pnpm changeset pre enter rc && pnpm run version` (`pnpm changeset pre exit` to leave prerelease mode later), then release normally. release-it detects the prerelease identifier in the version string and marks the GitHub release as a prerelease automatically, matching what `release-guard.mjs` requires for the tag/version/prerelease-flag triple.
5. Publishing itself is unchanged: the GitHub release (`published`) event triggers `publish.yml`, which re-validates tag/version/main-ancestry and CI, then publishes with OIDC provenance — stable versions to `latest`, prereleases to `next`. See the section above for that workflow's guarantees.
6. Versions cannot be overwritten; if a publication succeeded, use a new version for subsequent changes. Publish stable versions in ascending order: publishing an older stable version would move `latest` backward.

Dry run without touching anything (no real tag, push, or GitHub release):

```sh
pnpm release:dry
```

`pnpm release:dry` runs `release-it --dry-run --ci`. release-it skips all write-side hooks in `--dry-run` mode (including the preflight guard above), so it proves the tag/push/release plan without needing a `GITHUB_TOKEN`. `pnpm test:release-tooling` exercises commitlint, repository policy and exact notes, plus real Changesets versioning followed by release-it dry-runs for stable and prerelease fixtures. These disposable repositories verify no version bump, commit, tag, push or changes to this repository. `pnpm test:release` covers publishing policy using standard `semver` validation. We deliberately avoid a Changesets release-it plugin: its release-time version bump would duplicate the reviewed version PR.

See [local pre-push validation and screenshot review](docs/validation.md) for Docker setup, gates and intentional baseline updates.

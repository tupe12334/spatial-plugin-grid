# Reusable plugins

This directory owns reusable plugin factories and their public types. The grid
and general UI live outside this directory. Plugins use the existing
`definePlugin` contract; they do not introduce a second registry or mount
automatically.

## Structure

```text
src/plugins/
  README.md
  index.ts                 Public plugin catalog
  agent/
    index.ts               Public agent exports
    createAgentPlugin.tsx  Agent factory and options
```

Keep each plugin in its own directory. Export only its supported factory and
public types from its `index.ts`; keep implementation helpers private.

## Consumption

```tsx
import { SpatialPluginGrid, defaultGrid, defineWorkspace } from "spatial-plugin-grid";
import { createAgentPlugin } from "spatial-plugin-grid/plugins/agent";
import "spatial-plugin-grid/styles.css";

const agent = createAgentPlugin({ id: "assistant", title: "Assistant" });
const workspace = defineWorkspace(defaultGrid).place(agent, {
  anchor: { row: 3, column: 1 },
  initialState: "collapsed",
});

export const app = <SpatialPluginGrid workspace={workspace} />;
```

`spatial-plugin-grid/plugins` exports the plugin catalog. The existing agent
factory and options type also remain available from the package root for
compatibility. All public JavaScript entries carry `"use client"`; define plugin
render callbacks and workspaces within a host client module. Import the shared
stylesheet once and keep workspace identity stable across ordinary renders.

## Adding a plugin

1. Create `<name>/create<Name>Plugin.tsx` using `definePlugin`. Accept host-owned
   content and options, and preserve inferred state names, footprints and
   transitions. Use relative imports for internal dependencies, not the root
   barrel.
2. Add `<name>/index.ts` with the public factory and options type. Re-export them
   from this directory's `index.ts`.
3. Add `plugins/<name>/index` to the library entries in
   [`vite.config.ts`](../../vite.config.ts). Add an explicit `./plugins/<name>`
   export in [`package.json`](../../package.json), mapping `types` to
   `./dist/plugins/<name>/index.d.ts` and `import` to
   `./dist/plugins/<name>/index.js`. Do not add wildcard implementation exports.
4. Add behavior and type-inference tests. Extend
   [`scripts/pack-consumer.mjs`](../../scripts/pack-consumer.mjs) to exercise the
   new entry from a real installed tarball: public exports, types, placement,
   client directive and bundling. Update its expected catalog exports.
5. Add Storybook scenarios and screenshot coverage as described below.

Hosts own authorized data, network clients, persistence, placement and theme
token mapping. Keep product-specific adapters outside this library. Fixture data
and example palettes belong in stories, not plugin implementations.

## Required screenshots

Every plugin directory must be registered in
[`tests/visual/pluginCoverage.ts`](../../tests/visual/pluginCoverage.ts), with
real Storybook IDs. Register its default and interactive capture states in
[`tests/visual/registry.ts`](../../tests/visual/registry.ts). Import the library
stylesheet explicitly in each independently loaded story module.

Images are stored at:

```text
tests/visual/baselines/plugins/<name>/<scenario>.png
```

The [agent screenshots](../../tests/visual/baselines/plugins/agent/) cover
collapsed and expanded states at each of its six supported anchors. Choose
representative states for each new plugin, including relevant empty, populated
and interactive states. Confirm IDs in the built Storybook index rather than
guessing their spelling.

Validation rejects plugins without registered coverage, missing or obsolete
PNGs, duplicate story ownership and screenshot path collisions. Screenshots
remain repository test assets; they are not shipped in the npm package.

From the repository root, generate intentional new or changed baselines with:

```sh
pnpm build-storybook
pnpm test:visual:update
pnpm test:visual
```

These commands use the pinned Linux/amd64 Playwright Docker runner. Inspect the
images before approving them; do not refresh baselines merely to hide failures.
For unchanged visuals, run `pnpm test:visual` without update mode. The baseline
guard covers nested plugin screenshots too. Leave changes uncommitted when
review is requested; the pre-push gate requires approved baselines to be
committed.

## Verification

Run from the repository root:

```sh
pnpm lint
pnpm typecheck
pnpm test:types
pnpm test
pnpm build
pnpm test:pack
pnpm build-storybook
pnpm test:visual
```

See the [grid README](../grid/README.md) for the registration API and
[validation guide](../../docs/validation.md) for screenshot and pre-push policy.

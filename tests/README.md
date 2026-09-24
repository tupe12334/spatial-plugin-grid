# Development and validation

[Repository overview](../README.md)

Run commands from the repository root. Install dependencies with `pnpm install --frozen-lockfile`.

## Development and validation

Node 24 and pnpm 9.15.9. Storybook core and React/Vite adapters are aligned at 10.5.4; React 18.3, TypeScript 5.7, Vite 6.

```sh
pnpm lint
pnpm typecheck
pnpm test:types
pnpm test
pnpm build
pnpm test:pack
pnpm storybook
pnpm build-storybook
pnpm exec playwright install chromium
pnpm test:e2e
```

`test:pack` creates a real tarball, installs it into an isolated temporary consumer for React 18 and 19, compiles its TSX, parses the installed entry to assert its leading `"use client"` directive, imports the ESM package in Node, and bundles the CSS export through Vite. It deletes the temporary consumer afterward. Browser tests use isolated headless Chromium, cover every allowed size, both animation directions and intermediate geometry, composer anchoring, reduced-motion final geometry, input equivalents, focus protection, themes, narrow/RTL, and observer cleanup. Screenshots and traces are saved under `test-results`; CI uploads browser evidence. CI executes all noninteractive checks, including packed consumers and browser tests. No paid services are required.

See [captured browser evidence](../docs/evidence/README.md) for the reference workspace, expanded stage, and narrow RTL layout.

# Release and publishing tooling

[Repository overview](../README.md)

Run commands from the repository root. This guide describes the repository workflow; it does not verify live npm publication or account settings.

## npm publishing

Publishing automation is prepared; this does not mean the package is already on npm. The license remains `UNLICENSED`. Releases use Node 24, npm 11.6.1, and pnpm 9.15.9 on GitHub-hosted runners. See [npm trusted publishing requirements and configuration](https://docs.npmjs.com/trusted-publishers/).

### Owner bootstrap (one time, after merge)

OIDC cannot bootstrap this nonexistent package: its npm settings must exist before a trusted publisher can be configured. An owner with access to the `@tupe12334` scope must perform the initial publication from a clean, reviewed `main` checkout. These are manual owner actions, not actions performed by this PR:

1. Install Node 24 and pnpm 9.15.9, then run the full validation sequence below on the exact initial version (currently `0.1.0`).
2. Inspect `npm publish --dry-run --access public --registry https://registry.npmjs.org/ --tag latest`. Authenticate locally with `npm login --registry https://registry.npmjs.org/`, then run `npm publish --access public --registry https://registry.npmjs.org/ --tag latest`, completing npm's authentication/2FA prompts. This local bootstrap does not request GitHub provenance. If bootstrapping a prerelease version instead, use `next` for both commands.
3. In npm's settings for `spatial-plugin-grid`, add a **GitHub Actions** trusted publisher with these exact fields:

   | Field                     | Value                                          |
   | ------------------------- | ---------------------------------------------- |
   | Organization or user      | `tupe12334`                                    |
   | Repository                | `spatial-plugin-grid`                          |
   | Workflow filename         | `publish.yml` (no directory prefix)            |
   | Environment name          | Leave empty (the workflow uses no environment) |
   | Allowed actions, if shown | Allow direct `npm publish`                     |

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
pnpm test:types
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

See [local pre-push validation and screenshot review](../docs/validation.md) for Docker setup, gates and intentional baseline updates.

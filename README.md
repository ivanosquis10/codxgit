# CodxGit

CodxGit is a local-first, single-user dashboard for tracking personal GitHub work. It turns the activity you already generate — issues, pull requests, commits, and Projects memberships — into one answer: **what did I actually complete this week?**

> **Status: runnable local MVP.** The range-based dashboard is implemented and tested. It reads GitHub read-only through your existing `gh` authentication, caches snapshots in local SQLite, and never writes to GitHub.

## What it shows

One screen, defaulting to the **trailing 30 days** (today plus the prior 29 local calendar dates), with quick presets for **This week**, **Last week** (Monday–Friday), **Last 15 days**, **Last 30 days** and **1 month**, grouped **repository first**:

- A per-repository breakdown (the primary grouping): open issues, open pull requests, closed in
  range, merged in range, and commits you authored. Repository choices come from a durable local
  catalog built **only** from your own items and commits, never from organization-wide Project
  items, so a repository with no Project still appears.
- A **durable repository catalog** that survives date-range changes: a repository observed in an
  earlier sync, or added by hand, stays in the selector with a real `0` when the current range has
  no activity for it. Nothing is deleted when a repository is absent from a range.
- Issues closed this week, with GitHub's `completed` vs `not planned` reason kept apart.
- Pull requests merged this week.
- Commits you authored this week (default-branch commit index).
- Your current open backlog (open issues and pull requests) **separately** from weekly closures.
- An optional, secondary GitHub Projects view: only Projects where your own items or assignment
  were observed. Repository commits never create a Project row on their own.
- A repository selector that lists the catalog, plus a hand-add control: type `owner/repo`, and the
  server validates it with `gh repo view <owner/repo> --json nameWithOwner,url` before pinning it.
  Only repositories in the configured organization are accepted.
- A coverage panel that distinguishes `ok`, `unavailable` and `not covered`.

A responsive shadcn sidebar carries the real controls: section navigation, repository selection,
the optional Project filter, and your account/organization. The repository and Project filters
combine (intersection), and the range preset/anchor, repository and Project selections are
preserved in the URL.

Missing data is never shown as `0`. A denied scope, an unread week and a real zero are three different states.

## Repository catalog

Repositories are **not** rebuilt from scratch for every date range. CodxGit keeps a local catalog
keyed by `account + organization + normalized owner/name` (GitHub names are case-insensitive, so the
normalized key is the unique identity while the display spelling is preserved):

- **Observed.** A refresh adds every repository named by a successfully read personal source — the
  open backlog, closures, merges and authored commits. A source that failed contributes nothing, and
  a repository missing from a later range is never deleted.
- **Added by hand.** Type `owner/repo` in the repository selector. The server validates the owner
  against `CODXGIT_ORG` (or `GITPOP_ORG`) *before* calling GitHub, runs exactly
  `gh repo view <owner/repo> --json nameWithOwner,url` as a fixed argv, re-checks the response owner
  and name, and only then pins the repository. A repository outside the configured organization is
  rejected; a duplicate is idempotent.
- **Pinned.** A hand-added repository is pinned. Observation upserts refresh the last-seen time but
  never clear the pin; unpinning keeps the row in the catalog.

The activity number next to a repository in the selector is its **real** count in the selected
range, so `0` means "no activity in this range", not "not observed".

## Requirements

- Node.js 22 or newer (Node 24 verified).
- pnpm 11. The exact version is pinned in `package.json` (`packageManager: pnpm@11.9.0`); with the Corepack shims enabled (`corepack enable`) pnpm resolves that pin automatically. The lockfile is `pnpm-lock.yaml`; npm and `package-lock.json` are no longer used.
- The GitHub CLI (`gh`) installed and authenticated: `gh auth status`.
- For the Projects view, the active account needs the `read:project` scope. Add it with your own authorization step: `gh auth refresh -s read:project`.

Native dependency builds under pnpm are allow-listed per package in
`pnpm-workspace.yaml` (`allowBuilds`), not blanket-approved. Only `better-sqlite3`
(native binding) and `esbuild` (platform binary link) are trusted; anything else
stays unapproved.

## Run it

```bash
pnpm install
pnpm dev             # http://127.0.0.1:4173
```

Open the page and press **Refresh** to read the first snapshot. Nothing is fetched from GitHub until you ask.

Other commands:

```bash
pnpm test             # deterministic unit tests
pnpm typecheck        # tsc --noEmit
pnpm build            # production client + server build into dist/
pnpm start            # serve the production build (vite preview)
pnpm refresh          # headless first sync (pnpm refresh -- 2026-10-05)
pnpm refresh -- --demo
pnpm db:generate      # regenerate the Drizzle migration
pnpm db:migrate       # apply migrations to the local database
```

> pnpm blocks dependency lifecycle scripts by default. The two trusted packages
> above are allow-listed in `pnpm-workspace.yaml`; adding a new package with a
> native build step will be reported as an ignored build until you approve it
> explicitly (`pnpm approve-builds`). CodxGit prefers per-package approval over a
> blanket allow-all setting.

## Configuration

Copy the settings you need into your shell environment or a local `.env` file (never committed).

| Variable | Default | Purpose |
|----------|---------|---------|
| `CODXGIT_ORG` (or `GITPOP_ORG`) | `desarrollo-intelicorps` | GitHub organization to read |
| `CODXGIT_TIMEZONE` (or `GITPOP_TIMEZONE`) | `America/Caracas` | Timezone that defines the date-range boundaries |
| `CODXGIT_DB_PATH` (or `GITPOP_DB_PATH`) | `.data/codxgit.sqlite` | Local SQLite cache file (keep it out of source control) |
| `CODXGIT_DEMO_MODE` (or `GITPOP_DEMO_MODE`) | `0` | Set to `1` to force the clearly labeled demo dataset |
| `CODXGIT_MIGRATIONS_PATH` (or `GITPOP_MIGRATIONS_PATH`) | `drizzle` | Optional override for the migrations directory |

The app is single-user by design: it uses whoever is the active `gh` account. There is no CodxGit login and no credential owned by CodxGit.

## Demo data

Append `?demo=true` (or set `CODXGIT_DEMO_MODE=1`) to render a fixed sample dataset. The demo
includes a repository with no Project membership at all (`demo-organization/docs-site`), so the
repository-first flow can be exercised without a Project filter. The UI labels the dataset as demo
data. It is never used as a fallback when a real GitHub read fails.

## How it is honest

- **Read-only.** Only `gh` read commands are issued: no comments, labels, status changes or item creation.
- **Fixed argv.** Every `gh` call is a fixed argument array executed with `execFile`; inputs are validated and there is no shell.
- **No tokens in the browser.** GitHub access happens server-side. The client bundle contains no database driver and no command construction.
- **Minimized private data.** Project item reads project only identity, URL, repository and assignees; bodies and comments are discarded by `--jq` before they reach the app. The hand-add check requests only `nameWithOwner` and `url`, never repository contents.
- **Bounded coverage.** Reads are paginated and capped: search reads use up to 3 pages of 100 and commit reads use 100. A wider range such as the trailing 30 days can reach those caps, and hitting one marks the source `incomplete` instead of pretending the window is fully covered.
- **Repository-first, from personal sources.** Repository options come only from your own issues, pull
  requests and commits. Organization-wide Project items never add a repository, and a repository with
  no Project membership is a first-class row.
- **The catalog is durable.** A repository is added to the catalog by an idempotent observation, so a
  range that does not mention it never removes it. The catalog is scoped to the active account and
  organization, so two identities or organizations never blend.
- **Repository is not Project.** Projects are optional and secondary. When Projects are unreadable,
  the repository view is unaffected and Projects show `unavailable` with the reason. Commit-to-Project
  counts are inferred from repository membership and labeled `repository-derived`; they never make a
  Project relevant by themselves.

## Documentation

| Path | Purpose |
|------|---------|
| [docs/product.md](docs/product.md) | The idea, scope, non-goals, acceptance criteria |
| [docs/architecture.md](docs/architecture.md) | Conceptual design: stack, boundaries, entities, storage |
| [docs/metrics.md](docs/metrics.md) | Metric definitions and counting rules |
| [docs/implementation.md](docs/implementation.md) | What is implemented, module map, data flow, verification, limits |
| [docs/roadmap.md](docs/roadmap.md) | Incremental delivery order and open decisions |

## Reading order

1. [docs/product.md](docs/product.md) — what CodxGit is and is not.
2. [docs/architecture.md](docs/architecture.md) — the shape and boundaries.
3. [docs/metrics.md](docs/metrics.md) — read this before judging any number.
4. [docs/implementation.md](docs/implementation.md) — the runnable reality and its limits.

## Inspiration

- [gh-dash](https://gh-dash.dev) — a terminal-first GitHub dashboard.
- [Linear Insights](https://linear.app/docs/insights) — presentation reference, not an API contract.
- [GitHub Projects insights](https://docs.github.com/en/issues/planning-and-tracking-with-projects/viewing-insights-from-your-project/about-insights-for-projects) — chart concepts from the GitHub UI.

These are references for how results can be *shown*. CodxGit does not assume that any UI history or chart is retrievable through an API.

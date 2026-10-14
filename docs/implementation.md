# Implementation

This document describes what is actually implemented, how it is verified, and
where the deliberate limits are. It is written to match the code in `src/` and
`tests/`, not to describe a future design.

## What is runnable

A local TanStack Start application that renders a range-based dashboard plus a
standalone `/analytics` Engineering Analytics view:

- The dashboard supports **Last 7 days**, **Last 30 days** and **Last 90 days**
  in addition to **This week** / **Last week** (Monday–Friday), **Last 15 days** /
  **1 month** presets, all computed as local calendar boundaries in one timezone
  with inclusive instants.
- Personal scope only: issues currently assigned to you, pull requests you
  authored, and commits you authored.
- Repository-first grouping: repository choices come from a durable local catalog built only from
  personal sources, with a per-repository range and backlog breakdown. A repository with no Project
  membership works and is a first-class row.
- Repository catalog: an idempotent observation from every successfully read personal source, plus a
  hand-add control that validates `owner/repo` with a fixed `gh repo view` argv inside the
  configured organization and pins the result. A repository stays selectable across ranges, and a
  missing range never deletes it.
- Current open backlog reported separately from weekly closures and merges.
- Engineering Analytics with completed issues, merged pull requests, median PR lead
  time, exact-label blocked issues, repository breakdown, linked contributions and
  a copyable Markdown report. Cycle time is explicitly unavailable without reliable
  work-start events.
- Optional, secondary Project breakdown, limited to Projects with observed
  personal involvement; repository commits never create a Project row.
- A responsive shadcn sidebar (`SidebarProvider`/`SidebarInset`/`SidebarTrigger`,
  mobile sheet, collapse) with real controls: section anchors, repository
  selection, optional Project selection, and account/organization.
- Previous/next navigation for the week presets, Refresh, and repository +
  Project filters that intersect and stay in the URL alongside the range preset
  and anchor.
- shadcn/ui cards, table, badges, alerts, dropdown and sidebar, on a neutral
  theme with light/dark support and sidebar tokens in both modes.
- Local snapshot cache in SQLite through Drizzle and `better-sqlite3`.
- Honest empty, unavailable and not-covered states.

There are no charts, no settings page, no background jobs, no GitHub writes and
no application login.

## Module map

| Path | Responsibility |
|------|----------------|
| `src/lib/week.ts` | Date-range presets (trailing 30/15, week, month lookback), local boundary resolution, inclusive instant checks, month-end clamping |
| `src/lib/summary.ts` | Pure aggregation into the weekly and analytics views (repository-first grouping, dedup, filters, coverage, lead time) |
| `src/lib/analytics.ts` | Pure Markdown report and lead-time formatting |
| `src/lib/metrics.ts` | Metric constructors and source-to-metric mapping |
| `src/lib/types.ts` | Shared client-safe types |
| `src/lib/query.ts` | URL parameter parsing and serialization (`preset`, `week` anchor, `repos`, `projects`, `demo`) |
| `src/lib/format.ts` | Number, timestamp and repository label formatting |
| `src/lib/demo.ts` | Fixed, clearly labeled demo dataset |
| `src/server/gh.server.ts` | `gh` adapter: fixed argv, bounds, typed errors, PR creation timestamps and exact blocked-label reads |
| `src/server/sync.server.ts` | Source reads, coverage bookkeeping, snapshot writes |
| `src/server/dashboard.server.ts` | Load-from-cache and explicit-refresh orchestration |
| `src/server/dashboard.functions.ts` | `createServerFn` boundary used by the route |
| `src/server/repository.functions.ts` | `createServerFn` boundary for catalog add and pin (the only path that reaches `gh repo view`) |
| `src/db/schema.ts` | Drizzle tables `snapshots`, `accounts` and `repositories` |
| `src/db/client.server.ts` | SQLite open, migration, process-wide handle |
| `src/db/snapshots.server.ts` | Snapshot upsert and read helpers |
| `src/db/repositories.server.ts` | Repository catalog: observation upsert, account/org/name isolation, pin/unpin, validated manual add |
| `src/routes/index.tsx` | Dashboard route, search params, sidebar shell, refresh handler |
| `src/routes/analytics.tsx` | Engineering Analytics route reusing the dashboard loader and cache |
| `src/components/app-sidebar.tsx` | shadcn sidebar shell and navigation |
| `src/components/repository-breakdown.tsx` | Primary per-repository table/cards |
| `src/components/repository-filter.tsx` | Repository selection from the durable catalog, pinned markers and the validated hand add |
| `src/components/project-breakdown.tsx` | Optional secondary Project table/cards |
| `src/components/project-filter.tsx` | Optional Project selection |
| `src/components/ui/sidebar.tsx` | Canonical shadcn sidebar primitives |
| `src/components/ui/{sheet,tooltip,separator,input}.tsx` | shadcn primitives used by the sidebar |
| `src/hooks/use-mobile.ts` | Sidebar mobile breakpoint hook |
| `src/components/**` | Other shadcn/ui primitives and dashboard components |
| `drizzle/0000_*.sql` | Generated migration (the runtime schema source) |
| `drizzle/0001_*.sql` | Generated repository-catalog migration |

## Data flow

1. A route loader calls the `loadDashboard` server function. Loaders are
   isomorphic, so all database and `gh` access lives inside the server function.
2. `loadDashboardData` resolves the active identity, then answers from SQLite.
   It only calls `gh api user` when there is no cached identity yet.
3. `Refresh` calls the `refreshDashboard` server function. It reads GitHub
   server-side and writes three snapshot scopes: `backlog`, the range snapshot
   (stored under the historical `week` scope token, keyed by the exact range
   instants so each distinct range is its own cache entry) and `projects`. The
   repository catalog is observed at the same time: every repository named by a
   successfully read backlog, closure, merge or commit source is upserted, while
   a failed source contributes nothing and a repository absent from the range is
   left untouched. The router is then invalidated so the loader re-reads the
   cache.
4. A catalog change (`Add` or the pin toggle in the repository selector) goes through
   `repository.functions.ts`. Add validates the owner against `CODXGIT_ORG` (or `GITPOP_ORG`) before any call, invokes
   `gh repo view <owner/repo> --json nameWithOwner,url` through the injected reader, re-checks the
   response owner and name, and only then pins the row. The route invalidates so the catalog appears.
5. `buildWeeklySummary` is pure and deterministic: given snapshots, the catalog, a
   repository filter plus an optional Project filter it returns the whole view.
   Repository choices are the union of the catalog and any range-observed
   repository, and the per-range `itemCount` is attached to each choice — a
   catalog repository with no activity is a real `0`. All counting rules live
   there and are covered by unit tests. The two filters intersect.

## Honesty rules encoded in code

- **Missing is not zero.** Every source carries a coverage status. A denied
  scope, an unread window and a real zero are three different values.
- **Closed is not completed.** `issuesClosed.metric` counts closures;
  `completed` counts GitHub's `state_reason: completed`; `not_planned` is
  reported separately and never mixed into completion.
- **One item, one count.** Totals deduplicate by item URL. Selecting several
  Projects narrows the set to their union; it does not multiply counts. Per-Project
  rows intentionally repeat an item across its Projects, and the UI says so.
- **Repository is not Project.** Repository grouping is derived only from
  personal issues, pull requests and commits; organization-wide Project items
  never add a repository. A repository with no Project membership is a normal
  row and needs no Project filter. Commit-to-Project counts are labeled
  `repository-derived` everywhere they appear, and they never make a Project
  active on their own. When Projects are unreadable, the repository view is
  unaffected and Projects show `unavailable` with the reason.
- **The catalog is durable and range counts are separate.** A repository is
  identified by account + organization + normalized `owner/name`. Observation is
  an idempotent upsert that only refreshes the last-seen time: it never clears a
  pin, never resets first-seen, and never deletes a repository that is missing
  from a range. The selector therefore keeps repositories across periods, and the
  number shown beside one is its real count in the selected range, so `0` is
  "no activity here", not "unobserved".
- **Filters intersect.** Repository and Project selections narrow the same
  personal set; an item or commit must satisfy both. Empty means all personal.
- **Commits use the default-branch index.** `gh search commits` reads the
  default branch; the metric label says so.
- **Analytics completion and merge counts stay distinct.** Completed issues use
  `state_reason: completed`; merged PRs use `merged_at`; closed-unmerged PRs are
  never mixed into either list.
- **Lead time is conservative.** Only valid `created_at` → `merged_at` pairs are
  included; missing fields produce an unavailable metric rather than a fabricated
  duration.
- **Blocked issues are current and explicit.** The source uses `label:blocked` and
  exact returned label matching. It does not claim historical blocked coverage.
- **Bounds are explicit.** Search reads paginate up to three pages of 100 and
  Project item reads use 100 items. A wider range such as the trailing 30 days
  can reach those caps, and hitting a bound marks the source `incomplete` with a
  note; it never silently passes as complete coverage. The bound stays at 300
  because GitHub's own search API stops at 1000 results, so a higher page cap
  would not lift the ceiling.
- **Demo is opt-in.** The demo dataset is used only for `?demo=true` or
  `CODXGIT_DEMO_MODE=1` (or `GITPOP_DEMO_MODE=1`), and every screen that renders it shows a demo label. It
  is never a fallback when a real read fails.

## Security boundary

- `gh` is invoked with `execFile` and a fixed argument array. Values are validated
  (owner, login, project number, limits, page, ISO dates) before they reach an
  argument, so there is no shell and no interpolation surface.
- Tokens stay in the CLI's own credential store. CodxGit never reads, stores,
  logs or returns a token. Verified: the produced client bundle contains neither
  `better-sqlite3` nor `child_process`, and no rendered HTML contained a token
  pattern.
- Project item reads use `--jq` projections that discard bodies and comments, so
  private item text never leaves `gh`.
- The hand add reaches exactly one command, `gh repo view <owner/repo> --json
  nameWithOwner,url`, built as a fixed argv. `assertRepoFullName` rejects any
  value that is not two safe path segments, so the argv cannot change shape; the
  owner is checked against `CODXGIT_ORG` (or `GITPOP_ORG`) before the call and the response owner
  after it, so a repository outside the organization is never persisted. The
  projection requests no contents, and a denied read is surfaced as a message
  rather than a saved row.
- The server binds to `127.0.0.1` only. SQLite lives under `.data/`, which is
  gitignored.

## Verification

Deterministic tests (`pnpm test`) cover the areas that must not drift:

| Area | File | Cases |
|------|------|-------|
| Week/range presets | `tests/week.test.ts` | trailing 7/15/30/90 inclusive local boundaries, week presets, month-end clamp (leap and non-leap), year crossing, timezone independence, DST transitions, inclusive instant checks |
| Engineering Analytics | `tests/analytics.test.ts`, `tests/summary.test.ts`, `tests/gh.test.ts` | exact blocked-label reads, median lead time, unavailable cycle time, linked Markdown report and lead-time formatting |
| Aggregation | `tests/summary.test.ts` | dedup across Projects, filter union, not-planned separation, unavailable vs not-covered, week boundaries, repository-derived commit attribution, repository choices derivation, no-Project repository, repo filter, repo ∩ Project intersection, commit-only Project exclusion, Project rows respect both filters |
| gh mapping | `tests/gh.test.ts` | fixed argv, input rejection, permission/missing/command classification, projection parsing, `gh repo view` argv and projection |
| Snapshot cache | `tests/snapshots.test.ts` | idempotent upsert, account isolation, organization isolation, exact-window lookup, distinct ranges stay independent, identity upsert |
| Repository catalog | `tests/repositories.test.ts` | composite account/org/name isolation, case-insensitive identity with preserved display name, idempotent observation, last-seen update with no deletes, manual pin preserved across observation, pin toggle without delete, wrong-org and malformed-slug rejection before any `gh` call, validated add, duplicate idempotence, scope-failure and mismatched-response rejection |
| URL params | `tests/query.test.ts` | `p`-prefixed project round-trip, non-numeric form, tolerant parsing, repository round-trip/sort/dedupe, path and traversal rejection, preset/date-anchor parsing and round-trip |
| Demo request threading | `tests/dashboard.test.ts` | trailing-30 default, preset and anchor threading, demo repository with no Project, repo filter threading, repo ∩ Project intersection, catalog loaded and listed when no snapshot is cached |

`pnpm typecheck` and `pnpm build` are required and pass. `pnpm build` writes
`dist/client` and `dist/server`; the generated `src/routeTree.gen.ts` is
produced by the build. `pnpm start` serves that production build through
`vite preview`.

The project uses pnpm as its only package manager: `package.json` pins
`packageManager: pnpm@11.9.0`, the dependency graph is recorded in
`pnpm-lock.yaml`, and `package-lock.json` is not used. pnpm blocks dependency
lifecycle scripts by default; the two packages that legitimately need a native
build step are allow-listed per-package in `pnpm-workspace.yaml` (`better-sqlite3`
for its native binding, `esbuild` for its platform binary). `better-sqlite3` is
verified at runtime, not only at build time: the snapshot tests open real SQLite
databases through it (`createDatabase(':memory:')` over the pnpm-linked module).

Local HTTP smoke check (dev server on loopback, then stopped): `GET /`,
`GET /?demo=true`, `GET /?demo=true&repos=demo-organization/docs-site`,
`GET /?demo=true&repos=demo-organization/api-planning&projects=p10`,
`GET /?week=2026-09-28`, `GET /?demo=true&preset=last-15-days`,
`GET /?demo=true&preset=this-week&week=2026-10-05`,
`GET /?demo=true&preset=last-week`,
`GET /?demo=true&preset=one-month&week=2026-03-31` and
`GET /?demo=true&preset=bogus` all return `200`. The rendered page contains the
repository-first card, the sidebar navigation, the account/organization footer
and the coverage panel. The demo renders `4 active` repositories with no filter
and `1 active` under the `docs-site` repository filter; the Projects table is
limited to `API planning` under `repos=api-planning&projects=p10`. The bare route
opens on **Last 30 days**; an explicit `week` anchor renders its Monday–Friday
label; the one-month preset renders `Feb 28, 2026 – Mar 31, 2026` for the
2026-03-31 anchor; an unknown preset falls back to the default range. An
unsynced range renders `not covered`.

Catalog smoke (own dev server on loopback port 4192, then stopped). A fresh
SQLite file was migrated with the generated `0001` migration and seeded with one
observed repository (`desarrollo-intelicorps/api-autogestion`) and one pinned
repository (`desarrollo-intelicorps/panel-pinned`) alongside covered-but-empty
backlog and range snapshots. `GET /` returned `200` (51,615 bytes) and the
rendered payload contained both choices with `itemCount: 0` (`pinned:false,
source:"observed"` and `pinned:true, source:"manual"`), an empty `active` list, the
`0` covered metric, and the copy "Pinned with no activity in this range". This is
the acceptance case: a pinned repository is present with no fabricated activity.
Six URLs returned `200`: `/`, `/?demo=true`,
`/?demo=true&repos=demo-organization/docs-site`, `/?demo=true&preset=last-15-days`,
`/?demo=true&preset=this-week&week=2026-10-05` and
`/?demo=true&preset=last-30-days&repos=demo-organization%2Fnonexistent`.

Browser-level visual verification was not performed: no browser automation tool
was available in this environment. Responsive behavior is implemented with
tables above `md`, stacked lists below it, and a shadcn sidebar that collapses on
desktop and becomes a sheet on mobile, but that has not been observed in a real
browser.

## Known limits

- Preference persistence across restarts is not implemented; the URL is the
  saved state. The sidebar's expanded/collapsed state is kept in a cookie, while
  the range preset/anchor, repository and Project filters live in the URL, so
  reopening the same URL restores the view. The repository **catalog** itself is
  durable in SQLite and is not part of the URL.
- Unpinning flips the `pinned` flag and keeps the catalog row; there is no
  delete action, because removing an observed repository would only make it
  reappear on the next refresh. A hand add is validated against the live
  organization only at add time.
- The catalog grows from what the selected ranges actually observe. A repository
  that never appears in any synced personal source must be added by hand to be
  selectable.
- The repository `Add` form and the pin toggle are implemented and covered by
  unit tests at the data and validation boundary, but their browser interaction
  was not exercised: no browser automation was available in this environment, so
  no visual claim is made for the dropdown or the add form.
- Coverage is bounded by the read limits above; `incomplete` marks the gap.
- Only the current account and organization configured for the process are
  shown. Switching identity means changing the active `gh` account and running
  Refresh.
- Projects read requires the `read:project` scope on the active account. When it
  is absent, the Projects card and breakdown show `unavailable` with the reason
  and the user-driven `gh auth refresh -s read:project` guidance.

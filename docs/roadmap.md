# Roadmap

Implementation lands in small increments. Each milestone is useful on its own and produces evidence before the next one starts.

## Milestones

| # | Milestone | Outcome |
|---|-----------|---------|
| 0 | Access probe | Confirm the organization's Projects, fields, and statuses are readable |
| 1 | Skeleton | Bounded local server, GitHub CLI access path, local store, empty views |
| 2 | Sync | Paginated, idempotent reads with coverage and freshness bookkeeping |
| 3 | Default list | Monday–Friday completed-work list with linked item details |
| 4 | Filtering | Project multiselect, custom periods up to one year, saved preferences |
| 5 | On-demand charts | Optional charts over an already-trusted dataset |
| 6 | Hardening | Offline and stale states, per-account isolation, coverage reporting |

Charts come last on purpose: they are only trustworthy once the counting rules are settled and the data underneath them is honest.

## Discovery blocker

`gh project list --owner desarrollo-intelicorps --format json --limit 30` was rejected for a
missing `read:project` scope during discovery. As of the MVP implementation it succeeds with the
active account (`desarrollador1IR`, which holds `read:project`), while another authenticated account
on the same machine (`ivanosquis10`) does not hold that scope.

What this means now:

- Projects are readable for the active account and the dashboard renders the per-Project breakdown.
- The denied case is still a first-class runtime state: CodxGit renders Projects as *unavailable*
  with the reason and the user-driven `gh auth refresh -s read:project` guidance, and never
  substitutes repository grouping for Project membership.
- **No credential mutation is performed by this work.** The remedy stays a normal, user-driven `gh`
  authorization step.

## Delivered in the runnable MVP (Milestones 1–4, reduced)

| Milestone | Delivered | Deliberately reduced |
|-----------|-----------|----------------------|
| 1 Skeleton | Local loopback server, `gh` access path, SQLite store | No account switcher UI |
| 2 Sync | Paginated reads, idempotent snapshots, coverage and freshness rows | No scheduled or background sync |
| 3 Default list | Trailing 30-day default with This week / Last week / Last 15 days / 1 month presets, linked items, backlog separated from closures | No item detail page |
| 4 Filtering | Project multi-select, range presets with previous/next week, durable repository catalog with validated hand add and pin | Preferences live in the URL, not in local storage |
| 5 On-demand charts | Not built | Charts remain deferred; future charts must use shadcn charts |
| 6 Hardening | Account/org isolation, unavailable vs not-covered, permission guidance | Offline detection is limited to the last refresh warnings |

See [implementation.md](implementation.md) for the module map, verification evidence and known limits.

## Repository catalog (delivered)

The repository selector no longer depends on the repositories observed in one range:

- A SQLite `repositories` table is keyed by account + organization + normalized `owner/name` and
  records first-seen, last-seen, pin and source (`observed` or `manual`).
- Every successful personal data sync upserts the repositories it named; a failed source contributes
  nothing and an absent repository is never deleted.
- A manual add validates `owner/repo` against `CODXGIT_ORG` (or `GITPOP_ORG`), runs only
  `gh repo view <owner/repo> --json nameWithOwner,url` as a fixed argv, re-checks the response, and
  pins the row. There is no organization-wide repository scan and no delete action yet.
- The router is invalidated after a catalog change so the new choice appears without a page reload.

This closes the catalog half of the repository-first milestone. The remaining items are independent
verification/native preflight, an eventual decision on delete/removal semantics, and the still
unbuilt opt-in charts.

## Pending decisions

| Decision | What it blocks | Options on the table |
|----------|----------------|----------------------|
| Attribution | Which "completed by" signal is authoritative | Current assignee, event actor, historical assignee |
| Project Done mapping | Whether Project Done participates in completion | Project Done only, item closed only, or an explicit combination |
| History coverage | How far back is worth syncing | Since first sync, since account access, or an explicit bounded range |

## Next step

Pick up [implementation.md](implementation.md) and decide which known limit matters next: saved
preferences, a deeper history window, explicit offline detection, or delete/removal semantics for the
repository catalog.

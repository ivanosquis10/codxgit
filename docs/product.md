# Product

CodxGit answers one question well: **what did I complete this week, and what does the record actually prove?** It reads the GitHub work you already produce and shows it in a week-shaped view.

## Who it is for

- Contributors whose work spans several repositories and Projects in one organization.
- People who already authenticate with the GitHub CLI (`gh`) and do not want another login.
- Anyone who wants a personal record of completed work without uploading it anywhere.

It is not built for managers, team-wide reporting, or public sharing.

## The default experience

The default view is a plain list of completed work for the **trailing 30 days**, with quick presets for This week, Last week (Monday–Friday), Last 15 days, Last 30 days and 1 month.

| Control | Behavior |
|---------|----------|
| Date range | Trailing 30 days by default, with presets and previous/next week navigation |
| Repository filter | Multiselect over the durable catalog built from your own issues, pull requests and commits. This is the primary grouping, and a repository with no Project still appears |
| Repository add | Add `owner/repo` by hand; the server validates it with `gh repo view` inside the configured organization and pins it. It then stays selected across ranges |
| Project filter | Optional and secondary: multiselect across the Projects visible to the signed-in account, listed with your involved Projects first. Combines with the repository filter |
| Custom period | Any explicit range up to one year, still reported on day boundaries |
| Charts | Optional and requested on demand; the list is always usable without them |
| Details | Every row links to the underlying GitHub item |
| Saved state | Filters and preferences persist locally between sessions |

Charts are deliberately opt-in. The default screen stays fast and readable with no chart at all.

## Scope

- Read-only tracking of issues, pull requests, and Projects memberships.
- Completion reporting for one person in one organization at a time.
- A durable local repository catalog, observed from personal sources or added by hand after server-side validation inside the configured organization.
- Local persistence of the metadata the API returns, plus coverage and freshness bookkeeping.
- Reusable by any user who has their own `gh` identity and access to their own organization.

## Non-goals

- No writes to GitHub: no comments, labels, status changes, or item creation.
- No team, manager, or velocity reporting.
- No application login, account system, or OAuth flow owned by CodxGit.
- No hosting, cloud sync, or telemetry: data stays on the machine.
- No promised history the API cannot supply, and no fabricated backfill.

## Views and interactions

| View | What it shows | Why it exists |
|------|---------------|---------------|
| Repositories (primary) | Per-repository range closures, merges, commits and current open backlog, over a durable catalog built only from your own work | Group work by where it actually lives, with no dependency on Projects and no repository lost to a quiet period |
| Completed in range | Range list of completed items | The default answer |
| Projects (optional) | Per-Project counts for Projects you are personally involved in | Secondary lens when the organization uses Projects |
| Custom period | The same list shape over an explicit range | Month, quarter, or year review |
| Item detail | The linked GitHub item plus observed local evidence | Trust: jump straight to the source |
| On-demand charts | Optional aggregation over the current window | Spot patterns after reading the list |

## Acceptance criteria

Checked items are implemented and verified in the runnable MVP. Unchecked items are explicitly
out of the current MVP scope; see [implementation.md](implementation.md) for the limits.

- [x] The default view loads a range list without rendering any chart.
- [x] A completed item appears exactly once, even when it belongs to several Projects. (Unit-tested deduplication by item URL.)
- [x] Every count is traceable: a reader can see which items produced it. (Each metric has its item list below it.)
- [x] Missing data reads as unknown or uncovered, never as zero. (Distinct `ok` / `unavailable` / `not covered` states.)
- [x] The selected project filter, period, and preferences survive a restart. *(Not in MVP: the URL carries the state, so reopening the same URL restores the view; nothing is written to local storage. The repository catalog itself is durable in SQLite.)*
- [x] Repositories are the primary grouping and are derived only from personal sources. *(Unit-tested: a repository with no Project membership is selectable and its activity is counted; organization-only Project items never add a repository.)*
- [x] A repository stays selectable across ranges. *(Unit-tested: the catalog keeps a repository that a later range does not mention, and a catalog repository with no activity shows a real `0`.)*
- [x] A repository can be added by hand only after server-side validation inside the configured organization. *(Unit-tested: wrong-org and malformed slugs are rejected before any `gh` call; a denied read or a mismatched response writes nothing.)*
- [x] The repository and Project filters combine as an intersection. *(Unit-tested: each item and commit must satisfy both filters.)*
- [x] A Project is never marked active from repository commits alone. *(Unit-tested: commit activity in a repository does not create a Project row.)*
- [x] Every row links to the item on GitHub.
- [ ] A second user with their own `gh` identity and a different organization can run CodxGit without creating a CodxGit account. *(Architecturally true — there is no CodxGit login and every snapshot is account/org scoped — but it has not been exercised with a second identity.)*
- [x] No GitHub credential is readable by or sent to the frontend. (Verified: no token pattern in rendered HTML, and no database driver or command construction in the client bundle.)

### MVP scope notes

- The MVP covers the trailing-30-day default plus This week / Last week / Last 15
days / 1 month presets and previous/next week navigation. An item detail page is not implemented.
- The repository catalog is durable and account/organization-scoped. Unpin keeps the row; there is
  no delete action yet.
- Charts remain opt-in and unbuilt. Any future chart must use shadcn charts.

## Open product questions

Recorded here, not yet decided:

- How is work attributed when the current assignee differs from the person who completed it?
- Does "done" mean the item closed, or the Project status is Done — or both?
- How far back is history worth reconstructing before coverage gaps dominate the picture?

## Inspiration

- [gh-dash](https://gh-dash.dev)
- [Linear Insights](https://linear.app/docs/insights)
- [GitHub Projects insights](https://docs.github.com/en/issues/planning-and-tracking-with-projects/viewing-insights-from-your-project/about-insights-for-projects)

Linear Insights and GitHub Projects insights are references for how results are **presented**. CodxGit makes no assumption that any UI history or chart is retrievable through an API.

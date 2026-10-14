# Engineering Analytics

Implement a standalone Engineering Analytics view using the existing GitHub CLI, SQLite cache, TanStack Start routes, and shadcn UI patterns.

## Specs

### S1 — MVP overview
> Provide a clear, minimalist dashboard showing the authenticated GitHub user's development activity and delivery metrics.
>
> - Completed issues.
> - Merged pull requests.
> - Median PR Lead Time (created → merged).
> - Currently blocked issues, when identifiable.
> - Date-range filtering (7, 30, and 90 days).

### S2 — Repository breakdown
> Group activity and metrics by repository.
> Display completed issues and merged PRs.
> Allow users to inspect the related GitHub records.

### S3 — Contributions
> List completed issues and merged pull requests.
> Include repository, title, date, and GitHub URL.

### S4 — Weekly report
> Generate a concise summary using the retrieved GitHub data.
> Include completed work, merged PRs, and identifiable blockers.
> Support copying the report as Markdown.

### S5 — Metric definitions
> Throughput: issues genuinely completed within the selected period.
> PR Lead Time: elapsed time between PR creation and merge; display the median.
> Blocked Issues: open issues explicitly marked as blocked.
> Cycle Time: only calculate when reliable work-start events exist; otherwise display it as unavailable.

### S6 — Technical constraints
> Reuse the existing GitHub CLI integration and authentication.
> Follow the project's established architecture and UI patterns.
> Use structured GitHub CLI/API responses rather than parsing human-readable terminal output.
> Handle pagination, missing fields, API limitations, loading states, and errors.
> Avoid duplicate counting and distinguish closed issues from merged pull requests.
> Keep the implementation modular, simple, and maintainable.
> Do not add individual productivity rankings or arbitrary performance scores.
> Run relevant existing tests when available.
> Do not create commits or push changes unless explicitly requested.

### S7 — Resolved product decision
> Label `blocked`
>
> Contar issues abiertos que tengan exactamente el label `blocked` (recomendado).

## Tasks

- T1 (S1, S5-S6): Extend range and GitHub data models/queries for 7/30/90 days, PR creation timestamps, blocked labels, and median lead time. Done; no commit created because the user explicitly prohibited commits.
- T2 (S1-S3, S5): Build Analytics summary types/logic and route data loading with coverage-safe metrics and deduplicated repository/contribution breakdowns. Done; no commit created because the user explicitly prohibited commits.
- T3 (S1-S4, S6): Implement the Analytics UI, filters, report generation/copy, navigation, loading and error states using existing components. Done; no commit created because the user explicitly prohibited commits.
- T4 (S1-S6): Add focused tests and update relevant docs/help text; run typecheck, tests, and build. Done; no commit created because the user explicitly prohibited commits.
- T5 (S6): Prepare repository issue/PR workflow policy, create the work-unit commit, push the feature branch, and open an unmerged PR targeting `main`. In progress; work-unit commits `ac89d36` and `1c6f10c` are pushed; PR identity is blocked on an approved issue and required labels.

## Log

### L1
Implement a new **Engineering Analytics** view in the existing application.

First, inspect the current architecture, GitHub CLI (`gh`) integration, data-fetching patterns, components, and design conventions. Reuse the existing functionality whenever possible and avoid introducing unnecessary dependencies or a new backend.

### L2
Blocked issues are identified by an exact `blocked` GitHub label on currently open issues.

### L3
The focused verification pass passed: TypeScript compilation, 80 focused tests, and the production build. The full suite then passed with 136 tests across 9 files. The first `pnpm vitest` attempt was blocked by the environment because `better-sqlite3` could not compile under Node 24 without Visual Studio; a deliberate `pnpm install --ignore-scripts --frozen-lockfile` restored the JS toolchain, and the full suite including SQLite-backed tests passed. No commit or push was created.

### L4
sube los cambios y abre una pr que apunte a main, no merge,

### L5
The repository has no issue forms, PR template, `status:approved` label, or `type:*` label. The user authorized preparing the repository policy before continuing delivery.

### L6
The feature branch `feat/engineering-analytics` was pushed to `origin`. Commits `ac89d36` (`feat(analytics): add engineering analytics view`) and `1c6f10c` (`chore(repo): add issue and pull request templates`) are present. Opening the PR remains blocked because the policy files are not on `main` yet and protected approval/type labels do not exist.

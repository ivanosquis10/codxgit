# Weekly dashboard MVP

## Intent
Deliver a small runnable TanStack Start / shadcn dashboard for personal weekly GitHub work, with Drizzle SQLite storage and existing gh authentication. User explicitly authorized implementation and dependency setup, not publishing or commits.

## Scope
Weekly overview: open issues and PRs (current backlog, labeled separately), issues closed and PRs merged during the selected week, personal commits and active GitHub Projects, plus per-Project breakdown and linked items. Week defaults to Monday–Friday in an explicit timezone. Previous/next week and refresh suffice; no chart builder. Future charts use shadcn charts. Project membership must not be replaced by repository grouping.

## Constraints and assumptions
- Target root: C:/Users/Windows 11/OneDrive/Documentos/projects/side-projects/codxgit (formerly gitpop).
- Initial organization desarrollo-intelicorps; existing gh account, no custom login or credential mutation.
- Parent reran gh project list from target root: missing read:project persists. Show unavailable metrics and permission guidance honestly. Demo data only in an explicitly labeled optional demo mode if implemented.
- Assignee/author personal-work scope must be labeled; closed does not necessarily mean completed. Commit project attribution must be marked repository-derived or unavailable, never invented.
- SQLite data and secrets excluded from source control; fixed server-side gh argument arrays, local loopback only, no arbitrary shell execution.
- Existing .atl and documentation preserved. Existing Git repository is on unborn master with no commits; do not stage, commit, initialize or mutate unrelated Git metadata without explicit user request.
- Forecast ~700–1200 source/test/docs lines for initial scaffold; one coherent local MVP, no PR delivery requested. No artificial line cap or cosmetic compression.

## Tasks
- [x] T1 (done): Implement runnable app, minimal server-side gh adapter, local snapshot cache, dashboard UI, deterministic tests and updated docs. Delegated writer (multi-file trigger). Acceptance: install/build/typecheck/tests pass; honest denied-scope state; shadcn cards/table/buttons, week navigation, refresh and Project breakdown when accessible. No charts required.
- [ ] T2 (in progress): Independently verify commands and browser/smoke behavior where tooling allows; report blocked checks. Delegated verifier (external install/UI verification trigger). Acceptance: no frontend token exposure, no invented scope data, correct aggregation/date boundaries and usable responsive UI.

## Verification policy
Test-first for runnable deterministic week/aggregation/error-state logic: observed failing tests before behavior, green afterwards. Passive docs exempt. User requires pnpm as the sole package manager. Worker runs pnpm test, pnpm typecheck, pnpm build and a local HTTP smoke check; adjust package scripts to these names. Browser verification required if available, otherwise explicitly report unavailable and perform HTTP/render checks, not claim visual verification.

## Evidence and next step
Initial parent gh Project read was blocked; worker subsequently reports successful live Projects read and refresh for the active identity. Worker completed initial npm-based implementation: 54 tests passed, typecheck/build and HTTP smoke passed; real browser verification unavailable. User now requires pnpm and alignment with https://tanstack.com/start/latest/docs/framework/react/getting-started. T1 implementation and pnpm migration verified: pnpm 11.9.0 pinned, pnpm-lock.yaml present, npm lock removed, native build approvals restricted to better-sqlite3/esbuild. Independent verifier observed 54 tests passed, typecheck/build passed and local HTTP smoke; server stopped. Real browser verification unavailable. T2 remains open for native review: ASSESS was unassessable because files are untracked; INSPECT requires intended-untracked selection before START. No native lineage created or approval claimed. Residual npm files in node_modules remain; fresh pnpm install works, destructive cleanup not performed. Framework docs checked through Context7: TanStack Start Vite plugin before React plugin; shadcn manual Tailwind v4 components; Drizzle better-sqlite3 setup. Authorize no GitHub writes or auth changes. Begin T1, then assess diff under native RDD and follow returned review route. No completion checkoff until checks observed. Commit evidence pending explicit user request.

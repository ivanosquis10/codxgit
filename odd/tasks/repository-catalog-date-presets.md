# Persistent repository catalog and date presets

## Objective
Keep repositories available independently from current-week activity and make date-range selection useful for weekly and rolling work summaries.

## Accepted scope
- Add a durable repository catalog in SQLite, uniquely keyed by GitHub account login + configured organization + full repository name.
- Seed/update it idempotently from personal repositories observed in synced issue/PR/commit data. Preserve old catalog rows when absent from a range.
- Support manually adding a repository after server-side `gh` access validation within the configured organization; make it persistent/pinned, with clear removal/unpin behavior if safe.
- Repository selector reads catalog, not merely current range choices. Do not fabricate counts; selected repo may have no activity in the current range.
- Default range: trailing 30 calendar dates including today in configured timezone.
- Quick presets: This week and Last week (Monday-Friday); Last 15 days (calendar days including today); 1 month (calendar month lookback through today, distinct from 30 days).
- Date ranges carry explicit `startIso`, `endIso`, timezone, preset and display label; SQLite snapshot identity uses account+org+scope+range boundary.
- Keep repositories + projects filters intersecting. Keep shadcn UI; no chart scope.

## Range conventions
For rolling presets calculate local date boundaries (midnight at start, end-of-day at end) in configured timezone. Last 30 = today and prior 29 dates. Last 15 = today and prior 14 dates. 1 month = corresponding local calendar date one month earlier through today; clamp to last valid day in prior month (e.g. March 31 → February 28/29). Week presets remain Monday-Friday inclusive. URL should encode preset/date anchor so refresh and back/forward preserve selection.

## Constraints
- TanStack Start, shadcn/ui, Drizzle ORM/SQLite; pnpm only.
- Use fixed argv `execFile` gh operations, validate exact org/repo owner, avoid shell strings; no token persistence/client exposure.
- Keep refresh paginated and bounded; mark partial coverage honestly at GitHub/search limits. Do not silently call an unbounded org-wide repo scan.
- No chart creation, auth scope modifications, git staging/commits, or publishing. Prior RDD preflight pending is unrelated; obtain fresh preflight after this source-mutating candidate unless user explicitly defers review of this candidate.

## Tasks
- [x] C1 (done): Generalize time-window domain and implement presets/calculation, range-keyed cache/sync and filter UI. Route: delegated bounded writer due multi-file and broad flow. Acceptance: exact local date boundaries, all four presets, last-30 default, week navigation, no week-only assumptions, useful bounded pagination and coverage. Test-first RED/GREEN.
- [x] C2 (done): Add account/org/repo-unique catalog with idempotent observe/upsert and safe manual add/pin validation; repository filter queries catalog and keeps repositories across periods. Acceptance: unique composite identity, same full repo in different accounts/orgs isolated, refresh doesn't delete absent catalog rows, invalid/unauthorized/wrong-org repos rejected, no user token persisted. Test-first RED/GREEN.
- [x] C3 (done): Fixed date anchors and last-week navigation; independently verified checks, catalog/ranges and stale copy. Navigation helpers observed RED (8 failed) then GREEN (26 passed); full suite 118/118, typecheck/build passed. Fresh SQLite migration and catalog behavior covered; preset and last-week prev/next HTTP smoke passed. Native inspect/start completed; consent declined for this exact candidate (`lineage_created:false`, no mutation). ASSESS returned unassessable/high because native could not assess accumulated untracked files; independent verifier completed the risk-gated separate verification. Browser unavailable; no visual claim.

## Verification
RED before repository catalog queries and range calculations; GREEN and boundary tests (leap day, month end, timezone/DST if applicable, inclusivity, URL roundtrip, DB isolation/upsert). Commands pnpm test/typecheck/build, own loopback smoke. Browser UI verification when tool available; don't claim if unavailable. 30-day source caps must be checked against rate/search bounds and incomplete notes.

## Evidence
Current repo list exists only in `src/lib/summary.ts` choices; SQLite stores windowed JSON snapshots keyed by account/org/scope/range. There is no catalog table, repo-list gh adapter or add UI. Current date domain is `WeekRange` fixed Mon-Fri; date math is `src/lib/week.ts`; snapshot supports window boundaries but typed scope only backlog/week/projects. Explorer mapped these paths on 2026-10-05. Existing default timezone America/Caracas. Chosen month-end rule above is explicit to avoid rollover ambiguity. C1 completed via delegated worker: RED 38 failures / 46 passes before implementation; GREEN 84 tests plus typecheck/build and 8 HTTP smoke URLs. Last 30 days is the default; all 5 preset buttons render. Cache retains literal `week` scope for compatibility with historical keys; generic start/end distinguish ranges. 300-result issue/PR and 100-commit caps retained; coverage marked incomplete. Range-facing component copy is neutralized; actual preset labels remain by design.

## Next step
C2 implemented: unique account/org/lowercase full-name composite identity, source observation and manually validated add/pin, selector loads catalog and pins survive refresh. Writer RED 8 failures/77 passed, then GREEN 107/107; typecheck/build and fresh SQLite migration + HTTP seed/demo/preset smoke passed. No live GitHub mutation; route validation mocked. C3 fixed date anchors and last-week navigation; final independent verifier passed 118 tests/typecheck/build, checked catalog migration tests and HTTP preset links/navigation, and found no stale weekly copy. One verifier's first attempt used the wrong cwd and aborted; parent diagnosed separately, confirmed target untouched, then verification reran explicitly from the app root and passed. Native review consent declined for this exact candidate (`lineage_created:false`, no mutation); assessment unassessable/high due accumulated untracked paths; separate independent verification completed. Browser visual check unavailable. No source commits (user did not request).

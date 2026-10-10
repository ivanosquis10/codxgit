# CodxGit project foundation

## Objective
Create a documentation-only foundation for a local-first personal GitHub work dashboard. No application implementation is authorized in this work unit.

## Scope and constraints
- Create `README.md` and focused documents in `docs/`.
- Stack: TanStack Start, shadcn/ui, Drizzle ORM, SQLite; existing GitHub CLI authentication.
- Explore only `desarrollo-intelicorps`; no authentication changes or GitHub mutations.
- Default experience: completed work for Monday–Friday; optional charts and custom ranges through a year.
- Technical documentation is English. Git initialization, commits, dependency installation and application code are out of scope.

## Tasks
- [x] T1 (done): Write linked product, architecture, metrics and MVP documents. Route: delegated writer; trigger: multiple nontrivial documentation files. Acceptance: distinguish decisions from unverified assumptions; include scope, views, history limitations, attribution, deduplication, security and next steps.
- [x] T2 (done): Verify document links and consistency. Route: read-only verifier. Acceptance: all local links resolve, no fabricated org structure or runnable app claims.

## Verification
Passive documentation: no meaningful RED/GREEN test cycle. Use structural link checks and content review.

## Evidence
- `gh project list --owner desarrollo-intelicorps --format json --limit 30` failed with missing `read:project`, even after user reported refreshing authentication. Actual Projects fields and statuses remain unknown.
- Folder name selected: CodxGit (`codxgit`). No existing folder observed in parent directory listing.
- Forecast: approximately 250–350 documentation lines; one coherent documentation unit, no delivery requested.
- Commit evidence: not applicable; no Git initialization or commits requested.

## Next step
Documentation bundle complete: README and four docs (worker reports 282 lines). Parent read back README at the intended path. Independent verifier read all five files and checked 9 relative links with Python: none missing; no material consistency issues or invented organization fields. Worker verified three external references returned HTTP 200; verifier did not repeat network checks. Tests/build/lint skipped appropriately for passive documentation with no application runner. Resolve project-read access separately before validating GitHub-specific mappings; application implementation remains future work.

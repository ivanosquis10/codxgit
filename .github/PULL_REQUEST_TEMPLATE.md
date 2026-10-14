## Linked issue

Closes #<issue-number>

## PR type

Select exactly one:

- [ ] Bug fix
- [x] New feature
- [ ] Documentation only
- [ ] Code refactoring
- [ ] Maintenance/tooling
- [ ] Breaking change

## Summary

- Add the Engineering Analytics view with range-aware delivery metrics.
- Reuse the authenticated `gh` integration, SQLite snapshots, and existing UI patterns.
- Keep incomplete GitHub coverage and unavailable cycle time explicit.

## Changes

| File | Change |
|------|--------|
| `src/server/gh.server.ts` | Read structured PR creation timestamps and exact blocked labels. |
| `src/lib/summary.ts` | Compute completed work, repository metrics, median PR lead time, and coverage-safe states. |
| `src/routes/analytics.tsx` | Add the `/analytics` route and cache-backed filtering. |
| `src/components/engineering-analytics.tsx` | Render overview metrics, repository breakdown, contributions, and Markdown report copy. |
| `tests/` and `docs/` | Cover the new behavior and document metric definitions and limits. |

## Test plan

- [x] `./node_modules/.bin/vitest run` — 136 tests passed.
- [x] `./node_modules/.bin/tsc --noEmit` — passed.
- [x] `pnpm build` — passed.
- [x] `git diff --check` — passed.
- [ ] Browser visual smoke test — not available in this environment.

## Contributor checklist

- [ ] Linked an approved issue.
- [ ] Added exactly one `type:*` label.
- [x] Ran applicable checks; no shell scripts were modified.
- [x] Docs updated for the behavior change.
- [x] Conventional commit format used.
- [x] No `Co-Authored-By` trailers.

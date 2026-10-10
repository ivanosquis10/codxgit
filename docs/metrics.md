# Metrics

Every number in CodxGit has to survive one question: *which items produced it?* This document defines the terms and the counting rules that keep the answers honest.

## Core definitions

| Term | Definition | Careful note |
|------|------------|--------------|
| Completed | An item reached a terminal completed state inside the window | See the closure rules below |
| Reopen event | An observation that a previously completed item became active again | An event, not a reversal of recorded history |
| Merge | A pull request was merged | Distinct from closure |
| Closure | An item stopped being open, for any reason | May or may not mean completion |

## Counting rules

1. **Completed is not "closed".** An item closed as *not planned* is not completed work. It is reported separately and never mixed into completion totals.
2. **PR merge and PR closure are distinct.** A merged pull request is completed. A closed-unmerged pull request is not, and is counted apart.
3. **Reopen events are not completions.** An item reopened and completed again yields one reopen event and one completed item — not two completed items. Totals count **unique completed items**.
4. **One item, one count.** An item belonging to several Projects is counted once in any total. Project filters narrow the set; they never multiply it.
5. **Repository rows do not double-count.** Every item and commit belongs to exactly one repository, so per-repository counts sum to the scope totals.
6. **Project Done and issue closed are never assumed equal.** Project status and item state are different observations. Any metric needing both must state which one it used.
7. **Snapshots cannot recover missed transitions.** Field snapshots are captured at sync points; a transition that happened between two snapshots and was not observed cannot be reconstructed from them.
8. **Missing is not zero.** An uncovered window, an unread scope, or an unavailable field renders as *unknown*, *not covered*, or *unavailable* — never as `0`.
9. **A catalog repository with no range activity is a real zero, not missing data.** Its absence
   from a range's items is a covered observation when the sources were read, so the selector shows
   `0`. An unread source still renders as `not covered`/`unavailable`, never as `0`.
10. **Time boundaries are explicit.** A range declares one timezone and inclusive start/end
   instants. The default **trailing 30 days** is today plus the prior 29 local calendar dates;
   **Last 15 days** is today plus the prior 14; **1 month** looks back one local calendar month and
   clamps to the last valid day of the prior month (March 31 → February 28/29) through today; the
   **week presets** run Monday 00:00 through Friday 23:59:59.999 in that timezone.

## Repository grouping (primary)

Repositories are the primary grouping, and they are derived from personal evidence only:

- A repository enters the **catalog** when one of your own sources mentions it: an open issue
  assigned to you, an open pull request you authored, an issue you closed in the range, a pull
  request you merged in the range, or a commit you authored in the range; or when you add it by hand
  inside the configured organization. Range sources are filtered to the exact range before they
  contribute.
- The catalog is **durable and range-independent**. It is keyed by account + organization +
  normalized `owner/name`, and a range that does not mention a repository never removes it. The
  repository selector therefore shows repositories that were observed earlier or pinned by hand with
  their **real** activity count in the selected range; `0` means "no activity in this range", not
  "not observed".
- Organization-wide **Project items never add a repository.** A repository that appears only inside a
  Project you can read, but that has no personal item or commit, is not shown.
- A repository with **no Project membership works normally.** It is a choice in the filter and a row
  in the breakdown without any Project filter.
- Per-repository counts are exact for the current scope. Because each item belongs to exactly one
  repository, the per-repository totals add up to the headline totals; the repository rows therefore
  do **not** double-count an item the way multi-Project rows can.
- The **repository filter and the Project filter intersect.** An item or commit is counted only when
  it satisfies both. An empty filter means every personal repository (or every Project).

## Projects (optional, secondary)

- A Project is active only when a **personal membership was observed**: you are an assignee on one of
  its items, or one of its items is one of your own tracked items. **Commit-only repository
  attribution never makes a Project active.**
- A Project's commit column is still inferred from the repository and is labeled
  `repository-derived`. It is shown only for Projects that are already active for another reason.
- Selecting a Project narrows the repository rows and the item lists; it never multiplies counts.

## Attribution

"Who did this?" has more than one defensible answer, and CodxGit does not guess:

| Signal | What it shows | Limitation |
|--------|---------------|------------|
| Current assignee | Who is assigned right now | Can change later; not necessarily who completed it |
| Event actor | Who performed the observed action | Only exists for events that were observed |
| Historical assignee | Who was assigned at some point | Often unavailable, because snapshots may have missed it |

Attribution is an **open decision**. Until it is settled, any view that depends on it must state which signal it used.

## History honesty

- CodxGit does not fabricate history: no synthetic backfill and no implied year of activity.
- A year-long range is only as complete as the coverage recorded for it. Covered, partially covered, and uncovered periods are labeled as such.
- Completion figures are reported per window together with their coverage state, so a low number is never quietly a coverage gap.

## Checklist

These rules are the contract. The runnable MVP implements and unit-tests them; see the
"Honesty rules encoded in code" and "Verification" sections of
[implementation.md](implementation.md).

- [ ] Every displayed number resolves to a list of contributing items.
- [ ] Not-planned closures and closed-unmerged pull requests are excluded from completion totals and surfaced separately.
- [ ] Reopened-and-recompleted items count once as completed, with the reopen event visible.
- [ ] Multi-Project items never inflate totals.
- [ ] Unknown, uncovered, and zero are semantically and visually different.
- [ ] Every window states its timezone and its boundaries.

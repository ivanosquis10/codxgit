# Architecture

Conceptual design only. This document fixes boundaries and a vocabulary. It deliberately contains no schema, no code, no configuration keys, and no library API or version claims — those are implementation decisions that follow the first milestone.

## Stack

| Layer | Decision | Note |
|-------|----------|------|
| Framework | TanStack Start | Not merely TanStack Router: the server runtime is part of the design |
| UI | shadcn/ui | Components live in the repository and are owned by it |
| Persistence | Drizzle ORM over SQLite | A local relational store with a typed query layer |
| GitHub access | The GitHub CLI (`gh`) authentication already present | CodxGit implements no auth of its own |

## Boundary with GitHub

- `gh` runs **server-side only**. The browser never calls GitHub directly.
- Every invocation uses a **fixed argument array** with validated values. No shell string is assembled from user input, so there is no shell interpolation and no injection surface.
- `gh` is treated as **transport to the GitHub REST and GraphQL APIs**. CodxGit documents only fields it has observed and proven; it does not promise fields, statuses, or scopes that have not been verified against the live API.
- Read-only by construction: no command that mutates GitHub state is issued.

## Local server

- CodxGit runs a **bounded local server**: one user, localhost only, no public listener.
- The server owns all GitHub access and all persistence. The frontend receives rendered results, nothing privileged.
- **No token is persisted by CodxGit and no token is exposed to the frontend.** The CLI keeps its own credential; CodxGit only relies on it being present.
- Metadata minimization: store what the tracked questions need, not full payloads of everything fetched.

## Isolation

- Every stored record is scoped to an **account and organization**, so two identities or two organizations never blend into one view.
- Switching account or organization switches the visible dataset. It never merges.

## Storage

- SQLite is the local store. Its file location is **user-configurable** and must resolve **outside source control**.
- The store is disposable: it can be deleted and rebuilt from GitHub plus a sync pass, with coverage and freshness rebuilt alongside it.
- A **durable repository catalog** lives beside the snapshots. It is keyed by account +
  organization + normalized `owner/name` (GitHub names are case-insensitive; the display spelling is
  kept alongside the normalized key). It records when a repository was first and last seen, whether
  it is pinned, and whether it was observed or added by hand. A snapshot range never deletes a
  catalog row.
- A catalog row is **observed** from a sync or **added by hand** only after the server validates the
  repository inside the configured organization. No organization-wide repository scan is performed.

## Sync

- Sync is **paginated** and **idempotent**: running it twice yields the same store rather than duplicates.
- Each sync records **coverage** — which account, organization, scope, and window were actually read — and **freshness** — when they were last read.
- Windows that were not read stay uncovered and are never silently rendered as zero.

## Read path

- **Cache first**: the UI answers from the local store immediately.
- **Explicit refresh** triggers a GitHub sync. The user chooses when.
- **Offline and stale are distinct states.** Offline means GitHub was not reached; stale means it was reached earlier and the coverage is old. The UI names which one applies.

## Grouping

- **Repository is the primary grouping.** It is derived entirely from the personal sources above and
  backed by the durable catalog, so it is available even when Projects are not readable, and it never
  depends on organization-wide Project items. A repository with no Project still appears, and a
  catalog repository stays selectable (with a real `0`) when the current range has no activity for it.
- **Project is an optional, secondary lens.** It is shown only where personal involvement was
  observed (assignment or a personal item). Repository commits never invent Project membership.
- The two filters **intersect**. Selecting repositories and Projects narrows the same personal set;
  no filter multiplies a count.

## Presentation

- The dashboard shell is a shadcn sidebar plus an inset content area. The sidebar owns navigation,
  the repository selection, the optional Project filter and account/organization context.
- The content area uses the remaining width; the layout is responsive rather than bounded to a fixed
  maximum, and the sidebar collapses or becomes a mobile sheet.
- State lives in the URL (`week`, `repos`, `projects`, `demo`), so a view is shareable and survives a
  reload without a server session.

## Conceptual entities

| Entity | Holds | Relationship |
|--------|-------|--------------|
| Repository catalog | One repository identity per account + organization, with first/last-seen, pin and source | Durable, independent of any range |
| Item | An issue or pull request identity and stable descriptive metadata | One row per GitHub item |
| Project membership | That an item belongs to a Project, with the observed status | Many per item |
| Event | A dated observation of something that happened to an item | Many per item |
| Field snapshot | The value of a tracked field as seen at a sync point | Many per item, ordered in time |
| Sync coverage | Which account, organization, scope, and window were read, and when | Bookkeeping, not user data |

Keeping memberships, events, and snapshots separate is what makes deduplication and honest counting possible: an item is counted once while its history stays inspectable.

## Unverified

The organization's actual Projects structure **was unverified during discovery**.
`gh project list --owner desarrollo-intelicorps` was originally rejected for a missing
`read:project` scope. It now succeeds with the active account, and the denied case remains a
first-class runtime state that renders as *unavailable* rather than as zero or as repository
grouping. Field names and statuses are still read defensively: CodxGit displays only the Project
title, number, URL, item count and the item membership it observes, and it makes no claim about
Project field semantics. CodxGit performs **no credential mutation** on the user's behalf.

## Implementation

This document stays conceptual on purpose. The concrete module map, data flow, counting rules as
code, verification evidence and known limits live in [implementation.md](implementation.md).

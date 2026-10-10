/**
 * Shared, client-safe types and source-coverage vocabulary.
 *
 * This module is imported by route components, so it must never import
 * server-only code (child_process, better-sqlite3, ...).
 */

/** Coverage status shared by metrics and coverage rows. */
export type MetricStatus = 'ok' | 'unavailable' | 'not-covered'

/**
 * A number that can be honestly absent.
 *
 * `unavailable` and `not-covered` are deliberately distinct from `{ value: 0 }`:
 * a denied GitHub scope or an unsynced window must never render as zero.
 */
export type Metric =
  | { status: 'ok'; value: number }
  | { status: 'unavailable'; reason: string }
  | { status: 'not-covered' }

/** Every selectable date-range preset. */
export type DateRangePreset =
  | 'this-week'
  | 'last-week'
  | 'last-15-days'
  | 'last-30-days'
  | 'one-month'

/** The presets in display order, used by the URL parser and the filter UI. */
export const DATE_RANGE_PRESETS: readonly DateRangePreset[] = [
  'this-week',
  'last-week',
  'last-15-days',
  'last-30-days',
  'one-month',
]

/** The trailing 30 calendar dates, the range the dashboard opens with. */
export const DEFAULT_RANGE_PRESET: DateRangePreset = 'last-30-days'

/** Human labels for the preset buttons and the active-period summary. */
export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  'this-week': 'This week',
  'last-week': 'Last week',
  'last-15-days': 'Last 15 days',
  'last-30-days': 'Last 30 days',
  'one-month': '1 month',
}

/**
 * An explicit date range with inclusive instants in one timezone.
 *
 * `startDate`/`endDate` are the local calendar dates the window is computed
 * from; `startIso`/`endIso` are the matching inclusive UTC instants. Week
 * presets additionally carry their Monday and Friday; rolling presets do not.
 */
export type DateRange = {
  timeZone: string
  preset: DateRangePreset
  /** Inclusive local start date, `YYYY-MM-DD`. */
  startDate: string
  /** Inclusive local end date, `YYYY-MM-DD`. */
  endDate: string
  /** Inclusive start instant, ISO-8601 UTC. */
  startIso: string
  /** Inclusive end instant, ISO-8601 UTC. */
  endIso: string
  /** Human label for the window. */
  label: string
  /** Monday of the window, `YYYY-MM-DD`; only week presets carry it. */
  mondayDate?: string
  /** Friday of the window, `YYYY-MM-DD`; only week presets carry it. */
  fridayDate?: string
}

/** The outcome of reading one GitHub source. */
export type SourceResult<T> =
  | { status: 'ok'; data: T; incomplete: boolean; note: string | null }
  | { status: 'unavailable'; reason: string }
  | { status: 'not-covered' }

/** An open issue or pull request in the personal backlog (current state). */
export type RawBacklogItem = {
  id: string
  kind: 'issue' | 'pr'
  number: number
  title: string
  url: string
  repo: string
  updatedAt: string | null
}

/** A closure observed inside the selected week. */
export type RawClosedIssue = {
  id: string
  number: number
  title: string
  url: string
  repo: string
  closedAt: string
  /** GitHub's own state reason; null when GitHub did not provide one. */
  stateReason: 'COMPLETED' | 'NOT_PLANNED' | 'REOPENED' | 'OTHER'
}

/** A merged pull request observed inside the selected week. */
export type RawMergedPull = {
  id: string
  number: number
  title: string
  url: string
  repo: string
  mergedAt: string
}

/** A commit observed inside the selected week. */
export type RawCommit = {
  id: string
  sha: string
  message: string
  url: string
  repo: string
  committedAt: string
}

/** A Projects v2 project visible to the account. */
export type ProjectRef = {
  number: number
  title: string
  url: string
  closed: boolean
  /** `items.totalCount` reported by `gh project list`; null when absent. */
  itemTotalCount: number | null
}

/**
 * One Project↔item membership, minimized to the fields a personal weekly view
 * needs. Bodies and comments are never fetched or stored.
 */
export type ProjectItem = {
  projectNumber: number
  url: string
  repo: string
  type: string
  assignees: string[]
}

/** Server options that change which items are in scope. */
export type SummaryOptions = {
  projectFilter?: number[]
  /** `owner/name` repositories; empty or absent means every personal repository. */
  repoFilter?: string[]
}

export type BacklogItem = RawBacklogItem & { projectNumbers: number[] }
export type ClosedIssue = RawClosedIssue & { projectNumbers: number[] }
export type MergedPull = RawMergedPull & { projectNumbers: number[] }
export type CommitEntry = RawCommit & {
  shortSha: string
  projectNumbers: number[]
  /** How Project membership was derived for this commit. */
  projectAttribution: 'repository-derived' | 'unavailable'
}

/** Where a catalog row came from: a sync, or a validated hand add. */
export type RepositorySource = 'observed' | 'manual'

/**
 * One durable repository-catalog entry, decoupled from any date range.
 *
 * The catalog answers "which repositories may I select?"; the range summary
 * attaches the current activity count separately, so this entry may legitimately
 * carry no activity at all in the selected range.
 */
export type RepositoryCatalogEntry = {
  repo: string
  pinned: boolean
  source: RepositorySource
}

/** A repository offered by the filter, with its real activity count in the range. */
export type RepositoryChoice = {
  repo: string
  /** Personal items observed in this repository inside the current range; `0` is a real zero. */
  itemCount: number
  /** True when the repository was manually added or pinned. */
  pinned: boolean
  source: RepositorySource
}

/** Per-repository counts for the current scope; the primary grouping. */
export type RepositoryBreakdown = {
  repo: string
  issuesOpen: number
  pullsOpen: number
  issuesClosedInWeek: number
  pullsMergedInWeek: number
  commits: Metric
  /** Personal weekly events: range closures + merges + authored commits, per repository. */
  weeklyActivity: number
}

/** The repository-first view: the durable catalog plus its activity in the range. */
export type RepositoryView = {
  metric: Metric
  /** Catalog choices plus any range-observed repository, for the filter control. */
  choices: RepositoryChoice[]
  /** Repositories with activity inside the current repository/Project scope. */
  active: RepositoryBreakdown[]
}

/** Per-Project counts for the selected week, restricted to the personal scope. */
export type ProjectBreakdown = {
  number: number
  title: string
  url: string
  issuesOpen: number
  pullsOpen: number
  issuesClosedInWeek: number
  pullsMergedInWeek: number
  /** Commits are attributed to a Project by repository, never by membership. */
  commits: Metric
  itemCount: number
  attribution: 'assignee' | 'repository-derived'
}

export type SourceCoverage = {
  key: string
  label: string
  status: MetricStatus
  detail: string | null
  fetchedAt: string | null
}

/** The complete, deterministic weekly view consumed by the UI. */
export type WeeklySummary = {
  identity: string
  organization: string
  range: DateRange
  fetchedAt: string | null
  demo: boolean
  backlogIssues: { metric: Metric; items: BacklogItem[] }
  backlogPulls: { metric: Metric; items: BacklogItem[] }
  issuesClosed: {
    metric: Metric
    /** Closures GitHub reported with state reason `completed`. */
    completed: Metric
    /** Closures GitHub reported as `not_planned`; never mixed into completed. */
    notPlanned: Metric
    items: ClosedIssue[]
  }
  pullsMerged: { metric: Metric; items: MergedPull[] }
  commits: { metric: Metric; items: CommitEntry[]; attribution: 'repository-derived' | 'unavailable' }
  /** Repository-first grouping; the primary breakdown in the UI. */
  repositories: RepositoryView
  /** Optional, secondary Project grouping. */
  projects: {
    metric: Metric
    reason: string | null
    active: ProjectBreakdown[]
    all: ProjectRef[]
    /** Project numbers with observed personal membership, for filter ordering. */
    involved: number[]
    incomplete: boolean
  }
  coverage: SourceCoverage[]
}

/** Everything the weekly view needs, as plain data with no GitHub access. */
export type PersonalWorkInput = {
  identity: string
  organization: string
  range: DateRange
  fetchedAt: string | null
  demo: boolean
  openIssues: SourceResult<RawBacklogItem[]>
  openPulls: SourceResult<RawBacklogItem[]>
  closedIssues: SourceResult<RawClosedIssue[]>
  mergedPulls: SourceResult<RawMergedPull[]>
  commits: SourceResult<RawCommit[]>
  projects: SourceResult<ProjectRef[]>
  projectItems: SourceResult<ProjectItem[]>
  /**
   * The durable catalog for the active account + organization. Optional so a
   * caller with no catalog (and the demo dataset) still works; the summary then
   * derives choices from the range sources alone.
   */
  catalog?: RepositoryCatalogEntry[]
}

/** A fetched GitHub identity. */
export type Identity = {
  login: string
  name: string | null
}

/** Top-level payload returned to the dashboard route. */
export type DashboardData = {
  identity: Identity | null
  identityError: string | null
  organization: string
  timeZone: string
  demo: boolean
  demoEnabled: boolean
  dataState: 'ready' | 'empty'
  summary: WeeklySummary
  refreshedAt: string | null
}

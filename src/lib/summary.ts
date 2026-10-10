import { metricFromSource, notCoveredMetric, okMetric, unavailableMetric } from './metrics'
import { isWithinRange } from './week'
import type {
  BacklogItem,
  ClosedIssue,
  CommitEntry,
  MergedPull,
  Metric,
  PersonalWorkInput,
  ProjectBreakdown,
  ProjectItem,
  ProjectRef,
  RawBacklogItem,
  RawClosedIssue,
  RawCommit,
  RawMergedPull,
  RepositoryBreakdown,
  RepositoryChoice,
  RepositoryView,
  SourceCoverage,
  SourceResult,
  SummaryOptions,
  WeeklySummary,
} from './types'

function uniqueByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    if (seen.has(item.url)) continue
    seen.add(item.url)
    result.push(item)
  }
  return result
}

/** url → project numbers, from the observed Project item memberships. */
function buildProjectIndex(projectItems: SourceResult<ProjectItem[]>): Map<string, number[]> {
  const index = new Map<string, number[]>()
  if (projectItems.status !== 'ok') return index
  for (const item of projectItems.data) {
    const projects = index.get(item.url) ?? []
    if (!projects.includes(item.projectNumber)) projects.push(item.projectNumber)
    index.set(item.url, projects)
  }
  return index
}

/** repo → project numbers, derived only from observed Project memberships. */
function buildRepoProjectIndex(projectItems: SourceResult<ProjectItem[]>): Map<string, number[]> {
  const index = new Map<string, number[]>()
  if (projectItems.status !== 'ok') return index
  for (const item of projectItems.data) {
    const projects = index.get(item.repo) ?? []
    if (!projects.includes(item.projectNumber)) projects.push(item.projectNumber)
    index.set(item.repo, projects)
  }
  return index
}

function matchesFilter(projectNumbers: number[], filter: number[] | undefined): boolean {
  if (!filter || filter.length === 0) return true
  return projectNumbers.some((number) => filter.includes(number))
}

/** Case-insensitive `owner/name`, so the canonical repository order is stable. */
function compareRepos(a: string, b: string): number {
  return a.toLowerCase().localeCompare(b.toLowerCase())
}

/** Lowercased repository filter, or `null` when every personal repository is in scope. */
function repoFilterSet(filter: string[] | undefined): Set<string> | null {
  if (!filter || filter.length === 0) return null
  return new Set(filter.map((repo) => repo.toLowerCase()))
}

function repoAllowed(repo: string, filter: Set<string> | null): boolean {
  return filter === null || filter.has(repo.toLowerCase())
}

/** Attach Project membership and narrow by both the Project and repository filters. */
function scopeItems<T extends { url: string; repo: string }>(
  items: T[],
  projectIndex: Map<string, number[]>,
  projectFilter: number[] | undefined,
  repos: Set<string> | null,
): (T & { projectNumbers: number[] })[] {
  return uniqueByUrl(items)
    .map((item) => ({ ...item, projectNumbers: projectIndex.get(item.url) ?? [] }))
    .filter((item) => matchesFilter(item.projectNumbers, projectFilter))
    .filter((item) => repoAllowed(item.repo, repos))
}

function coverageRow<T>(
  key: string,
  label: string,
  source: SourceResult<T>,
  fetchedAt: string | null,
): SourceCoverage {
  if (source.status === 'ok') {
    return { key, label, status: 'ok', detail: source.note, fetchedAt }
  }
  if (source.status === 'unavailable') {
    return { key, label, status: 'unavailable', detail: source.reason, fetchedAt }
  }
  return { key, label, status: 'not-covered', detail: null, fetchedAt }
}

/**
 * The Projects view is only readable when both the project list and the item
 * membership read succeeded. A denied scope is never collapsed to zero or to
 * an empty active list.
 */
function projectsFailure(input: PersonalWorkInput): Metric | null {
  if (input.projects.status === 'unavailable') return unavailableMetric(input.projects.reason)
  if (input.projectItems.status === 'unavailable') return unavailableMetric(input.projectItems.reason)
  if (input.projects.status === 'not-covered' || input.projectItems.status === 'not-covered') {
    return notCoveredMetric
  }
  return null
}

/**
 * Repository derivation is only as complete as its sources. A count is `ok`
 * once any personal source is readable; it degrades to unavailable or
 * not-covered only when every contributing source did.
 */
function repositoriesMetric(sources: SourceResult<unknown>[], value: number): Metric {
  if (sources.some((source) => source.status === 'ok')) return okMetric(value)
  if (sources.every((source) => source.status === 'not-covered')) return notCoveredMetric
  const unavailable = sources.find((source) => source.status === 'unavailable')
  return unavailable ? unavailableMetric(unavailable.reason) : notCoveredMetric
}

/**
 * Turn normalized GitHub data into the deterministic weekly view.
 *
 * Pure: no network, no database, no clock reads.
 */
export function buildWeeklySummary(
  input: PersonalWorkInput,
  options: SummaryOptions = {},
): WeeklySummary {
  const { range, identity } = input
  const projectFilter = options.projectFilter
  const repos = repoFilterSet(options.repoFilter)
  const projectIndex = buildProjectIndex(input.projectItems)
  const repoIndex = buildRepoProjectIndex(input.projectItems)
  const failure = projectsFailure(input)
  const projectsReadable = failure === null
  const projects: ProjectRef[] = input.projects.status === 'ok' ? input.projects.data : []
  const observedProjectItems: ProjectItem[] =
    input.projectItems.status === 'ok' ? input.projectItems.data : []

  // Personal weekly events, exact-window filtered before any scope filter.
  const closedInWeek: RawClosedIssue[] =
    input.closedIssues.status === 'ok'
      ? input.closedIssues.data.filter((issue) => isWithinRange(issue.closedAt, range))
      : []
  const mergedInWeek: RawMergedPull[] =
    input.mergedPulls.status === 'ok'
      ? input.mergedPulls.data.filter((pull) => isWithinRange(pull.mergedAt, range))
      : []
  const commitsInWeek: RawCommit[] =
    input.commits.status === 'ok'
      ? input.commits.data.filter((commit) => isWithinRange(commit.committedAt, range))
      : []
  const backlogIssueSource: RawBacklogItem[] =
    input.openIssues.status === 'ok' ? input.openIssues.data : []
  const backlogPullSource: RawBacklogItem[] =
    input.openPulls.status === 'ok' ? input.openPulls.data : []

  // Repository choices come only from personal sources, never from
  // organization-wide Project items — plus the durable catalog, so a repository
  // added by hand or observed earlier stays selectable when the current range
  // has no activity for it (its `itemCount` is then a real `0`).
  const choiceCounts = new Map<string, { repo: string; itemCount: number }>()
  for (const items of [
    uniqueByUrl(backlogIssueSource),
    uniqueByUrl(backlogPullSource),
    uniqueByUrl(closedInWeek),
    uniqueByUrl(mergedInWeek),
    uniqueByUrl(commitsInWeek),
  ] as const) {
    for (const item of items) {
      const key = item.repo.toLowerCase()
      const existing = choiceCounts.get(key)
      if (existing) {
        existing.itemCount += 1
      } else {
        choiceCounts.set(key, { repo: item.repo, itemCount: 1 })
      }
    }
  }

  const choiceMap = new Map<string, RepositoryChoice>()
  for (const [key, entry] of choiceCounts) {
    choiceMap.set(key, {
      repo: entry.repo,
      itemCount: entry.itemCount,
      pinned: false,
      source: 'observed',
    })
  }
  for (const entry of input.catalog ?? []) {
    if (typeof entry?.repo !== 'string' || entry.repo.length === 0) continue
    const key = entry.repo.toLowerCase()
    const existing = choiceMap.get(key)
    if (existing) {
      existing.repo = entry.repo
      existing.pinned = entry.pinned
      existing.source = entry.source
    } else {
      choiceMap.set(key, {
        repo: entry.repo,
        itemCount: 0,
        pinned: entry.pinned,
        source: entry.source,
      })
    }
  }
  const choices: RepositoryChoice[] = [...choiceMap.values()].sort((a, b) =>
    compareRepos(a.repo, b.repo),
  )

  const backlogIssues: BacklogItem[] = scopeItems(
    backlogIssueSource,
    projectIndex,
    projectFilter,
    repos,
  )
  const backlogPulls: BacklogItem[] = scopeItems(
    backlogPullSource,
    projectIndex,
    projectFilter,
    repos,
  )
  const closedIssues: ClosedIssue[] = scopeItems(closedInWeek, projectIndex, projectFilter, repos)
  const mergedPulls: MergedPull[] = scopeItems(mergedInWeek, projectIndex, projectFilter, repos)
  const commits: CommitEntry[] = uniqueByUrl(commitsInWeek)
    .map((commit) => {
      const projectNumbers = projectsReadable ? (repoIndex.get(commit.repo) ?? []) : []
      return {
        ...commit,
        shortSha: commit.sha.slice(0, 7),
        projectNumbers,
        projectAttribution:
          projectNumbers.length > 0 ? ('repository-derived' as const) : ('unavailable' as const),
      }
    })
    .filter((commit) => matchesFilter(commit.projectNumbers, projectFilter))
    .filter((commit) => repoAllowed(commit.repo, repos))

  const countInRepo = <T extends { repo: string }>(items: T[], repo: string): number =>
    items.filter((item) => item.repo.toLowerCase() === repo.toLowerCase()).length

  const activeRepositories: RepositoryBreakdown[] = choices
    .filter((choice) => repoAllowed(choice.repo, repos))
    .map((choice) => {
      const commitCount = countInRepo(commits, choice.repo)
      const issuesOpen = countInRepo(backlogIssues, choice.repo)
      const pullsOpen = countInRepo(backlogPulls, choice.repo)
      const issuesClosedInWeek = countInRepo(closedIssues, choice.repo)
      const pullsMergedInWeek = countInRepo(mergedPulls, choice.repo)
      return {
        repo: choice.repo,
        issuesOpen,
        pullsOpen,
        issuesClosedInWeek,
        pullsMergedInWeek,
        commits: metricFromSource(input.commits, commitCount),
        weeklyActivity: issuesClosedInWeek + pullsMergedInWeek + commitCount,
      }
    })
    .filter(
      (entry) =>
        entry.issuesOpen +
          entry.pullsOpen +
          entry.issuesClosedInWeek +
          entry.pullsMergedInWeek +
          (entry.commits.status === 'ok' ? entry.commits.value : 0) >
        0,
    )

  const repositories: RepositoryView = {
    metric: repositoriesMetric(
      [input.openIssues, input.openPulls, input.closedIssues, input.mergedPulls, input.commits],
      activeRepositories.length,
    ),
    choices,
    active: activeRepositories,
  }

  // URLs that belong to the personal scope, before any scope filter is applied.
  const personalUrls = new Set<string>()
  for (const source of [input.openIssues, input.openPulls, input.closedIssues, input.mergedPulls] as const) {
    if (source.status === 'ok') {
      for (const item of source.data) personalUrls.add(item.url)
    }
  }

  // Observed personal involvement only: an assignee match or a personal item
  // URL. Commits never make a Project relevant on their own.
  const involvedProjects = new Set<number>()
  const allLinkedItemsByProject = new Map<number, Set<string>>()
  for (const item of observedProjectItems) {
    const mine = item.assignees.includes(identity) || personalUrls.has(item.url)
    if (!mine) continue
    involvedProjects.add(item.projectNumber)
    const set = allLinkedItemsByProject.get(item.projectNumber) ?? new Set<string>()
    set.add(item.url)
    allLinkedItemsByProject.set(item.projectNumber, set)
  }

  const linkedItemsByProject = new Map<number, Set<string>>()
  for (const item of observedProjectItems) {
    const mine = item.assignees.includes(identity) || personalUrls.has(item.url)
    if (!mine) continue
    if (!matchesFilter([item.projectNumber], projectFilter)) continue
    if (!repoAllowed(item.repo, repos)) continue
    const set = linkedItemsByProject.get(item.projectNumber) ?? new Set<string>()
    set.add(item.url)
    linkedItemsByProject.set(item.projectNumber, set)
  }

  const commitsByRepo = new Map<string, number>()
  for (const commit of commits) {
    commitsByRepo.set(commit.repo, (commitsByRepo.get(commit.repo) ?? 0) + 1)
  }

  const commitMetricForProject = (number: number): Metric => {
    if (failure) return failure
    let total = 0
    for (const [repo, projectNumbers] of repoIndex) {
      if (projectNumbers.includes(number)) total += commitsByRepo.get(repo) ?? 0
    }
    return okMetric(total)
  }

  const activeProjects: ProjectBreakdown[] = projects
    .filter((project) => !project.closed)
    .map((project) => {
      const commitMetric = commitMetricForProject(project.number)
      return {
        number: project.number,
        title: project.title,
        url: project.url,
        issuesOpen: backlogIssues.filter((item) => item.projectNumbers.includes(project.number))
          .length,
        pullsOpen: backlogPulls.filter((item) => item.projectNumbers.includes(project.number)).length,
        issuesClosedInWeek: closedIssues.filter((item) =>
          item.projectNumbers.includes(project.number),
        ).length,
        pullsMergedInWeek: mergedPulls.filter((item) =>
          item.projectNumbers.includes(project.number),
        ).length,
        commits: commitMetric,
        itemCount: linkedItemsByProject.get(project.number)?.size ?? 0,
        attribution: 'assignee' as const,
      }
    })
    .filter((project) => project.itemCount > 0)
    .sort((a, b) => a.number - b.number)

  const projectsMetric: Metric = failure ?? okMetric(activeProjects.length)

  const completedCount = closedIssues.filter((issue) => issue.stateReason === 'COMPLETED').length
  const notPlannedCount = closedIssues.filter((issue) => issue.stateReason === 'NOT_PLANNED').length

  const coverage: SourceCoverage[] = [
    coverageRow('backlog-issues', 'Open issues (current backlog)', input.openIssues, input.fetchedAt),
    coverageRow('backlog-pulls', 'Open pull requests (current backlog)', input.openPulls, input.fetchedAt),
    coverageRow('closed-issues', 'Issues closed in range', input.closedIssues, input.fetchedAt),
    coverageRow('merged-pulls', 'Pull requests merged in range', input.mergedPulls, input.fetchedAt),
    coverageRow('commits', 'Commits authored in range (default branch)', input.commits, input.fetchedAt),
    coverageRow('projects', 'GitHub Projects (optional)', input.projects, input.fetchedAt),
  ]

  return {
    identity,
    organization: input.organization,
    range,
    fetchedAt: input.fetchedAt,
    demo: input.demo,
    backlogIssues: {
      metric: metricFromSource(input.openIssues, backlogIssues.length),
      items: backlogIssues,
    },
    backlogPulls: {
      metric: metricFromSource(input.openPulls, backlogPulls.length),
      items: backlogPulls,
    },
    issuesClosed: {
      metric: metricFromSource(input.closedIssues, closedIssues.length),
      completed: metricFromSource(input.closedIssues, completedCount),
      notPlanned: metricFromSource(input.closedIssues, notPlannedCount),
      items: closedIssues,
    },
    pullsMerged: {
      metric: metricFromSource(input.mergedPulls, mergedPulls.length),
      items: mergedPulls,
    },
    commits: {
      metric: metricFromSource(input.commits, commits.length),
      items: commits,
      attribution: projectsReadable ? 'repository-derived' : 'unavailable',
    },
    repositories,
    projects: {
      metric: projectsMetric,
      reason: failure && failure.status === 'unavailable' ? failure.reason : null,
      active: activeProjects,
      all: projects.slice().sort((a, b) => a.number - b.number),
      involved: [...involvedProjects].sort((a, b) => a - b),
      incomplete:
        (input.projects.status === 'ok' && input.projects.incomplete) ||
        (input.projectItems.status === 'ok' && input.projectItems.incomplete),
    },
    coverage,
  }
}

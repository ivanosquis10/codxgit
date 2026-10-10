import type { Database } from '@/db/client.server'
import { observeRepositories } from '@/db/repositories.server'
import { putSnapshot } from '@/db/snapshots.server'
import type {
  DateRange,
  ProjectItem,
  ProjectRef,
  RawBacklogItem,
  RawClosedIssue,
  RawCommit,
  RawMergedPull,
  SourceResult,
} from '@/lib/types'
import {
  GH_COMMITS_LIMIT,
  GH_PROJECT_ITEMS_LIMIT,
  GH_SEARCH_PER_PAGE,
  describeGhError,
  type GhClient,
} from './gh.server'

/** Upper bound on Projects whose items are read in one refresh. */
export const MAX_PROJECTS_FOR_ITEMS = 15

export type BacklogPayload = {
  openIssues: SourceResult<RawBacklogItem[]>
  openPulls: SourceResult<RawBacklogItem[]>
}

export type RangePayload = {
  closedIssues: SourceResult<RawClosedIssue[]>
  mergedPulls: SourceResult<RawMergedPull[]>
  commits: SourceResult<RawCommit[]>
}

export type ProjectsPayload = {
  projects: SourceResult<ProjectRef[]>
  projectItems: SourceResult<ProjectItem[]>
}

async function readSource<T>(
  label: string,
  load: () => Promise<{ items: T[]; incomplete: boolean }>,
): Promise<SourceResult<T[]>> {
  try {
    const result = await load()
    return {
      status: 'ok',
      data: result.items,
      incomplete: result.incomplete,
      note: result.incomplete
        ? `${label} hit the read bound; some items in this window were not read.`
        : null,
    }
  } catch (error) {
    return { status: 'unavailable', reason: describeGhError(error) }
  }
}

/** Read and cache the current open backlog for one account + organization. */
export async function syncBacklog(
  db: Database,
  client: GhClient,
  account: string,
  organization: string,
  fetchedAt: number,
): Promise<string[]> {
  const openIssues = await readSource('Open issues', () =>
    client.searchOpenIssues(account, organization, GH_SEARCH_PER_PAGE),
  )
  const openPulls = await readSource('Open pull requests', () =>
    client.searchOpenPulls(account, organization, GH_SEARCH_PER_PAGE),
  )

  const payload: BacklogPayload = { openIssues, openPulls }
  const backlogSources: SourceResult<unknown>[] = [openIssues, openPulls]
  putSnapshot(db, {
    account,
    organization,
    scope: 'backlog',
    fetchedAt,
    incomplete: backlogSources.some((source) => source.status === 'ok' && source.incomplete),
    note: combineNotes(backlogSources),
    payload,
  })

  // Catalog observation is additive: only repositories from `ok` reads are
  // upserted, an unavailable source contributes nothing, and a repository
  // missing from this response is never deleted.
  observeRepositories(db, {
    account,
    organization,
    fullNames: collectRepos([openIssues, openPulls]),
    seenAt: fetchedAt,
  })

  return collectWarnings(backlogSources)
}

/**
 * Read and cache the range-scoped sources.
 *
 * The GitHub search qualifiers use calendar dates, but the window is defined by
 * exact instants. The query therefore spans the UTC dates that contain the
 * window and the exact instant filter is applied again in the summary. The
 * snapshot scope token stays `week` so existing range cache rows keep working.
 */
export async function syncRange(
  db: Database,
  client: GhClient,
  account: string,
  organization: string,
  range: DateRange,
  fetchedAt: number,
): Promise<string[]> {
  const searchStart = range.startIso.slice(0, 10)
  const searchEnd = range.endIso.slice(0, 10)

  const closedIssues = await readSource('Closed issues', () =>
    client.searchClosedIssues(account, organization, searchStart, searchEnd, GH_SEARCH_PER_PAGE),
  )
  const mergedPulls = await readSource('Merged pull requests', () =>
    client.searchMergedPulls(account, organization, searchStart, searchEnd, GH_SEARCH_PER_PAGE),
  )
  const commits = await readSource('Commits', () =>
    client.searchCommits(account, organization, searchStart, searchEnd, GH_COMMITS_LIMIT),
  )

  const payload: RangePayload = { closedIssues, mergedPulls, commits }
  const rangeSources: SourceResult<unknown>[] = [closedIssues, mergedPulls, commits]
  putSnapshot(db, {
    account,
    organization,
    scope: 'week',
    windowStart: range.startIso,
    windowEnd: range.endIso,
    fetchedAt,
    incomplete: rangeSources.some((source) => source.status === 'ok' && source.incomplete),
    note: combineNotes(rangeSources),
    payload,
  })

  observeRepositories(db, {
    account,
    organization,
    fullNames: collectRepos([closedIssues, mergedPulls, commits]),
    seenAt: fetchedAt,
  })

  return collectWarnings(rangeSources)
}

/** Read and cache the Projects list plus the observed item memberships. */
export async function syncProjects(
  db: Database,
  client: GhClient,
  account: string,
  organization: string,
  fetchedAt: number,
): Promise<string[]> {
  let projects: SourceResult<ProjectRef[]>
  try {
    const result = await client.listProjects(organization)
    projects = {
      status: 'ok',
      data: result.projects,
      incomplete: result.incomplete,
      note: result.incomplete
        ? 'The Project list hit the read bound; some Projects were not read.'
        : null,
    }
  } catch (error) {
    projects = { status: 'unavailable', reason: describeGhError(error) }
  }

  let projectItems: SourceResult<ProjectItem[]>
  let itemWarnings: string[] = []

  if (projects.status === 'unavailable') {
    projectItems = { status: 'unavailable', reason: projects.reason }
  } else {
    const open = projects.data.filter((project) => !project.closed).sort((a, b) => a.number - b.number)
    const targets = open.slice(0, MAX_PROJECTS_FOR_ITEMS)
    const items: ProjectItem[] = []
    const failures: string[] = []
    let incomplete = projects.incomplete || open.length > targets.length

    for (const project of targets) {
      try {
        const result = await client.listProjectItems(organization, project.number, GH_PROJECT_ITEMS_LIMIT)
        items.push(...result.items)
        if (result.incomplete) incomplete = true
      } catch (error) {
        failures.push(`#${project.number}: ${describeGhError(error)}`)
      }
    }

    if (items.length === 0 && failures.length > 0) {
      projectItems = { status: 'unavailable', reason: failures[0] ?? 'Projects could not be read' }
    } else {
      const notes = [
        incomplete ? 'Project items hit the read bound; memberships may be incomplete.' : null,
        failures.length > 0 ? `Some Projects could not be read (${failures.join('; ')}).` : null,
      ].filter((note): note is string => Boolean(note))
      projectItems = {
        status: 'ok',
        data: items,
        incomplete: incomplete || failures.length > 0,
        note: notes.length > 0 ? notes.join(' ') : null,
      }
    }
    itemWarnings = failures.map((failure) => `GitHub Projects partially unreadable: ${failure}`)
  }

  const projectSources: SourceResult<unknown>[] = [projects, projectItems]
  putSnapshot(db, {
    account,
    organization,
    scope: 'projects',
    fetchedAt,
    incomplete: projectSources.some((source) => source.status === 'ok' && source.incomplete),
    note: combineNotes(projectSources),
    payload: { projects, projectItems } satisfies ProjectsPayload,
  })

  return [...collectWarnings(projectSources), ...itemWarnings]
}

function combineNotes(sources: SourceResult<unknown>[]): string | null {
  const notes = sources
    .map((source) => (source.status === 'ok' ? source.note : null))
    .filter((note): note is string => Boolean(note))
  return notes.length > 0 ? notes.join(' ') : null
}

function collectWarnings(sources: SourceResult<unknown>[]): string[] {
  return sources
    .filter((source): source is { status: 'unavailable'; reason: string } => source.status === 'unavailable')
    .map((source) => source.reason)
}

/** Repositories named by the successfully read sources; failed reads contribute nothing. */
function collectRepos(sources: SourceResult<{ repo: string }[]>[]): string[] {
  const repos: string[] = []
  for (const source of sources) {
    if (source.status !== 'ok') continue
    for (const item of source.data) {
      if (typeof item.repo === 'string' && item.repo.length > 0) repos.push(item.repo)
    }
  }
  return repos
}

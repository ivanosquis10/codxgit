import type { Database } from '@/db/client.server'
import { getDatabase } from '@/db/client.server'
import { listRepositories } from '@/db/repositories.server'
import {
  getBacklogSnapshot,
  getLatestIdentity,
  getProjectsSnapshot,
  getRangeSnapshot,
  putIdentity,
  type SnapshotRecord,
} from '@/db/snapshots.server'
import { buildDemoInput, DEMO_IDENTITY, DEMO_ORGANIZATION } from '@/lib/demo'
import { buildWeeklySummary } from '@/lib/summary'
import type {
  DashboardData,
  DateRange,
  DateRangePreset,
  Identity,
  PersonalWorkInput,
  RepositoryCatalogEntry,
} from '@/lib/types'
import { DEFAULT_RANGE_PRESET } from '@/lib/types'
import { getRange } from '@/lib/week'
import { readServerConfig, type ServerConfig } from './config.server'
import { createGhClient, defaultGhExec, describeGhError } from './gh.server'
import {
  syncBacklog,
  syncProjects,
  syncRange,
  type BacklogPayload,
  type ProjectsPayload,
  type RangePayload,
} from './sync.server'

export type DashboardRequest = {
  /** Range preset; defaults to the trailing 30 days. */
  preset?: DateRangePreset
  /** Optional `YYYY-MM-DD` anchor date; defaults to today. */
  weekStart?: string
  projects?: number[]
  repos?: string[]
  demo?: boolean
}

export type RefreshResult = {
  fetchedAt: string
  warnings: string[]
}

const NOT_COVERED = { status: 'not-covered' } as const

/**
 * Resolve the requested date range.
 *
 * A bare anchor (`weekStart`) without an explicit preset keeps the historical
 * week behavior, so the headless `pnpm refresh -- <date>` still syncs the
 * Monday–Friday window containing that date. With no anchor at all the
 * dashboard opens on the default trailing range.
 */
export function resolveRange(request: DashboardRequest, timeZone: string): DateRange {
  const now = new Date()
  // Noon UTC keeps the calendar date stable for any UTC offset from -12 to +14.
  const parsedAnchor = request.weekStart ? Date.parse(`${request.weekStart}T12:00:00.000Z`) : Number.NaN
  const hasAnchor = !Number.isNaN(parsedAnchor)
  const anchor = hasAnchor ? new Date(parsedAnchor) : now
  const preset = request.preset ?? (hasAnchor ? 'this-week' : DEFAULT_RANGE_PRESET)
  return getRange(preset, anchor, timeZone)
}

function newestFetchedAt(snapshots: (SnapshotRecord | null)[]): number | null {
  const timestamps = snapshots
    .map((snapshot) => snapshot?.fetchedAt)
    .filter((value): value is number => typeof value === 'number')
  return timestamps.length > 0 ? Math.max(...timestamps) : null
}

function buildInput(
  account: string,
  config: ServerConfig,
  range: DateRange,
  snapshots: {
    backlog: SnapshotRecord | null
    range: SnapshotRecord | null
    projects: SnapshotRecord | null
  },
  catalog: RepositoryCatalogEntry[],
): PersonalWorkInput {
  const backlog = snapshots.backlog?.payload as BacklogPayload | undefined
  const rangePayload = snapshots.range?.payload as RangePayload | undefined
  const projects = snapshots.projects?.payload as ProjectsPayload | undefined
  const fetchedAtMs = newestFetchedAt([snapshots.backlog, snapshots.range, snapshots.projects])

  return {
    identity: account,
    organization: config.organization,
    range,
    fetchedAt: fetchedAtMs ? new Date(fetchedAtMs).toISOString() : null,
    demo: false,
    openIssues: backlog?.openIssues ?? NOT_COVERED,
    openPulls: backlog?.openPulls ?? NOT_COVERED,
    closedIssues: rangePayload?.closedIssues ?? NOT_COVERED,
    mergedPulls: rangePayload?.mergedPulls ?? NOT_COVERED,
    commits: rangePayload?.commits ?? NOT_COVERED,
    projects: projects?.projects ?? NOT_COVERED,
    projectItems: projects?.projectItems ?? NOT_COVERED,
    catalog,
  }
}

/** The durable catalog as plain client-safe entries, independent of any range. */
function readCatalog(db: Database, account: string, organization: string): RepositoryCatalogEntry[] {
  return listRepositories(db, account, organization).map((row) => ({
    repo: row.fullName,
    pinned: row.pinned,
    source: row.source,
  }))
}

async function resolveIdentity(db: Database): Promise<{ identity: Identity | null; error: string | null }> {
  const cached = getLatestIdentity(db)
  if (cached) return { identity: cached.identity, error: null }

  try {
    const identity = await createGhClient(defaultGhExec).getIdentity()
    putIdentity(db, identity, Date.now())
    return { identity, error: null }
  } catch (error) {
    return { identity: null, error: describeGhError(error) }
  }
}

function buildDemoData(range: DateRange, projects: number[], repos: string[]): DashboardData {
  const summary = buildWeeklySummary(buildDemoInput(range), {
    projectFilter: projects,
    repoFilter: repos,
  })
  const now = new Date().toISOString()
  return {
    identity: DEMO_IDENTITY,
    identityError: null,
    organization: DEMO_ORGANIZATION,
    timeZone: range.timeZone,
    demo: true,
    demoEnabled: true,
    dataState: 'ready',
    summary,
    refreshedAt: now,
  }
}

/** Answer from the local cache. Never calls GitHub except for a first-run identity. */
export async function loadDashboardData(request: DashboardRequest): Promise<DashboardData> {
  const config = readServerConfig()
  const range = resolveRange(request, config.timeZone)

  if (request.demo === true) {
    return buildDemoData(range, request.projects ?? [], request.repos ?? [])
  }

  const { db } = getDatabase()
  const { identity, error } = await resolveIdentity(db)
  const account = identity?.login ?? 'unknown'

  const snapshots = {
    backlog: getBacklogSnapshot(db, account, config.organization),
    range: getRangeSnapshot(db, account, config.organization, range.startIso, range.endIso),
    projects: getProjectsSnapshot(db, account, config.organization),
  }

  // The catalog is read even when no snapshot exists, so a repository that was
  // added by hand (or observed under another range) is still selectable.
  const catalog = readCatalog(db, account, config.organization)

  const summary = buildWeeklySummary(buildInput(account, config, range, snapshots, catalog), {
    projectFilter: request.projects,
    repoFilter: request.repos,
  })

  const hasAnySnapshot = Boolean(snapshots.backlog || snapshots.range || snapshots.projects)
  const fetchedAtMs = newestFetchedAt([snapshots.backlog, snapshots.range, snapshots.projects])

  return {
    identity,
    identityError: error,
    organization: config.organization,
    timeZone: config.timeZone,
    demo: false,
    demoEnabled: config.demoEnvEnabled,
    dataState: hasAnySnapshot ? 'ready' : 'empty',
    summary,
    refreshedAt: fetchedAtMs ? new Date(fetchedAtMs).toISOString() : null,
  }
}

/** Explicit refresh: fetch from GitHub server-side and persist snapshots. */
export async function refreshDashboardData(request: DashboardRequest): Promise<RefreshResult> {
  const config = readServerConfig()
  if (request.demo === true || config.demoEnvEnabled) {
    return {
      fetchedAt: new Date().toISOString(),
      warnings: ['Demo mode is active: no live GitHub data was fetched.'],
    }
  }

  const { db } = getDatabase()
  const range = resolveRange(request, config.timeZone)
  const client = createGhClient(defaultGhExec)

  let identity: Identity
  try {
    identity = await client.getIdentity()
    putIdentity(db, identity, Date.now())
  } catch (error) {
    throw new Error(describeGhError(error))
  }

  const fetchedAt = Date.now()
  const warnings = [
    ...(await syncBacklog(db, client, identity.login, config.organization, fetchedAt)),
    ...(await syncRange(db, client, identity.login, config.organization, range, fetchedAt)),
    ...(await syncProjects(db, client, identity.login, config.organization, fetchedAt)),
  ]

  return { fetchedAt: new Date(fetchedAt).toISOString(), warnings }
}

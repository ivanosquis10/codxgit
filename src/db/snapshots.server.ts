import { desc, eq } from 'drizzle-orm'
import type { Identity } from '@/lib/types'
import type { Database } from './client.server'
import { accounts, snapshots } from './schema'

export type SnapshotScope = 'backlog' | 'week' | 'projects'

export type SnapshotRecord = {
  key: string
  account: string
  organization: string
  scope: SnapshotScope
  windowStart: string | null
  windowEnd: string | null
  fetchedAt: number
  incomplete: boolean
  note: string | null
  payload: unknown
}

export type PutSnapshotInput = {
  account: string
  organization: string
  scope: SnapshotScope
  windowStart?: string | null
  windowEnd?: string | null
  fetchedAt: number
  incomplete?: boolean
  note?: string | null
  payload: unknown
}

export type SnapshotScopeKey = {
  account: string
  organization: string
  scope: SnapshotScope
  windowStart?: string | null
  windowEnd?: string | null
}

/** Deterministic cache key: account + organization + scope + window. */
export function snapshotKey(input: SnapshotScopeKey): string {
  const window = [input.windowStart, input.windowEnd]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(':')
  return ['snapshot', input.account, input.organization, input.scope, window].join(':')
}

type SnapshotRow = typeof snapshots.$inferSelect

function toRecord(row: SnapshotRow): SnapshotRecord {
  return {
    key: row.key,
    account: row.account,
    organization: row.organization,
    scope: row.scope as SnapshotScope,
    windowStart: row.windowStart,
    windowEnd: row.windowEnd,
    fetchedAt: row.fetchedAt,
    incomplete: row.incomplete,
    note: row.note,
    payload: row.payload,
  }
}

/** Idempotent write: the same cache key is updated, never duplicated. */
export function putSnapshot(db: Database, input: PutSnapshotInput): void {
  const key = snapshotKey(input)
  const windowStart = input.windowStart ?? null
  const windowEnd = input.windowEnd ?? null
  const incomplete = input.incomplete ?? false
  const note = input.note ?? null

  db.insert(snapshots)
    .values({
      key,
      account: input.account,
      organization: input.organization,
      scope: input.scope,
      windowStart,
      windowEnd,
      fetchedAt: input.fetchedAt,
      incomplete,
      note,
      payload: input.payload,
    })
    .onConflictDoUpdate({
      target: snapshots.key,
      set: { windowStart, windowEnd, fetchedAt: input.fetchedAt, incomplete, note, payload: input.payload },
    })
    .run()
}

function findByKey(db: Database, key: string): SnapshotRecord | null {
  const row = db.select().from(snapshots).where(eq(snapshots.key, key)).get()
  return row ? toRecord(row) : null
}

export function getBacklogSnapshot(
  db: Database,
  account: string,
  organization: string,
): SnapshotRecord | null {
  return findByKey(db, snapshotKey({ account, organization, scope: 'backlog' }))
}

/**
 * Read the range-scoped snapshot for the exact window boundaries.
 *
 * The stored scope token is still `week` on purpose: the cache key is
 * `account + organization + scope + window`, so keeping the token preserves
 * every range snapshot written before the range presets existed. The window
 * boundaries are the range's inclusive instants, which makes each distinct
 * range its own key with no migration or column change.
 */
export function getRangeSnapshot(
  db: Database,
  account: string,
  organization: string,
  windowStart: string,
  windowEnd: string,
): SnapshotRecord | null {
  return findByKey(db, snapshotKey({ account, organization, scope: 'week', windowStart, windowEnd }))
}

export function getProjectsSnapshot(
  db: Database,
  account: string,
  organization: string,
): SnapshotRecord | null {
  return findByKey(db, snapshotKey({ account, organization, scope: 'projects' }))
}

export function putIdentity(db: Database, identity: Identity, fetchedAt: number): void {
  db.insert(accounts)
    .values({ login: identity.login, name: identity.name, fetchedAt })
    .onConflictDoUpdate({
      target: accounts.login,
      set: { name: identity.name, fetchedAt },
    })
    .run()
}

export function getLatestIdentity(
  db: Database,
): { identity: Identity; fetchedAt: number } | null {
  const row = db.select().from(accounts).orderBy(desc(accounts.fetchedAt)).limit(1).get()
  if (!row) return null
  return { identity: { login: row.login, name: row.name }, fetchedAt: row.fetchedAt }
}

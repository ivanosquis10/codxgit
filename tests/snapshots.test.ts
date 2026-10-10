import { beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, migrateDatabase, type Database } from '@/db/client.server'
import {
  getBacklogSnapshot,
  getLatestIdentity,
  getProjectsSnapshot,
  getRangeSnapshot,
  putIdentity,
  putSnapshot,
  snapshotKey,
} from '@/db/snapshots.server'
import { snapshots } from '@/db/schema'

const ACCOUNT_A = 'desarrollador1IR'
const ACCOUNT_B = 'ivanosquis10'
const ORG = 'desarrollo-intelicorps'

function freshDb(): Database {
  const { db } = createDatabase(':memory:')
  migrateDatabase(db)
  return db
}

function rowCount(db: Database): number {
  return db.select().from(snapshots).all().length
}

describe('snapshot cache', () => {
  let db: Database

  beforeEach(() => {
    db = freshDb()
  })

  it('upserts the same cache key instead of duplicating it', () => {
    const base = {
      account: ACCOUNT_A,
      organization: ORG,
      scope: 'week' as const,
      windowStart: '2026-10-05T04:00:00.000Z',
      windowEnd: '2026-10-10T03:59:59.999Z',
      fetchedAt: 1,
    }

    putSnapshot(db, { ...base, payload: { closedIssues: [] } })
    putSnapshot(db, { ...base, fetchedAt: 2, payload: { closedIssues: [1] } })

    expect(rowCount(db)).toBe(1)
    const stored = getRangeSnapshot(
      db,
      ACCOUNT_A,
      ORG,
      '2026-10-05T04:00:00.000Z',
      '2026-10-10T03:59:59.999Z',
    )
    expect(stored?.fetchedAt).toBe(2)
    expect(stored?.payload).toEqual({ closedIssues: [1] })
  })

  it('keeps two accounts from blending into one view', () => {
    putSnapshot(db, {
      account: ACCOUNT_A,
      organization: ORG,
      scope: 'projects',
      fetchedAt: 1,
      payload: { owner: ACCOUNT_A },
    })
    putSnapshot(db, {
      account: ACCOUNT_B,
      organization: ORG,
      scope: 'projects',
      fetchedAt: 2,
      payload: { owner: ACCOUNT_B },
    })

    expect(getProjectsSnapshot(db, ACCOUNT_A, ORG)?.payload).toEqual({ owner: ACCOUNT_A })
    expect(getProjectsSnapshot(db, ACCOUNT_B, ORG)?.payload).toEqual({ owner: ACCOUNT_B })
    expect(rowCount(db)).toBe(2)
  })

  it('keeps two organizations from blending into one view', () => {
    putSnapshot(db, {
      account: ACCOUNT_A,
      organization: 'desarrollo-intelicorps',
      scope: 'backlog',
      fetchedAt: 1,
      payload: { org: 'a' },
    })
    putSnapshot(db, {
      account: ACCOUNT_A,
      organization: 'otra-org',
      scope: 'backlog',
      fetchedAt: 2,
      payload: { org: 'b' },
    })

    expect(getBacklogSnapshot(db, ACCOUNT_A, 'desarrollo-intelicorps')?.payload).toEqual({ org: 'a' })
    expect(getBacklogSnapshot(db, ACCOUNT_A, 'otra-org')?.payload).toEqual({ org: 'b' })
  })

  it('only returns the range snapshot for the exact window', () => {
    putSnapshot(db, {
      account: ACCOUNT_A,
      organization: ORG,
      scope: 'week',
      windowStart: '2026-10-05T04:00:00.000Z',
      windowEnd: '2026-10-10T03:59:59.999Z',
      fetchedAt: 1,
      payload: { week: 1 },
    })

    expect(
      getRangeSnapshot(db, ACCOUNT_A, ORG, '2026-10-05T04:00:00.000Z', '2026-10-10T03:59:59.999Z')
        ?.payload,
    ).toEqual({ week: 1 })
    expect(
      getRangeSnapshot(db, ACCOUNT_A, ORG, '2026-10-12T04:00:00.000Z', '2026-10-17T03:59:59.999Z'),
    ).toBeNull()
  })

  it('keeps different ranges in the same scope independent and loadable', () => {
    putSnapshot(db, {
      account: ACCOUNT_A,
      organization: ORG,
      scope: 'week',
      windowStart: '2026-09-21T04:00:00.000Z',
      windowEnd: '2026-10-06T03:59:59.999Z',
      fetchedAt: 1,
      payload: { preset: 'last-15-days' },
    })
    putSnapshot(db, {
      account: ACCOUNT_A,
      organization: ORG,
      scope: 'week',
      windowStart: '2026-09-06T04:00:00.000Z',
      windowEnd: '2026-10-06T03:59:59.999Z',
      fetchedAt: 2,
      payload: { preset: 'last-30-days' },
    })

    expect(rowCount(db)).toBe(2)
    expect(
      getRangeSnapshot(db, ACCOUNT_A, ORG, '2026-09-21T04:00:00.000Z', '2026-10-06T03:59:59.999Z')
        ?.payload,
    ).toEqual({ preset: 'last-15-days' })
    expect(
      getRangeSnapshot(db, ACCOUNT_A, ORG, '2026-09-06T04:00:00.000Z', '2026-10-06T03:59:59.999Z')
        ?.payload,
    ).toEqual({ preset: 'last-30-days' })
  })

  it('returns null instead of guessing when nothing was synced', () => {
    expect(getBacklogSnapshot(db, ACCOUNT_A, ORG)).toBeNull()
    expect(getProjectsSnapshot(db, ACCOUNT_A, ORG)).toBeNull()
    expect(getLatestIdentity(db)).toBeNull()
  })

  it('builds deterministic, account-scoped cache keys', () => {
    expect(
      snapshotKey({ account: ACCOUNT_A, organization: ORG, scope: 'backlog' }),
    ).toBe(`snapshot:${ACCOUNT_A}:${ORG}:backlog:`)
    expect(
      snapshotKey({
        account: ACCOUNT_A,
        organization: ORG,
        scope: 'week',
        windowStart: 'a',
        windowEnd: 'b',
      }),
    ).toBe(`snapshot:${ACCOUNT_A}:${ORG}:week:a:b`)
  })

  it('remembers the active GitHub identity server-side', () => {
    putIdentity(db, { login: ACCOUNT_A, name: 'Ivan' }, 10)
    putIdentity(db, { login: ACCOUNT_A, name: 'Ivan Rodriguez' }, 20)

    const latest = getLatestIdentity(db)
    expect(latest?.identity).toEqual({ login: ACCOUNT_A, name: 'Ivan Rodriguez' })
    expect(latest?.fetchedAt).toBe(20)
  })
})

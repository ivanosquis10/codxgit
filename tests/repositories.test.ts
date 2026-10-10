import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase, migrateDatabase, type Database } from '@/db/client.server'
import {
  addRepository,
  getRepository,
  listRepositories,
  observeRepositories,
  setRepositoryPinned,
  type RepositoryReader,
} from '@/db/repositories.server'
import { repositories } from '@/db/schema'

const ACCOUNT_A = 'desarrollador1IR'
const ACCOUNT_B = 'ivanosquis10'
const ORG = 'desarrollo-intelicorps'
const OTHER_ORG = 'otra-organizacion'
const REPO = `${ORG}/api-autogestion`

function freshDb(): Database {
  const { db } = createDatabase(':memory:')
  migrateDatabase(db)
  return db
}

function rowCount(db: Database): number {
  return db.select().from(repositories).all().length
}

function readerFor(nameWithOwner: string, url?: string): RepositoryReader & {
  viewRepository: ReturnType<typeof vi.fn>
} {
  const viewRepository = vi.fn(async () => ({
    nameWithOwner,
    url: url ?? `https://github.com/${nameWithOwner}`,
  }))
  return { viewRepository }
}

describe('repository catalog', () => {
  let db: Database

  beforeEach(() => {
    db = freshDb()
  })

  it('isolates the same repository between accounts and organizations', () => {
    observeRepositories(db, {
      account: ACCOUNT_A,
      organization: ORG,
      fullNames: [REPO],
      seenAt: 100,
    })
    observeRepositories(db, {
      account: ACCOUNT_B,
      organization: ORG,
      fullNames: [REPO],
      seenAt: 100,
    })
    observeRepositories(db, {
      account: ACCOUNT_A,
      organization: OTHER_ORG,
      fullNames: [`${OTHER_ORG}/api-autogestion`],
      seenAt: 100,
    })

    expect(rowCount(db)).toBe(3)
    expect(listRepositories(db, ACCOUNT_A, ORG)).toHaveLength(1)
    expect(listRepositories(db, ACCOUNT_B, ORG)).toHaveLength(1)
    expect(listRepositories(db, ACCOUNT_A, OTHER_ORG)).toHaveLength(1)
    expect(listRepositories(db, ACCOUNT_A, ORG)[0]?.account).toBe(ACCOUNT_A)
    expect(listRepositories(db, ACCOUNT_B, ORG)[0]?.account).toBe(ACCOUNT_B)
    expect(listRepositories(db, ACCOUNT_A, OTHER_ORG)[0]?.organization).toBe(OTHER_ORG)
  })

  it('keys the repository case-insensitively while keeping the display name', () => {
    observeRepositories(db, {
      account: ACCOUNT_A,
      organization: ORG,
      fullNames: ['Desarrollo-Intelicorps/API-Autogestion'],
      seenAt: 100,
    })
    observeRepositories(db, {
      account: ACCOUNT_A,
      organization: ORG,
      fullNames: ['desarrollo-intelicorps/api-autogestion'],
      seenAt: 200,
    })

    expect(rowCount(db)).toBe(1)
    const [row] = listRepositories(db, ACCOUNT_A, ORG)
    expect(row?.fullNameKey).toBe('desarrollo-intelicorps/api-autogestion')
    expect(row?.fullName).toBe('desarrollo-intelicorps/api-autogestion')
  })

  it('upserts the same repository idempotently instead of duplicating it', () => {
    observeRepositories(db, {
      account: ACCOUNT_A,
      organization: ORG,
      fullNames: [REPO, REPO, REPO.toLowerCase()],
      seenAt: 100,
    })

    expect(rowCount(db)).toBe(1)
  })

  it('updates lastSeenAt without deleting repositories absent from a later sync', () => {
    const other = `${ORG}/estelar-bi`
    observeRepositories(db, {
      account: ACCOUNT_A,
      organization: ORG,
      fullNames: [REPO, other],
      seenAt: 100,
    })
    observeRepositories(db, {
      account: ACCOUNT_A,
      organization: ORG,
      fullNames: [REPO],
      seenAt: 200,
    })

    const rows = listRepositories(db, ACCOUNT_A, ORG)
    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.fullName === REPO)?.lastSeenAt).toBe(200)
    expect(rows.find((row) => row.fullName === other)?.lastSeenAt).toBe(100)
  })

  it('ignores a repository that is not part of the configured organization', () => {
    observeRepositories(db, {
      account: ACCOUNT_A,
      organization: ORG,
      fullNames: [`${OTHER_ORG}/private-thing`, REPO],
      seenAt: 100,
    })

    expect(listRepositories(db, ACCOUNT_A, ORG).map((row) => row.fullName)).toEqual([REPO])
  })

  it('preserves a manual pin when the repository is observed again', async () => {
    const reader = readerFor(REPO)
    const added = await addRepository(db, reader, {
      account: ACCOUNT_A,
      organization: ORG,
      fullName: REPO,
      seenAt: 100,
    })
    expect(added.ok).toBe(true)

    observeRepositories(db, {
      account: ACCOUNT_A,
      organization: ORG,
      fullNames: [REPO],
      seenAt: 300,
    })

    const row = getRepository(db, ACCOUNT_A, ORG, REPO)
    expect(rowCount(db)).toBe(1)
    expect(row?.pinned).toBe(true)
    expect(row?.source).toBe('manual')
    expect(row?.firstSeenAt).toBe(100)
    expect(row?.lastSeenAt).toBe(300)
  })

  it('flips the pinned flag without deleting the catalog row', () => {
    observeRepositories(db, {
      account: ACCOUNT_A,
      organization: ORG,
      fullNames: [REPO],
      seenAt: 100,
    })

    const pinned = setRepositoryPinned(db, {
      account: ACCOUNT_A,
      organization: ORG,
      fullName: REPO,
      pinned: true,
      seenAt: 150,
    })
    expect(pinned?.pinned).toBe(true)
    expect(pinned?.source).toBe('manual')

    const unpinned = setRepositoryPinned(db, {
      account: ACCOUNT_A,
      organization: ORG,
      fullName: REPO,
      pinned: false,
      seenAt: 200,
    })
    expect(unpinned?.pinned).toBe(false)
    expect(rowCount(db)).toBe(1)

    expect(
      setRepositoryPinned(db, {
        account: ACCOUNT_A,
        organization: ORG,
        fullName: `${ORG}/never-seen`,
        pinned: true,
        seenAt: 200,
      }),
    ).toBeNull()
    expect(rowCount(db)).toBe(1)
  })
})

describe('manual repository add', () => {
  let db: Database

  beforeEach(() => {
    db = freshDb()
  })

  it('rejects a repository outside the configured organization before calling gh', async () => {
    const reader = readerFor(`${OTHER_ORG}/private-thing`)
    const result = await addRepository(db, reader, {
      account: ACCOUNT_A,
      organization: ORG,
      fullName: `${OTHER_ORG}/private-thing`,
      seenAt: 100,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('organization')
    expect(reader.viewRepository).not.toHaveBeenCalled()
    expect(rowCount(db)).toBe(0)
  })

  it('rejects malformed slugs before calling gh', async () => {
    const malformed = [
      '',
      '   ',
      'api',
      'org/api/extra',
      '../evil',
      'org/..',
      'org/../etc',
      'org\\api',
      'org/api name',
      'org/api;rm -rf /',
      `${ORG}/${'a'.repeat(200)}`,
    ]

    for (const fullName of malformed) {
      const reader = readerFor(REPO)
      const result = await addRepository(db, reader, {
        account: ACCOUNT_A,
        organization: ORG,
        fullName,
        seenAt: 100,
      })
      expect(result.ok, `expected ${JSON.stringify(fullName)} to be rejected`).toBe(false)
      expect(reader.viewRepository).not.toHaveBeenCalled()
    }

    expect(rowCount(db)).toBe(0)
  })

  it('adds a valid organization repository through the injected reader and pins it', async () => {
    const reader = readerFor('desarrollo-intelicorps/api-autogestion')
    const result = await addRepository(db, reader, {
      account: ACCOUNT_A,
      organization: ORG,
      fullName: 'Desarrollo-Intelicorps/API-Autogestion',
      seenAt: 100,
    })

    expect(result.ok).toBe(true)
    expect(reader.viewRepository).toHaveBeenCalledTimes(1)
    expect(reader.viewRepository).toHaveBeenCalledWith('Desarrollo-Intelicorps/API-Autogestion')

    const row = getRepository(db, ACCOUNT_A, ORG, REPO)
    expect(row).toMatchObject({
      fullName: 'desarrollo-intelicorps/api-autogestion',
      url: 'https://github.com/desarrollo-intelicorps/api-autogestion',
      pinned: true,
      source: 'manual',
      firstSeenAt: 100,
      lastSeenAt: 100,
    })
  })

  it('keeps a duplicate add idempotent', async () => {
    await addRepository(db, readerFor(REPO), {
      account: ACCOUNT_A,
      organization: ORG,
      fullName: REPO,
      seenAt: 100,
    })
    const second = await addRepository(db, readerFor(REPO), {
      account: ACCOUNT_A,
      organization: ORG,
      fullName: REPO,
      seenAt: 200,
    })

    expect(second.ok).toBe(true)
    expect(rowCount(db)).toBe(1)
    const row = getRepository(db, ACCOUNT_A, ORG, REPO)
    expect(row?.firstSeenAt).toBe(100)
    expect(row?.lastSeenAt).toBe(200)
    expect(row?.pinned).toBe(true)
  })

  it('surfaces a gh scope failure without writing a catalog row', async () => {
    const reader: RepositoryReader = {
      viewRepository: vi.fn(async () => {
        throw new Error('The "repo" scope is required.')
      }),
    }
    const result = await addRepository(db, reader, {
      account: ACCOUNT_A,
      organization: ORG,
      fullName: REPO,
      seenAt: 100,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain(REPO)
    expect(rowCount(db)).toBe(0)
  })

  it('rejects a gh response whose owner is outside the configured organization', async () => {
    const reader = readerFor(`${OTHER_ORG}/api-autogestion`)
    const result = await addRepository(db, reader, {
      account: ACCOUNT_A,
      organization: ORG,
      fullName: REPO,
      seenAt: 100,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('organization')
    expect(rowCount(db)).toBe(0)
  })

  it('rejects a gh response that names a different repository', async () => {
    const reader = readerFor(`${ORG}/something-else`)
    const result = await addRepository(db, reader, {
      account: ACCOUNT_A,
      organization: ORG,
      fullName: REPO,
      seenAt: 100,
    })

    expect(result.ok).toBe(false)
    expect(rowCount(db)).toBe(0)
  })
})

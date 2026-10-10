import { and, asc, desc, eq } from 'drizzle-orm'
import { isValidRepoParam } from '@/lib/query'
import { describeRepoAccessError } from '@/server/gh.server'
import type { Database } from './client.server'
import { repositories } from './schema'

/**
 * The durable repository catalog.
 *
 * The catalog answers a different question than the range summary: *which
 * repositories may I select?* It is keyed by `account + organization +
 * normalized full name` and it is never emptied by a sync. A range that does
 * not mention a repository leaves the row in place, so the repository stays in
 * the selector with a real `0` activity count instead of disappearing.
 *
 * Nothing here talks to GitHub except `addRepository`, which delegates the one
 * `gh repo view` call to an injected reader so the network boundary stays in
 * `gh.server.ts` and tests can run without a live `gh`.
 */

export type RepositorySource = 'observed' | 'manual'

export type RepositoryRecord = {
  account: string
  organization: string
  fullName: string
  fullNameKey: string
  url: string
  firstSeenAt: number
  lastSeenAt: number
  pinned: boolean
  source: RepositorySource
}

export type ObserveRepositoriesInput = {
  account: string
  organization: string
  /** Display spellings observed in a sync; invalid or foreign-org entries are skipped. */
  fullNames: readonly string[]
  seenAt: number
}

export type RepositoryReader = {
  viewRepository(fullName: string): Promise<{ nameWithOwner: string; url: string }>
}

export type AddRepositoryInput = {
  account: string
  organization: string
  fullName: string
  seenAt: number
}

export type AddRepositoryResult =
  | { ok: true; repository: RepositoryRecord }
  | { ok: false; error: string }

type RepositoryRow = typeof repositories.$inferSelect

/** Owner/name length ceiling: GitHub caps the owner at 39 and the name at 100. */
const OWNER_MAX = 39
const NAME_MAX = 100
const FULL_NAME_MAX = OWNER_MAX + 1 + NAME_MAX

/** GitHub treats `owner/name` case-insensitively; the key makes that uniqueness. */
export function normalizeFullName(fullName: string): string {
  return fullName.trim().toLowerCase()
}

/** The canonical repository URL, used when GitHub did not return one. */
function repoUrl(fullName: string): string {
  return `https://github.com/${fullName.trim()}`
}

function toRecord(row: RepositoryRow): RepositoryRecord {
  return {
    account: row.account,
    organization: row.organization,
    fullName: row.fullName,
    fullNameKey: row.fullNameKey,
    url: row.url,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    pinned: row.pinned,
    source: row.source as RepositorySource,
  }
}

function parseRepoFullName(
  fullName: string,
  organization: string,
): { ok: true; owner: string; name: string } | { ok: false; error: string } {
  if (typeof fullName !== 'string') {
    return { ok: false, error: 'Repository must be written as owner/name.' }
  }
  const trimmed = fullName.trim()
  if (trimmed.length === 0 || trimmed.length > FULL_NAME_MAX) {
    return { ok: false, error: `Repository must be written as owner/name and be at most ${FULL_NAME_MAX} characters.` }
  }
  if (!isValidRepoParam(trimmed)) {
    return { ok: false, error: 'Repository must be exactly owner/name with no spaces, paths or traversal.' }
  }
  const [owner, name] = trimmed.split('/')
  if (owner.length > OWNER_MAX || name.length > NAME_MAX) {
    return { ok: false, error: 'Repository owner or name is longer than GitHub allows.' }
  }
  if (owner.toLowerCase() !== organization.toLowerCase()) {
    return {
      ok: false,
      error: `${owner}/${name} is outside the configured organization ${organization}. Only repositories in ${organization} can be added.`,
    }
  }
  return { ok: true, owner, name }
}

/** Read one catalog row, scoped to account + organization + normalized name. */
export function getRepository(
  db: Database,
  account: string,
  organization: string,
  fullName: string,
): RepositoryRecord | null {
  const row = db
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.account, account),
        eq(repositories.organization, organization),
        eq(repositories.fullNameKey, normalizeFullName(fullName)),
      ),
    )
    .get()
  return row ? toRecord(row) : null
}

/**
 * Every catalog row for one account + organization.
 *
 * Pinned repositories come first, then the stable case-insensitive name order.
 * A repository that was not observed in the latest range is still returned.
 */
export function listRepositories(
  db: Database,
  account: string,
  organization: string,
): RepositoryRecord[] {
  return db
    .select()
    .from(repositories)
    .where(and(eq(repositories.account, account), eq(repositories.organization, organization)))
    .orderBy(desc(repositories.pinned), asc(repositories.fullNameKey))
    .all()
    .map(toRecord)
}

/**
 * Idempotent observation of repositories seen in synced personal sources.
 *
 * Only repositories that belong to the configured organization are kept, so a
 * personal source can never widen the catalog to another owner. An upsert
 * refreshes `lastSeenAt` (and the display spelling) but never clears `pinned`,
 * changes `source` or resets `firstSeenAt`; absence from a later sync deletes
 * nothing.
 */
export function observeRepositories(db: Database, input: ObserveRepositoriesInput): number {
  const seen = new Set<string>()
  let count = 0

  for (const raw of input.fullNames) {
    if (typeof raw !== 'string') continue
    const fullName = raw.trim()
    if (!isValidRepoParam(fullName) || fullName.length > FULL_NAME_MAX) continue
    const key = normalizeFullName(fullName)
    if (seen.has(key)) continue
    seen.add(key)
    const owner = fullName.split('/')[0]
    if (owner.toLowerCase() !== input.organization.toLowerCase()) continue

    db.insert(repositories)
      .values({
        account: input.account,
        organization: input.organization,
        fullNameKey: key,
        fullName,
        url: repoUrl(fullName),
        firstSeenAt: input.seenAt,
        lastSeenAt: input.seenAt,
        pinned: false,
        source: 'observed',
      })
      .onConflictDoUpdate({
        target: [repositories.account, repositories.organization, repositories.fullNameKey],
        set: { fullName, url: repoUrl(fullName), lastSeenAt: input.seenAt },
      })
      .run()
    count += 1
  }

  return count
}

/**
 * Toggle the pinned flag of an existing catalog row.
 *
 * Pin and unpin never delete: a repository that is not observed any more stays
 * selectable so a long period cannot silently drop it. Returns `null` when the
 * repository is not in the catalog for this account + organization.
 */
export function setRepositoryPinned(
  db: Database,
  input: {
    account: string
    organization: string
    fullName: string
    pinned: boolean
    seenAt: number
  },
): RepositoryRecord | null {
  const existing = getRepository(db, input.account, input.organization, input.fullName)
  if (!existing) return null

  db.update(repositories)
    .set({ pinned: input.pinned, source: input.pinned ? 'manual' : existing.source })
    .where(
      and(
        eq(repositories.account, input.account),
        eq(repositories.organization, input.organization),
        eq(repositories.fullNameKey, existing.fullNameKey),
      ),
    )
    .run()

  return getRepository(db, input.account, input.organization, input.fullName)
}

/**
 * Validate and pin a manually added repository.
 *
 * The only GitHub call is the injected `gh repo view <fullName> --json
 * nameWithOwner,url` (a fixed argv built in `gh.server.ts`). The owner is
 * checked against the configured organization *before* any call, and the
 * response owner and name are checked again afterwards, so a repository outside
 * the organization is never persisted and private contents are never read.
 */
export async function addRepository(
  db: Database,
  reader: RepositoryReader,
  input: AddRepositoryInput,
): Promise<AddRepositoryResult> {
  const parsed = parseRepoFullName(input.fullName, input.organization)
  if (!parsed.ok) return { ok: false, error: parsed.error }

  const requested = `${parsed.owner}/${parsed.name}`
  let viewed: { nameWithOwner: string; url: string }
  try {
    viewed = await reader.viewRepository(requested)
  } catch (error) {
    return { ok: false, error: describeRepoAccessError(error, requested) }
  }

  const responseName = typeof viewed?.nameWithOwner === 'string' ? viewed.nameWithOwner.trim() : ''
  if (!isValidRepoParam(responseName)) {
    return { ok: false, error: `GitHub returned an unexpected identity for ${requested}; nothing was saved.` }
  }
  const [responseOwner, responseRepo] = responseName.split('/')
  if (responseOwner.toLowerCase() !== input.organization.toLowerCase()) {
    return {
      ok: false,
      error: `${responseName} is outside the configured organization ${input.organization}; nothing was saved.`,
    }
  }
  if (responseRepo.toLowerCase() !== parsed.name.toLowerCase()) {
    return {
      ok: false,
      error: `GitHub returned ${responseName} for ${requested}; nothing was saved.`,
    }
  }

  const url = typeof viewed.url === 'string' && viewed.url.trim().length > 0 ? viewed.url.trim() : repoUrl(responseName)

  db.insert(repositories)
    .values({
      account: input.account,
      organization: input.organization,
      fullNameKey: normalizeFullName(responseName),
      fullName: responseName,
      url,
      firstSeenAt: input.seenAt,
      lastSeenAt: input.seenAt,
      pinned: true,
      source: 'manual',
    })
    .onConflictDoUpdate({
      target: [repositories.account, repositories.organization, repositories.fullNameKey],
      set: { fullName: responseName, url, lastSeenAt: input.seenAt, pinned: true, source: 'manual' },
    })
    .run()

  const stored = getRepository(db, input.account, input.organization, responseName)
  if (!stored) {
    return { ok: false, error: `${responseName} could not be saved to the local catalog.` }
  }
  return { ok: true, repository: stored }
}

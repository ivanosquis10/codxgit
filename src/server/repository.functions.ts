import { createServerFn } from '@tanstack/react-start'
import { getDatabase } from '@/db/client.server'
import { addRepository, setRepositoryPinned, type RepositoryRecord } from '@/db/repositories.server'
import { getLatestIdentity } from '@/db/snapshots.server'
import { readServerConfig } from './config.server'
import { createGhClient, defaultGhExec } from './gh.server'

/**
 * Server-function boundary for the repository catalog.
 *
 * All GitHub and SQLite access stays here. The only `gh` command reachable from
 * this module is `gh repo view <fullName> --json nameWithOwner,url`, built as a
 * fixed argv in `gh.server.ts`; CodxGit never persists or returns a token.
 */

export type RepositoryActionResult =
  | { ok: true; repository: RepositoryRecord }
  | { ok: false; error: string }

function readActiveAccount(db: ReturnType<typeof getDatabase>['db']): string | null {
  return getLatestIdentity(db)?.identity.login ?? null
}

const NO_IDENTITY =
  'Refresh once so CodxGit can identify your GitHub account before changing the repository catalog.'

function validateFullName(input: unknown): string {
  const record = (input ?? {}) as Record<string, unknown>
  return typeof record.fullName === 'string' ? record.fullName : ''
}

export const addRepositoryFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => ({ fullName: validateFullName(input) }))
  .handler(async ({ data }): Promise<RepositoryActionResult> => {
    const config = readServerConfig()
    const { db } = getDatabase()
    const account = readActiveAccount(db)
    if (!account) return { ok: false, error: NO_IDENTITY }

    return addRepository(db, createGhClient(defaultGhExec), {
      account,
      organization: config.organization,
      fullName: data.fullName,
      seenAt: Date.now(),
    })
  })

export const setRepositoryPinFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const record = (input ?? {}) as Record<string, unknown>
    return {
      fullName: typeof record.fullName === 'string' ? record.fullName : '',
      pinned: record.pinned === true,
    }
  })
  .handler(async ({ data }): Promise<RepositoryActionResult> => {
    const config = readServerConfig()
    const { db } = getDatabase()
    const account = readActiveAccount(db)
    if (!account) return { ok: false, error: NO_IDENTITY }

    const repository = setRepositoryPinned(db, {
      account,
      organization: config.organization,
      fullName: data.fullName,
      pinned: data.pinned,
      seenAt: Date.now(),
    })
    if (!repository) {
      return {
        ok: false,
        error: 'That repository is not in the local catalog yet. Refresh or add it first.',
      }
    }
    return { ok: true, repository }
  })

import { describe, expect, it, vi } from 'vitest'
import {
  GhError,
  buildCommitSearchArgs,
  buildIssueSearchArgs,
  buildProjectItemsArgs,
  buildProjectListArgs,
  buildRepoViewArgs,
  classifyGhError,
  createGhClient,
  describeGhError,
  describeRepoAccessError,
  type GhExec,
} from '@/server/gh.server'

const ORG = 'desarrollo-intelicorps'
const LOGIN = 'desarrollador1IR'

function failingExec(stderr: string, code?: string): GhExec {
  return () => {
    const error = new Error(`exit ${code ?? 1}: ${stderr}`) as Error & { stderr: string; code?: string }
    error.stderr = stderr
    error.code = code
    return Promise.reject(error)
  }
}

describe('argument builders', () => {
  it('builds a fixed argv for the project list', () => {
    expect(buildProjectListArgs(ORG)).toEqual([
      'project',
      'list',
      '--owner',
      ORG,
      '--format',
      'json',
      '--limit',
      '100',
    ])
  })

  it('builds a fixed argv for project items and strips bodies with --jq', () => {
    const args = buildProjectItemsArgs(ORG, 12, 100)
    expect(args).toEqual([
      'project',
      'item-list',
      '12',
      '--owner',
      ORG,
      '--format',
      'json',
      '--limit',
      '100',
      '--jq',
      expect.stringContaining('.items'),
    ])
    expect(args.join(' ')).not.toContain('body')
  })

  it('builds a pinned GET argv for search', () => {
    expect(buildIssueSearchArgs('state:closed', 2, 100)).toEqual([
      'api',
      '--method',
      'GET',
      'search/issues',
      '-f',
      'q=state:closed',
      '-f',
      'per_page=100',
      '-f',
      'page=2',
      '--jq',
      expect.stringContaining('.items'),
    ])
  })

  it('builds a commit search restricted to the default-branch index', () => {
    const args = buildCommitSearchArgs(LOGIN, ORG, '2026-10-05', '2026-10-09', 100)
    expect(args).toEqual([
      'search',
      'commits',
      '--author',
      LOGIN,
      '--author-date',
      '2026-10-05..2026-10-09',
      '--owner',
      ORG,
      '--sort',
      'author-date',
      '--order',
      'desc',
      '--limit',
      '100',
      '--json',
      expect.any(String),
    ])
  })

  it('rejects inputs that could break out of the fixed argv', () => {
    expect(() => buildProjectListArgs('org; rm -rf /')).toThrowError(/invalid/i)
    expect(() => buildProjectItemsArgs(ORG, -1, 100)).toThrowError(/invalid/i)
    expect(() => buildProjectItemsArgs(ORG, 12, 100000)).toThrowError(/invalid/i)
    expect(() => buildIssueSearchArgs('x', 0, 100)).toThrowError(/invalid/i)
    expect(() => buildCommitSearchArgs('a b', ORG, '2026-10-05', '2026-10-09', 100)).toThrowError(
      /invalid/i,
    )
  })

  it('builds a fixed argv for `gh repo view` with a minimal projection', () => {
    expect(buildRepoViewArgs('desarrollo-intelicorps/api-autogestion')).toEqual([
      'repo',
      'view',
      'desarrollo-intelicorps/api-autogestion',
      '--json',
      'nameWithOwner,url',
    ])
  })

  it('rejects a repository value that could break out of the fixed argv', () => {
    expect(() => buildRepoViewArgs('../evil')).toThrowError(/invalid/i)
    expect(() => buildRepoViewArgs('org/api; rm -rf /')).toThrowError(/invalid/i)
    expect(() => buildRepoViewArgs('org/api/extra')).toThrowError(/invalid/i)
    expect(() => buildRepoViewArgs('org')).toThrowError(/invalid/i)
    expect(() => buildRepoViewArgs(`org/${'a'.repeat(200)}`)).toThrowError(/invalid/i)
  })
})

describe('classifyGhError', () => {
  it('maps a denied Projects scope to a permission error', () => {
    const error = classifyGhError(
      failingExecSync(
        'GraphQL: Your token has not been granted the required scopes to execute this query. The "read:project" scope is required.',
      ),
    )
    expect(error).toBeInstanceOf(GhError)
    expect(error.kind).toBe('permission')
    expect(error.message).toContain('read:project')
  })

  it('maps a missing gh binary to a missing error', () => {
    const error = classifyGhError(failingExecSync('', 'ENOENT'))
    expect(error.kind).toBe('missing')
  })

  it('maps anything else to a command error and keeps stderr', () => {
    const error = classifyGhError(failingExecSync('HTTP 502 Bad Gateway'))
    expect(error.kind).toBe('command')
    expect(error.stderr).toContain('502')
  })

  it('maps malformed JSON to a command error', () => {
    const error = classifyGhError(new SyntaxError('Unexpected token < in JSON'))
    expect(error.kind).toBe('command')
  })
})

describe('describeGhError', () => {
  it('explains the permission denial and points at the user-driven fix', () => {
    const message = describeGhError(
      classifyGhError(failingExecSync('The "read:project" scope is required.')),
    )
    expect(message).toContain('read:project')
    expect(message).toMatch(/gh auth refresh/)
  })

  it('explains a missing gh binary without inventing a count', () => {
    const message = describeGhError(classifyGhError(failingExecSync('', 'ENOENT')))
    expect(message).toMatch(/not found|not installed|missing/i)
    expect(message).not.toContain('0')
  })

  it('names the repository when a repo view is denied', () => {
    const message = describeRepoAccessError(
      classifyGhError(failingExecSync('Resource not accessible by integration (HTTP 403)')),
      'desarrollo-intelicorps/private-repo',
    )
    expect(message).toContain('desarrollo-intelicorps/private-repo')
    expect(message).toMatch(/denied|access|scope/i)
  })
})

describe('createGhClient', () => {
  it('runs gh with the exact fixed argv and parses the project list', async () => {
    const exec = vi.fn<GhExec>(async () =>
      JSON.stringify({
        projects: [
          {
            number: 12,
            title: 'Plan de entrega',
            url: 'https://github.com/orgs/x/projects/12',
            closed: false,
            items: { totalCount: 26 },
          },
        ],
        totalCount: 1,
      }),
    )

    const result = await createGhClient(exec).listProjects(ORG)

    expect(exec).toHaveBeenCalledTimes(1)
    expect(exec).toHaveBeenCalledWith(buildProjectListArgs(ORG))
    expect(result.projects).toEqual([
      {
        number: 12,
        title: 'Plan de entrega',
        url: 'https://github.com/orgs/x/projects/12',
        closed: false,
        itemTotalCount: 26,
      },
    ])
    expect(result.incomplete).toBe(false)
  })

  it('reports incomplete coverage when the project list exceeds the requested limit', async () => {
    const exec: GhExec = async () =>
      JSON.stringify({
        projects: [
          { number: 1, title: 'A', url: 'u1', closed: false, items: { totalCount: 1 } },
        ],
        totalCount: 40,
      })

    const result = await createGhClient(exec).listProjects(ORG)
    expect(result.incomplete).toBe(true)
  })

  it('parses open issues into the personal backlog shape', async () => {
    const exec: GhExec = async () =>
      JSON.stringify({
        total: 1,
        incomplete: false,
        items: [
          {
            id: '1',
            number: 333,
            title: 'Refactor',
            url: 'https://github.com/org/repo/issues/333',
            repo: 'https://api.github.com/repos/desarrollo-intelicorps/api-autogestion',
            updatedAt: '2026-10-05T16:27:52Z',
            closedAt: null,
            stateReason: null,
            mergedAt: null,
          },
        ],
      })

    const result = await createGhClient(exec).searchOpenIssues(LOGIN, ORG, 100)
    expect(result.items[0]).toEqual({
      id: '1',
      kind: 'issue',
      number: 333,
      title: 'Refactor',
      url: 'https://github.com/org/repo/issues/333',
      repo: 'desarrollo-intelicorps/api-autogestion',
      updatedAt: '2026-10-05T16:27:52Z',
    })
  })

  it('normalizes missing state reasons to OTHER and unknown text to OTHER', async () => {
    const exec: GhExec = async () =>
      JSON.stringify({
        total: 2,
        incomplete: false,
        items: [
          {
            id: '1',
            number: 1,
            title: 'a',
            url: 'https://github.com/o/r/issues/1',
            repo: 'https://api.github.com/repos/o/r',
            updatedAt: null,
            closedAt: '2026-10-06T15:00:00Z',
            stateReason: null,
            mergedAt: null,
          },
          {
            id: '2',
            number: 2,
            title: 'b',
            url: 'https://github.com/o/r/issues/2',
            repo: 'https://api.github.com/repos/o/r',
            updatedAt: null,
            closedAt: '2026-10-07T15:00:00Z',
            stateReason: 'reopened',
            mergedAt: null,
          },
        ],
      })

    const result = await createGhClient(exec).searchClosedIssues(LOGIN, ORG, '2026-10-05', '2026-10-09', 100)
    expect(result.items.map((item) => item.stateReason)).toEqual(['OTHER', 'REOPENED'])
  })

  it('reads merged pull requests with merged_at, not closed_at', async () => {
    const exec: GhExec = async () =>
      JSON.stringify({
        total: 1,
        incomplete: false,
        items: [
          {
            id: '5',
            number: 50,
            title: 'banco plaza',
            url: 'https://github.com/o/r/pull/50',
            repo: 'https://api.github.com/repos/o/r',
            updatedAt: null,
            closedAt: '2026-10-05T18:12:25Z',
            stateReason: null,
            mergedAt: '2026-10-05T18:12:25Z',
          },
        ],
      })

    const result = await createGhClient(exec).searchMergedPulls(LOGIN, ORG, '2026-10-05', '2026-10-09', 100)
    expect(result.items[0]).toMatchObject({
      id: '5',
      number: 50,
      url: 'https://github.com/o/r/pull/50',
      repo: 'o/r',
      mergedAt: '2026-10-05T18:12:25Z',
    })
  })

  it('surfaces a permission error as a typed GhError', async () => {
    const exec = failingExec('The "read:project" scope is required.')
    await expect(createGhClient(exec).listProjects(ORG)).rejects.toMatchObject({
      kind: 'permission',
    })
  })

  it('turns malformed stdout into a typed command error', async () => {
    const exec: GhExec = async () => '<html>not json</html>'
    await expect(createGhClient(exec).listProjects(ORG)).rejects.toMatchObject({ kind: 'command' })
  })

  it('reads only nameWithOwner and url from `gh repo view`', async () => {
    const exec = vi.fn<GhExec>(async () =>
      JSON.stringify({ nameWithOwner: 'desarrollo-intelicorps/api-web', url: 'https://github.com/desarrollo-intelicorps/api-web' }),
    )

    const result = await createGhClient(exec).viewRepository(`${ORG}/api-web`)

    expect(exec).toHaveBeenCalledTimes(1)
    expect(exec).toHaveBeenCalledWith(buildRepoViewArgs(`${ORG}/api-web`))
    expect(result).toEqual({
      nameWithOwner: 'desarrollo-intelicorps/api-web',
      url: 'https://github.com/desarrollo-intelicorps/api-web',
    })
  })

  it('keeps commit messages to their first line', async () => {
    const exec: GhExec = async () =>
      JSON.stringify([
        {
          sha: 'abcdef1234567890abcdef1234567890abcdef12',
          url: 'https://github.com/o/r/commit/abcdef1234567890abcdef1234567890abcdef12',
          repository: { fullName: 'o/r' },
          commit: { message: 'feat: thing\n\nmore detail', author: { date: '2026-10-05T14:12:25-04:00' } },
        },
      ])

    const result = await createGhClient(exec).searchCommits(LOGIN, ORG, '2026-10-05', '2026-10-09', 100)
    expect(result.items[0]).toMatchObject({
      repo: 'o/r',
      message: 'feat: thing',
      committedAt: '2026-10-05T14:12:25-04:00',
    })
  })
})

/** Build a rejection synchronously so the classifier can be tested directly. */
function failingExecSync(stderr: string, code?: string): unknown {
  const error = new Error(`exit ${code ?? 1}: ${stderr}`) as Error & { stderr: string; code?: string }
  error.stderr = stderr
  error.code = code
  return error
}

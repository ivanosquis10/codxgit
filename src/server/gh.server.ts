import { execFile } from 'node:child_process'
import type {
  Identity,
  ProjectItem,
  ProjectRef,
  RawBacklogItem,
  RawClosedIssue,
  RawCommit,
  RawMergedPull,
} from '@/lib/types'

/**
 * GitHub CLI adapter.
 *
 * Every command is built as a fixed argument array here and executed with
 * `execFile`, never a shell string. Values are validated before they reach an
 * argument, so no user input can change the shape of a command.
 */

export const GH_PROJECTS_LIMIT = 100
export const GH_PROJECT_ITEMS_LIMIT = 100
export const GH_SEARCH_PER_PAGE = 100
/**
 * GitHub's search API caps a query at 1000 results. We deliberately read at
 * most 3 pages × 100 = 300, which is well below that ceiling, so a wider range
 * (for example the trailing 30 days) can exceed our bound first. When it does,
 * the reader marks the source `incomplete` and surfaces the partial coverage
 * instead of silently truncating; raising the bound would only add request cost
 * without lifting GitHub's own 1000-result limit. Commit reads use a single
 * `gh search commits --limit` page and flag `incomplete` at the same cap.
 */
export const GH_SEARCH_MAX_PAGES = 3
export const GH_COMMITS_LIMIT = 100

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const REPO_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const REPO_FULL_NAME_MAX = 140
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Minimal projection: never request issue or pull request bodies. */
const SEARCH_JQ =
  '{total:(.total_count // 0), incomplete:(.incomplete_results // false), items:[.items[]|{id:(.id|tostring), number:.number, title:(.title // ""), url:(.html_url // ""), repo:(.repository_url // ""), updatedAt:(.updated_at // null), closedAt:(.closed_at // null), stateReason:(.state_reason // null), mergedAt:(.pull_request.merged_at // null)}]}'

/** Minimal projection for Project items: identity, url and assignees only. */
const PROJECT_ITEMS_JQ =
  '{totalCount:(.totalCount // null), items:[.items[]|{url:(.content.url // ""), type:(.content.type // "Unknown"), repo:(.content.repository // ""), assignees:(.assignees // [])}]}'

const COMMIT_JSON_FIELDS = 'sha,url,repository,commit,author'

/** Minimal `gh repo view` projection: identity and URL only, never repo contents. */
const REPO_VIEW_JSON_FIELDS = 'nameWithOwner,url'

export type GhErrorKind = 'permission' | 'missing' | 'command'

export class GhError extends Error {
  readonly kind: GhErrorKind
  readonly stderr: string
  constructor(message: string, kind: GhErrorKind, stderr = '') {
    super(message)
    this.name = 'GhError'
    this.kind = kind
    this.stderr = stderr
  }
}

function invalid(message: string): never {
  throw new GhError(`Invalid GitHub input: ${message}`, 'command')
}

export function assertOwner(owner: string): string {
  if (typeof owner !== 'string' || !OWNER_PATTERN.test(owner)) invalid('owner must be a GitHub login')
  return owner
}

/**
 * Validate one `owner/name` repository before it reaches any argv.
 *
 * The exact two-segment shape, the GitHub owner and name alphabets, the length
 * ceiling, and the absence of traversal or control characters together mean a
 * repository value can never add an argument or change the command shape.
 */
export function assertRepoFullName(fullName: string): string {
  if (typeof fullName !== 'string') invalid('repository must be a string')
  const trimmed = fullName.trim()
  if (trimmed.length === 0 || trimmed.length > REPO_FULL_NAME_MAX) {
    invalid('repository must be owner/name')
  }
  if (trimmed.includes('..') || trimmed.includes('\\') || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    invalid('repository must not contain a path or control characters')
  }
  const parts = trimmed.split('/')
  if (parts.length !== 2) invalid('repository must be owner/name')
  const [owner, name] = parts
  if (!OWNER_PATTERN.test(owner)) invalid('repository owner is not a GitHub login')
  if (!REPO_NAME_PATTERN.test(name) || name.length > 100) invalid('repository name is not valid')
  return `${owner}/${name}`
}

export function assertIsoDate(date: string): string {
  if (typeof date !== 'string' || !ISO_DATE_PATTERN.test(date)) invalid('date must be YYYY-MM-DD')
  return date
}

export function assertProjectNumber(number: number): number {
  if (!Number.isInteger(number) || number < 1) invalid('project number must be a positive integer')
  return number
}

export function assertBoundedLimit(limit: number, max: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > max) {
    invalid(`limit must be between 1 and ${max}`)
  }
  return limit
}

export function assertPage(page: number): number {
  if (!Number.isInteger(page) || page < 1 || page > GH_SEARCH_MAX_PAGES) {
    invalid(`page must be between 1 and ${GH_SEARCH_MAX_PAGES}`)
  }
  return page
}

function assertQuery(query: string): string {
  if (typeof query !== 'string' || query.trim().length === 0 || /[\u0000-\u001f\u007f]/.test(query)) {
    invalid('search query is empty or contains control characters')
  }
  return query
}

/** `gh project list` — a fixed argv, never a shell string. */
export function buildProjectListArgs(org: string): string[] {
  return [
    'project',
    'list',
    '--owner',
    assertOwner(org),
    '--format',
    'json',
    '--limit',
    String(assertBoundedLimit(GH_PROJECTS_LIMIT, 1000)),
  ]
}

/** `gh project item-list` — bodies and comments are projected away by `--jq`. */
export function buildProjectItemsArgs(org: string, number: number, limit: number): string[] {
  return [
    'project',
    'item-list',
    String(assertProjectNumber(number)),
    '--owner',
    assertOwner(org),
    '--format',
    'json',
    '--limit',
    String(assertBoundedLimit(limit, 1000)),
    '--jq',
    PROJECT_ITEMS_JQ,
  ]
}

/** `gh api --method GET search/issues` with pinned query parameters. */
export function buildIssueSearchArgs(query: string, page: number, perPage: number): string[] {
  return [
    'api',
    '--method',
    'GET',
    'search/issues',
    '-f',
    `q=${assertQuery(query)}`,
    '-f',
    `per_page=${assertBoundedLimit(perPage, 100)}`,
    '-f',
    `page=${assertPage(page)}`,
    '--jq',
    SEARCH_JQ,
  ]
}

/** `gh search commits` — the default-branch commit index. */
export function buildCommitSearchArgs(
  login: string,
  org: string,
  startDate: string,
  endDate: string,
  limit: number,
): string[] {
  return [
    'search',
    'commits',
    '--author',
    assertOwner(login),
    '--author-date',
    `${assertIsoDate(startDate)}..${assertIsoDate(endDate)}`,
    '--owner',
    assertOwner(org),
    '--sort',
    'author-date',
    '--order',
    'desc',
    '--limit',
    String(assertBoundedLimit(limit, 1000)),
    '--json',
    COMMIT_JSON_FIELDS,
  ]
}

/**
 * `gh repo view` — one repository, and only `nameWithOwner` and `url` are
 * projected. No description, README, or other content is requested.
 */
export function buildRepoViewArgs(fullName: string): string[] {
  return ['repo', 'view', assertRepoFullName(fullName), '--json', REPO_VIEW_JSON_FIELDS]
}

/** Turn any exec failure into a typed, user-explainable error. */
export function classifyGhError(error: unknown): GhError {
  if (error instanceof GhError) return error

  const candidate = error as { message?: string; stderr?: string; code?: string | number } | null
  const stderr = typeof candidate?.stderr === 'string' ? candidate.stderr : ''
  const message = typeof candidate?.message === 'string' ? candidate.message : String(error)
  const combined = `${message}\n${stderr}`

  if (candidate?.code === 'ENOENT' || /\bspawn\b.*\bENOENT\b/i.test(combined)) {
    return new GhError('gh was not found on PATH', 'missing', stderr)
  }

  if (
    /read:project/i.test(combined) ||
    /missing required scopes|required scopes|not been granted/i.test(combined) ||
    /Resource not accessible by integration|HTTP 403|Forbidden/i.test(combined)
  ) {
    return new GhError(`GitHub denied the read: ${firstLine(combined)}`, 'permission', stderr)
  }

  if (error instanceof SyntaxError) {
    return new GhError(`gh returned output that was not valid JSON: ${error.message}`, 'command', stderr)
  }

  return new GhError(`gh command failed: ${firstLine(combined)}`, 'command', stderr)
}

/** Short, actionable message shown in the UI coverage panel. */
export function describeGhError(error: unknown): string {
  const ghError = classifyGhError(error)
  if (ghError.kind === 'permission') {
    return 'GitHub denied this read: the active account is missing the read:project scope. Run `gh auth refresh -s read:project`, then refresh. Details: ' +
      firstLine(ghError.stderr || ghError.message)
  }
  if (ghError.kind === 'missing') {
    return 'The GitHub CLI (gh) was not found on PATH. Install it and run `gh auth login`, then refresh.'
  }
  return `gh could not complete the read: ${firstLine(ghError.stderr || ghError.message)}`
}

function firstLine(value: string): string {
  return value.split('\n').map((line) => line.trim()).filter(Boolean)[0] ?? value.trim()
}

/** Friendly, repository-specific explanation for a failed manual add. */
export function describeRepoAccessError(error: unknown, fullName: string): string {
  const ghError = classifyGhError(error)
  if (ghError.kind === 'permission') {
    return `GitHub denied reading ${fullName}. The active gh account may lack access to it or the required scope; run \`gh auth status\` to check. Details: ${firstLine(ghError.stderr || ghError.message)}`
  }
  if (ghError.kind === 'missing') {
    return 'The GitHub CLI (gh) was not found on PATH. Install it and run `gh auth login`, then try again.'
  }
  return `gh could not read ${fullName}: ${firstLine(ghError.stderr || ghError.message)}`
}

function repoFromApiUrl(url: string): string {
  const match = /\/repos\/([^/]+\/[^/]+)$/.exec(url)
  return match ? match[1] : url
}

export function normalizeStateReason(value: unknown): RawClosedIssue['stateReason'] {
  if (typeof value !== 'string') return 'OTHER'
  const normalized = value.toUpperCase()
  if (normalized === 'COMPLETED') return 'COMPLETED'
  if (normalized === 'NOT_PLANNED') return 'NOT_PLANNED'
  if (normalized === 'REOPENED') return 'REOPENED'
  return 'OTHER'
}

export type GhExec = (args: string[]) => Promise<string>

type SearchItem = {
  id: string
  number: number
  title: string
  url: string
  repo: string
  updatedAt: string | null
  closedAt: string | null
  stateReason: string | null
  mergedAt: string | null
}

type SearchResponse = {
  total: number
  incomplete: boolean
  items: SearchItem[]
}

type ProjectItemsResponse = {
  totalCount: number | null
  items: { url: string; type: string; repo: string; assignees: string[] }[]
}

type CommitSearchItem = {
  sha: string
  url: string
  repository?: { fullName?: string; nameWithOwner?: string }
  commit?: { message?: string; author?: { date?: string } }
}

export type GhClient = {
  getIdentity(): Promise<Identity>
  listProjects(org: string): Promise<{ projects: ProjectRef[]; incomplete: boolean }>
  listProjectItems(
    org: string,
    number: number,
    limit: number,
  ): Promise<{ items: ProjectItem[]; incomplete: boolean }>
  searchOpenIssues(
    login: string,
    org: string,
    perPage: number,
  ): Promise<{ items: RawBacklogItem[]; incomplete: boolean }>
  searchOpenPulls(
    login: string,
    org: string,
    perPage: number,
  ): Promise<{ items: RawBacklogItem[]; incomplete: boolean }>
  searchClosedIssues(
    login: string,
    org: string,
    startDate: string,
    endDate: string,
    perPage: number,
  ): Promise<{ items: RawClosedIssue[]; incomplete: boolean }>
  searchMergedPulls(
    login: string,
    org: string,
    startDate: string,
    endDate: string,
    perPage: number,
  ): Promise<{ items: RawMergedPull[]; incomplete: boolean }>
  searchCommits(
    login: string,
    org: string,
    startDate: string,
    endDate: string,
    limit: number,
  ): Promise<{ items: RawCommit[]; incomplete: boolean }>
  /** One repository's identity and URL, from a fixed `gh repo view` argv. */
  viewRepository(fullName: string): Promise<{ nameWithOwner: string; url: string }>
}

export function createGhClient(exec: GhExec): GhClient {
  async function runJson<T>(args: string[]): Promise<T> {
    let stdout: string
    try {
      stdout = await exec(args)
    } catch (error) {
      throw classifyGhError(error)
    }
    try {
      return JSON.parse(stdout) as T
    } catch (error) {
      throw classifyGhError(error)
    }
  }

  async function searchAll(query: string, perPage: number): Promise<SearchResponse> {
    const items: SearchItem[] = []
    let total = 0
    let incomplete = false

    for (let page = 1; page <= GH_SEARCH_MAX_PAGES; page += 1) {
      const raw = await runJson<SearchResponse>(buildIssueSearchArgs(query, page, perPage))
      total = typeof raw.total === 'number' ? raw.total : items.length + (raw.items?.length ?? 0)
      if (raw.incomplete) incomplete = true
      items.push(...(raw.items ?? []))
      if ((raw.items?.length ?? 0) < perPage) break
      if (items.length >= total) break
      if (page === GH_SEARCH_MAX_PAGES) incomplete = true
    }

    if (items.length < total) incomplete = true

    const seen = new Set<string>()
    const unique = items.filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return Boolean(item.url)
    })

    return { total, incomplete, items: unique }
  }

  return {
    async getIdentity() {
      const raw = await runJson<{ login?: string; name?: string | null }>([
        'api',
        'user',
        '--jq',
        '{login:.login,name:.name}',
      ])
      return { login: raw.login ?? 'unknown', name: raw.name ?? null }
    },

    async listProjects(org) {
      const raw = await runJson<{
        projects?: { number: number; title: string; url: string; closed?: boolean; items?: { totalCount?: number } }[]
        totalCount?: number
      }>(buildProjectListArgs(org))

      const projects: ProjectRef[] = (raw.projects ?? []).map((project) => ({
        number: project.number,
        title: project.title,
        url: project.url,
        closed: Boolean(project.closed),
        itemTotalCount:
          typeof project.items?.totalCount === 'number' ? project.items.totalCount : null,
      }))
      const total = typeof raw.totalCount === 'number' ? raw.totalCount : projects.length
      return { projects, incomplete: total > projects.length }
    },

    async listProjectItems(org, number, limit) {
      const raw = await runJson<ProjectItemsResponse>(buildProjectItemsArgs(org, number, limit))
      const items: ProjectItem[] = (raw.items ?? [])
        .filter((item) => typeof item.url === 'string' && item.url.length > 0)
        .map((item) => ({
          projectNumber: number,
          url: item.url,
          repo: typeof item.repo === 'string' ? item.repo : '',
          type: typeof item.type === 'string' ? item.type : 'Unknown',
          assignees: Array.isArray(item.assignees) ? item.assignees.filter((a) => typeof a === 'string') : [],
        }))
      const total = typeof raw.totalCount === 'number' ? raw.totalCount : null
      return { items, incomplete: total !== null && total > items.length }
    },

    async searchOpenIssues(login, org, perPage) {
      const result = await searchAll(
        `assignee:${assertOwner(login)} org:${assertOwner(org)} is:issue state:open`,
        perPage,
      )
      return {
        items: result.items.map((item) => ({
          id: item.id,
          kind: 'issue',
          number: item.number,
          title: item.title,
          url: item.url,
          repo: repoFromApiUrl(item.repo),
          updatedAt: item.updatedAt,
        })),
        incomplete: result.incomplete,
      }
    },

    async searchOpenPulls(login, org, perPage) {
      const result = await searchAll(
        `author:${assertOwner(login)} org:${assertOwner(org)} is:pr state:open`,
        perPage,
      )
      return {
        items: result.items.map((item) => ({
          id: item.id,
          kind: 'pr',
          number: item.number,
          title: item.title,
          url: item.url,
          repo: repoFromApiUrl(item.repo),
          updatedAt: item.updatedAt,
        })),
        incomplete: result.incomplete,
      }
    },

    async searchClosedIssues(login, org, startDate, endDate, perPage) {
      const result = await searchAll(
        `assignee:${assertOwner(login)} org:${assertOwner(org)} is:issue state:closed closed:${assertIsoDate(startDate)}..${assertIsoDate(endDate)}`,
        perPage,
      )
      return {
        items: result.items
          .filter((item) => typeof item.closedAt === 'string')
          .map((item) => ({
            id: item.id,
            number: item.number,
            title: item.title,
            url: item.url,
            repo: repoFromApiUrl(item.repo),
            closedAt: item.closedAt as string,
            stateReason: normalizeStateReason(item.stateReason),
          })),
        incomplete: result.incomplete,
      }
    },

    async searchMergedPulls(login, org, startDate, endDate, perPage) {
      const result = await searchAll(
        `author:${assertOwner(login)} org:${assertOwner(org)} is:pr is:merged merged:${assertIsoDate(startDate)}..${assertIsoDate(endDate)}`,
        perPage,
      )
      return {
        items: result.items
          .filter((item) => typeof item.mergedAt === 'string')
          .map((item) => ({
            id: item.id,
            number: item.number,
            title: item.title,
            url: item.url,
            repo: repoFromApiUrl(item.repo),
            mergedAt: item.mergedAt as string,
          })),
        incomplete: result.incomplete,
      }
    },

    async searchCommits(login, org, startDate, endDate, limit) {
      const raw = await runJson<CommitSearchItem[]>(
        buildCommitSearchArgs(login, org, startDate, endDate, limit),
      )
      const items: RawCommit[] = (raw ?? [])
        .filter((item) => typeof item.sha === 'string')
        .map((item) => ({
          id: item.sha,
          sha: item.sha,
          message: (item.commit?.message ?? '').split('\n')[0] ?? '',
          url: item.url,
          repo: item.repository?.fullName ?? item.repository?.nameWithOwner ?? '',
          committedAt: item.commit?.author?.date ?? '',
        }))
        .filter((item) => item.committedAt.length > 0)
      return { items, incomplete: items.length >= limit }
    },

    async viewRepository(fullName) {
      const raw = await runJson<{ nameWithOwner?: string; url?: string }>(buildRepoViewArgs(fullName))
      return {
        nameWithOwner: typeof raw?.nameWithOwner === 'string' ? raw.nameWithOwner : '',
        url: typeof raw?.url === 'string' ? raw.url : '',
      }
    },
  }
}

/** Default transport: `execFile('gh', args)` with no shell. */
export const defaultGhExec: GhExec = (args) =>
  new Promise((resolve, reject) => {
    execFile(
      'gh',
      args,
      { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const wrapped = new Error(error.message) as Error & { stderr?: string; code?: string | number }
          wrapped.stderr = stderr
          wrapped.code = (error as NodeJS.ErrnoException).code
          reject(wrapped)
          return
        }
        resolve(stdout)
      },
    )
  })

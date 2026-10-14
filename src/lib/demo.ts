import type {
  DateRange,
  PersonalWorkInput,
  ProjectItem,
  ProjectRef,
  RawBacklogItem,
  RawClosedIssue,
  RawCommit,
  RawMergedPull,
} from './types'

/**
 * Explicit, clearly labeled demo dataset.
 *
 * This is never used as a fallback when GitHub fails. It is only returned when
 * demo mode is requested through the URL or `CODXGIT_DEMO_MODE=1` (or `GITPOP_DEMO_MODE=1`), and every
 * screen that renders it shows a "demo data" label.
 */

export const DEMO_IDENTITY = { login: 'demo-user', name: 'Demo mode' }
export const DEMO_ORGANIZATION = 'demo-organization'

const MS_PER_DAY = 86_400_000

/** An instant inside the window, used so demo rows respect real range boundaries. */
function withinRange(range: DateRange, dayOffset: number, hourUtc: number): string {
  return new Date(Date.parse(range.startIso) + dayOffset * MS_PER_DAY + hourUtc * 3_600_000).toISOString()
}

function repoUrl(repo: string, kind: 'issues' | 'pull' | 'commit', id: string | number): string {
  return `https://github.com/${repo}/${kind === 'commit' ? 'commit' : kind}/${id}`
}

export function buildDemoInput(range: DateRange): PersonalWorkInput {
  const delivery = 'demo-organization/estelar-bi'
  const front = 'demo-organization/autogestion-front'
  const api = 'demo-organization/api-planning'
  // A repository with no Project membership at all, so the demo exercises the
  // repository-first flow without a secondary Project filter.
  const docs = 'demo-organization/docs-site'

  const projects: ProjectRef[] = [
    { number: 10, title: 'API planning', url: 'https://github.com/orgs/demo-organization/projects/10', closed: false, itemTotalCount: 310 },
    { number: 11, title: 'Autogestion frontend', url: 'https://github.com/orgs/demo-organization/projects/11', closed: false, itemTotalCount: 9 },
    { number: 12, title: 'Delivery plan', url: 'https://github.com/orgs/demo-organization/projects/12', closed: false, itemTotalCount: 26 },
  ]

  const openIssues: RawBacklogItem[] = [
    {
      id: 'demo-issue-333',
      kind: 'issue',
      number: 333,
      title: 'Standardize compliance document names',
      url: repoUrl(api, 'issues', 333),
      repo: api,
      updatedAt: withinRange(range, 1, 14),
    },
    {
      id: 'demo-issue-130',
      kind: 'issue',
      number: 130,
      title: 'Integrate Banco Plaza payment methods',
      url: repoUrl(front, 'issues', 130),
      repo: front,
      updatedAt: withinRange(range, 2, 10),
    },
    {
      id: 'demo-issue-7',
      kind: 'issue',
      number: 7,
      title: 'Document the local refresh workflow',
      url: repoUrl(docs, 'issues', 7),
      repo: docs,
      updatedAt: withinRange(range, 3, 11),
    },
  ]

  const openPulls: RawBacklogItem[] = [
    {
      id: 'demo-pull-501',
      kind: 'pr',
      number: 501,
      title: 'Add opaque session tokens',
      url: repoUrl(front, 'pull', 501),
      repo: front,
      updatedAt: withinRange(range, 3, 9),
    },
  ]

  const blockedIssues: RawBacklogItem[] = [
    {
      ...openIssues[0],
      id: 'demo-issue-333-blocked',
      labels: ['blocked'],
    },
  ]

  const closedIssues: RawClosedIssue[] = [
    {
      id: 'demo-closed-1',
      number: 88,
      title: 'Payment sessions use opaque tokens',
      url: repoUrl(front, 'issues', 88),
      repo: front,
      closedAt: withinRange(range, 0, 15),
      stateReason: 'COMPLETED',
    },
    {
      id: 'demo-closed-2',
      number: 41,
      title: 'Route state survives a reload',
      url: repoUrl(delivery, 'issues', 41),
      repo: delivery,
      closedAt: withinRange(range, 1, 18),
      stateReason: 'COMPLETED',
    },
    {
      id: 'demo-closed-3',
      number: 12,
      title: 'Legacy callback endpoint removal',
      url: repoUrl(api, 'issues', 12),
      repo: api,
      closedAt: withinRange(range, 2, 13),
      stateReason: 'NOT_PLANNED',
    },
  ]

  const mergedPulls: RawMergedPull[] = [
    {
      id: 'demo-merged-1',
      number: 565,
      title: 'Migrate payment sessions to opaque tokens',
      url: repoUrl(front, 'pull', 565),
      repo: front,
      createdAt: withinRange(range, 1, 10),
      mergedAt: withinRange(range, 3, 16),
    },
    {
      id: 'demo-merged-2',
      number: 901,
      title: 'Add merchant provider registry',
      url: repoUrl(api, 'pull', 901),
      repo: api,
      createdAt: withinRange(range, 2, 8),
      mergedAt: withinRange(range, 4, 12),
    },
  ]

  const commits: RawCommit[] = [
    {
      id: 'demo-commit-1',
      sha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      message: 'feat: opaque payment session tokens',
      url: repoUrl(front, 'commit', 'a1b2c3d'),
      repo: front,
      committedAt: withinRange(range, 0, 12),
    },
    {
      id: 'demo-commit-2',
      sha: 'b2c3d4e5f60718293a4b5c6d7e8f901234567890',
      message: 'fix: keep route state across reloads',
      url: repoUrl(delivery, 'commit', 'b2c3d4e'),
      repo: delivery,
      committedAt: withinRange(range, 1, 11),
    },
    {
      id: 'demo-commit-3',
      sha: 'c3d4e5f60718293a4b5c6d7e8f90123456789012',
      message: 'refactor: merchant provider registry',
      url: repoUrl(api, 'commit', 'c3d4e5f'),
      repo: api,
      committedAt: withinRange(range, 3, 10),
    },
    {
      id: 'demo-commit-4',
      sha: 'd4e5f60718293a4b5c6d7e8f9012345678901234',
      message: 'test: cover token migration',
      url: repoUrl(front, 'commit', 'd4e5f60'),
      repo: front,
      committedAt: withinRange(range, 4, 9),
    },
    {
      id: 'demo-commit-5',
      sha: 'e5f60718293a4b5c6d7e8f901234567890123456',
      message: 'docs: document the local refresh workflow',
      url: repoUrl(docs, 'commit', 'e5f6071'),
      repo: docs,
      committedAt: withinRange(range, 2, 15),
    },
  ]

  const projectItems: ProjectItem[] = [
    { projectNumber: 12, url: repoUrl(delivery, 'issues', 41), repo: delivery, type: 'Issue', assignees: [DEMO_IDENTITY.login] },
    { projectNumber: 11, url: repoUrl(front, 'pull', 501), repo: front, type: 'PullRequest', assignees: [DEMO_IDENTITY.login] },
    { projectNumber: 11, url: repoUrl(front, 'pull', 565), repo: front, type: 'PullRequest', assignees: [DEMO_IDENTITY.login] },
    { projectNumber: 11, url: repoUrl(front, 'issues', 88), repo: front, type: 'Issue', assignees: [DEMO_IDENTITY.login] },
    { projectNumber: 10, url: repoUrl(api, 'issues', 333), repo: api, type: 'Issue', assignees: [DEMO_IDENTITY.login] },
    { projectNumber: 10, url: repoUrl(api, 'pull', 901), repo: api, type: 'PullRequest', assignees: [DEMO_IDENTITY.login] },
    { projectNumber: 10, url: repoUrl(api, 'issues', 12), repo: api, type: 'Issue', assignees: [DEMO_IDENTITY.login] },
  ]

  const fetchedAt = new Date().toISOString()

  return {
    identity: DEMO_IDENTITY.login,
    organization: DEMO_ORGANIZATION,
    range,
    fetchedAt,
    demo: true,
    openIssues: { status: 'ok', data: openIssues, incomplete: false, note: null },
    openPulls: { status: 'ok', data: openPulls, incomplete: false, note: null },
    blockedIssues: { status: 'ok', data: blockedIssues, incomplete: false, note: null },
    closedIssues: { status: 'ok', data: closedIssues, incomplete: false, note: null },
    mergedPulls: { status: 'ok', data: mergedPulls, incomplete: false, note: null },
    commits: { status: 'ok', data: commits, incomplete: false, note: null },
    projects: { status: 'ok', data: projects, incomplete: false, note: null },
    projectItems: { status: 'ok', data: projectItems, incomplete: false, note: null },
  }
}

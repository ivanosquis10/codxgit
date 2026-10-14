import { describe, expect, it } from 'vitest'
import { metricFromSource } from '@/lib/metrics'
import { buildWeeklySummary } from '@/lib/summary'
import type {
  DateRange,
  PersonalWorkInput,
  ProjectItem,
  ProjectRef,
  RawBacklogItem,
  RawClosedIssue,
  RawCommit,
  RawMergedPull,
  SourceResult,
} from '@/lib/types'

const range: DateRange = {
  timeZone: 'America/Caracas',
  preset: 'this-week',
  startDate: '2026-10-05',
  endDate: '2026-10-09',
  startIso: '2026-10-05T04:00:00.000Z',
  endIso: '2026-10-10T03:59:59.999Z',
  label: 'Oct 5 - Oct 9, 2026',
  mondayDate: '2026-10-05',
  fridayDate: '2026-10-09',
}

const ok = <T,>(data: T, incomplete = false, note: string | null = null): SourceResult<T> => ({
  status: 'ok',
  data,
  incomplete,
  note,
})
const unavailable = (reason: string): SourceResult<never> => ({ status: 'unavailable', reason })
const notCovered = (): SourceResult<never> => ({ status: 'not-covered' })

const closed = (
  id: string,
  url: string,
  closedAt: string,
  stateReason: RawClosedIssue['stateReason'] = 'COMPLETED',
  repo = 'desarrollo-intelicorps/estelar-bi',
): RawClosedIssue => ({
  id,
  number: Number(id.replace(/\D/g, '')) || 1,
  title: `Issue ${id}`,
  url,
  repo,
  closedAt,
  stateReason,
})

const merged = (
  id: string,
  url: string,
  mergedAt: string,
  repo = 'desarrollo-intelicorps/estelar-bi',
  createdAt: string | null = null,
): RawMergedPull => ({
  id,
  number: 1,
  title: `PR ${id}`,
  url,
  repo,
  mergedAt,
  createdAt,
})

const openIssue = (
  id: string,
  repo: string,
  url: string,
  updatedAt = '2026-10-05T16:00:00Z',
  labels: string[] = [],
): RawBacklogItem => ({
  id,
  kind: 'issue',
  number: Number(id.replace(/\D/g, '')) || 1,
  title: `Issue ${id}`,
  url,
  repo,
  updatedAt,
  labels,
})

const commit = (id: string, repo: string, committedAt: string): RawCommit => ({
  id,
  sha: `${id}0000000000000000000000000000000000000`.slice(0, 40),
  message: `commit ${id}`,
  url: `https://github.com/${repo}/commit/${id}`,
  repo,
  committedAt,
})

const project = (number: number, title: string, closed = false): ProjectRef => ({
  number,
  title,
  url: `https://github.com/orgs/desarrollo-intelicorps/projects/${number}`,
  closed,
  itemTotalCount: 1,
})

const projectItem = (
  projectNumber: number,
  url: string,
  repo = 'desarrollo-intelicorps/estelar-bi',
  assignees: string[] = ['desarrollador1IR'],
): ProjectItem => ({ projectNumber, url, repo, type: 'Issue', assignees })

function baseInput(overrides: Partial<PersonalWorkInput> = {}): PersonalWorkInput {
  return {
    identity: 'desarrollador1IR',
    organization: 'desarrollo-intelicorps',
    range,
    fetchedAt: '2026-10-05T20:00:00.000Z',
    demo: false,
    openIssues: ok([]),
    openPulls: ok([]),
    blockedIssues: ok([]),
    closedIssues: ok([]),
    mergedPulls: ok([]),
    commits: ok([]),
    projects: ok([]),
    projectItems: ok([]),
    ...overrides,
  }
}

describe('metricFromSource', () => {
  it('never turns an unavailable source into zero', () => {
    expect(metricFromSource(unavailable('denied'), 12)).toEqual({
      status: 'unavailable',
      reason: 'denied',
    })
  })

  it('preserves not-covered separately from a real zero', () => {
    expect(metricFromSource(notCovered(), 0)).toEqual({ status: 'not-covered' })
    expect(metricFromSource(ok([]), 0)).toEqual({ status: 'ok', value: 0 })
  })
})

describe('buildWeeklySummary', () => {
  it('counts a multi-project item once in totals and once per project', () => {
    const summary = buildWeeklySummary(
      baseInput({
        closedIssues: ok([closed('1', 'https://x/issues/7', '2026-10-06T15:00:00.000Z')]),
        projects: ok([project(10, 'P10'), project(11, 'P11')]),
        projectItems: ok([
          projectItem(10, 'https://x/issues/7'),
          projectItem(11, 'https://x/issues/7'),
        ]),
      }),
    )

    expect(summary.issuesClosed.metric).toEqual({ status: 'ok', value: 1 })
    expect(summary.issuesClosed.items[0]?.projectNumbers).toEqual([10, 11])
    expect(summary.projects.active.find((p) => p.number === 10)?.issuesClosedInWeek).toBe(1)
    expect(summary.projects.active.find((p) => p.number === 11)?.issuesClosedInWeek).toBe(1)
  })

  it('narrows with a project filter without multiplying counts', () => {
    const summary = buildWeeklySummary(
      baseInput({
        closedIssues: ok([
          closed('1', 'https://x/issues/7', '2026-10-06T15:00:00.000Z'),
          closed('2', 'https://x/issues/8', '2026-10-07T15:00:00.000Z'),
        ]),
        projects: ok([project(10, 'P10'), project(11, 'P11')]),
        projectItems: ok([projectItem(10, 'https://x/issues/7')]),
      }),
      { projectFilter: [10] },
    )

    expect(summary.issuesClosed.metric).toEqual({ status: 'ok', value: 1 })
    expect(summary.issuesClosed.items.map((item) => item.id)).toEqual(['1'])
  })

  it('narrows to the union when several projects are selected', () => {
    const summary = buildWeeklySummary(
      baseInput({
        closedIssues: ok([
          closed('1', 'https://x/issues/7', '2026-10-06T15:00:00.000Z'),
          closed('2', 'https://x/issues/8', '2026-10-07T15:00:00.000Z'),
        ]),
        projects: ok([project(10, 'P10'), project(11, 'P11')]),
        projectItems: ok([
          projectItem(10, 'https://x/issues/7'),
          projectItem(11, 'https://x/issues/8'),
        ]),
      }),
      { projectFilter: [10, 11] },
    )

    expect(summary.issuesClosed.metric).toEqual({ status: 'ok', value: 2 })
  })

  it('excludes items outside the selected projects', () => {
    const summary = buildWeeklySummary(
      baseInput({
        closedIssues: ok([closed('1', 'https://x/issues/7', '2026-10-06T15:00:00.000Z')]),
        projects: ok([project(10, 'P10'), project(99, 'P99')]),
        projectItems: ok([projectItem(10, 'https://x/issues/7')]),
      }),
      { projectFilter: [99] },
    )

    expect(summary.issuesClosed.metric).toEqual({ status: 'ok', value: 0 })
    expect(summary.issuesClosed.items).toEqual([])
  })

  it('separates not-planned closures from completed closures', () => {
    const summary = buildWeeklySummary(
      baseInput({
        closedIssues: ok([
          closed('1', 'https://x/issues/1', '2026-10-06T15:00:00.000Z', 'COMPLETED'),
          closed('2', 'https://x/issues/2', '2026-10-07T15:00:00.000Z', 'NOT_PLANNED'),
          closed('3', 'https://x/issues/3', '2026-10-08T15:00:00.000Z', 'OTHER'),
        ]),
      }),
    )

    expect(summary.issuesClosed.metric).toEqual({ status: 'ok', value: 3 })
    expect(summary.issuesClosed.completed).toEqual({ status: 'ok', value: 1 })
    expect(summary.issuesClosed.notPlanned).toEqual({ status: 'ok', value: 1 })
  })

  it('maps a denied Projects read to unavailable, never zero', () => {
    const reason = 'Permission denied: missing read:project scope'
    const summary = buildWeeklySummary(
      baseInput({
        projects: unavailable(reason),
        projectItems: unavailable(reason),
      }),
    )

    expect(summary.projects.metric).toEqual({ status: 'unavailable', reason })
    expect(summary.projects.metric).not.toEqual({ status: 'ok', value: 0 })
    expect(summary.projects.active).toEqual([])
    expect(summary.projects.reason).toBe(reason)
  })

  it('calculates median PR lead time and keeps blocked issues separate', () => {
    const summary = buildWeeklySummary(
      baseInput({
        mergedPulls: ok([
          merged('p1', 'https://x/pull/1', '2026-10-05T04:00:00.000Z', 'o/r', '2026-10-04T04:00:00.000Z'),
          merged('p2', 'https://x/pull/2', '2026-10-06T04:00:00.000Z', 'o/r', '2026-10-04T04:00:00.000Z'),
          merged('p3', 'https://x/pull/3', '2026-10-07T04:00:00.000Z', 'o/r', '2026-10-04T04:00:00.000Z'),
        ]),
        blockedIssues: ok([openIssue('b1', 'o/r', 'https://x/issues/1', '2026-10-05T16:00:00Z', ['blocked'])]),
      }),
    )

    expect(summary.medianPrLeadTimeMinutes).toEqual({ status: 'ok', value: 2880 })
    expect(summary.blockedIssues.metric).toEqual({ status: 'ok', value: 1 })
    expect(summary.cycleTime).toEqual({ status: 'unavailable', reason: expect.any(String) })
  })

  it('reports an unsynced week as not covered instead of zero', () => {
    const summary = buildWeeklySummary(
      baseInput({
        closedIssues: notCovered(),
        mergedPulls: notCovered(),
        commits: notCovered(),
        projects: notCovered(),
        projectItems: notCovered(),
      }),
    )

    expect(summary.issuesClosed.metric).toEqual({ status: 'not-covered' })
    expect(summary.pullsMerged.metric).toEqual({ status: 'not-covered' })
    expect(summary.commits.metric).toEqual({ status: 'not-covered' })
    expect(summary.projects.metric).toEqual({ status: 'not-covered' })
  })

  it('includes Friday 23:59 local and excludes Saturday 00:00 local', () => {
    const summary = buildWeeklySummary(
      baseInput({
        mergedPulls: ok([
          merged('in', 'https://x/pull/1', '2026-10-10T03:59:59.999Z'),
          merged('out', 'https://x/pull/2', '2026-10-10T04:00:00.000Z'),
        ]),
      }),
    )

    expect(summary.pullsMerged.metric).toEqual({ status: 'ok', value: 1 })
    expect(summary.pullsMerged.items.map((item) => item.id)).toEqual(['in'])
  })

  it('filters to a rolling range with inclusive local boundaries', () => {
    const rolling: DateRange = {
      timeZone: 'America/Caracas',
      preset: 'last-15-days',
      startDate: '2026-09-21',
      endDate: '2026-10-05',
      startIso: '2026-09-21T04:00:00.000Z',
      endIso: '2026-10-06T03:59:59.999Z',
      label: 'Sep 21 - Oct 5, 2026',
    }
    const summary = buildWeeklySummary(
      baseInput({
        range: rolling,
        closedIssues: ok([
          closed('in-start', 'https://x/issues/1', '2026-09-21T04:00:00.000Z'),
          closed('in-end', 'https://x/issues/2', '2026-10-06T03:59:59.999Z'),
          closed('before', 'https://x/issues/3', '2026-09-21T03:59:59.999Z'),
          closed('after', 'https://x/issues/4', '2026-10-06T04:00:00.000Z'),
        ]),
      }),
    )

    expect(summary.issuesClosed.items.map((item) => item.id)).toEqual(['in-start', 'in-end'])
    expect(summary.range).toEqual(rolling)
  })

  it('keeps the current open backlog separate from weekly closures', () => {
    const summary = buildWeeklySummary(
      baseInput({
        openIssues: ok([
          {
            id: 'o1',
            kind: 'issue',
            number: 333,
            title: 'Still open',
            url: 'https://x/issues/333',
            repo: 'desarrollo-intelicorps/estelar-bi',
            updatedAt: '2026-10-05T16:27:52Z',
          },
        ]),
        closedIssues: ok([closed('1', 'https://x/issues/1', '2026-10-06T15:00:00.000Z')]),
      }),
    )

    expect(summary.backlogIssues.metric).toEqual({ status: 'ok', value: 1 })
    expect(summary.issuesClosed.metric).toEqual({ status: 'ok', value: 1 })
    expect(summary.backlogIssues.items).toHaveLength(1)
    expect(summary.issuesClosed.items).toHaveLength(1)
  })

  it('attributes commits to Projects by repository and labels it repository-derived', () => {
    const summary = buildWeeklySummary(
      baseInput({
        commits: ok([commit('c1', 'desarrollo-intelicorps/estelar-bi', '2026-10-07T12:00:00.000Z')]),
        projects: ok([project(10, 'P10')]),
        projectItems: ok([projectItem(10, 'https://x/issues/7')]),
      }),
    )

    expect(summary.commits.metric).toEqual({ status: 'ok', value: 1 })
    expect(summary.commits.attribution).toBe('repository-derived')
    expect(summary.commits.items[0]?.projectAttribution).toBe('repository-derived')
    expect(summary.commits.items[0]?.projectNumbers).toEqual([10])
    expect(summary.commits.items[0]?.shortSha).toHaveLength(7)
  })

  it('lists only Projects linked to the personal scope as active', () => {
    const summary = buildWeeklySummary(
      baseInput({
        closedIssues: ok([closed('1', 'https://x/issues/7', '2026-10-06T15:00:00.000Z')]),
        projects: ok([project(10, 'Active'), project(11, 'Idle'), project(12, 'Closed', true)]),
        projectItems: ok([
          projectItem(10, 'https://x/issues/7'),
          projectItem(11, 'https://x/issues/9', 'desarrollo-intelicorps/estelar-bi', [
            'someone-else',
          ]),
          projectItem(12, 'https://x/issues/7', 'desarrollo-intelicorps/estelar-bi', []),
        ]),
      }),
    )

    expect(summary.projects.active.map((p) => p.number)).toEqual([10])
    expect(summary.projects.all.map((p) => p.number)).toEqual([10, 11, 12])
    expect(summary.projects.active[0]?.attribution).toBe('assignee')
  })

  it('marks incomplete coverage without hiding the data that was read', () => {
    const summary = buildWeeklySummary(
      baseInput({
        closedIssues: ok([closed('1', 'https://x/issues/1', '2026-10-06T15:00:00.000Z')], true, 'first page only'),
        projects: ok([project(10, 'P10')], true),
      }),
    )

    expect(summary.issuesClosed.metric).toEqual({ status: 'ok', value: 1 })
    expect(summary.projects.incomplete).toBe(true)
    expect(summary.coverage.find((row) => row.key === 'closed-issues')?.status).toBe('ok')
    expect(summary.coverage.find((row) => row.key === 'closed-issues')?.detail).toBe('first page only')
    expect(summary.coverage.find((row) => row.key === 'projects')?.status).toBe('ok')
  })

  it('carries the unavailable reason into the coverage list', () => {
    const reason = 'Permission denied: missing read:project scope'
    const summary = buildWeeklySummary(
      baseInput({ projects: unavailable(reason), projectItems: unavailable(reason) }),
    )

    const row = summary.coverage.find((entry) => entry.key === 'projects')
    expect(row?.status).toBe('unavailable')
    expect(row?.detail).toContain('read:project')
  })
})

describe('repository-first grouping', () => {
  const repoA = 'desarrollo-intelicorps/estelar-bi'
  const repoB = 'desarrollo-intelicorps/autogestion-front'
  const repoNoProject = 'desarrollo-intelicorps/docs-site'

  it('derives repository choices only from personal item, backlog and commit sources', () => {
    const summary = buildWeeklySummary(
      baseInput({
        openIssues: ok([openIssue('1', repoA, 'https://x/issues/1')]),
        commits: ok([commit('c1', repoB, '2026-10-07T12:00:00.000Z')]),
        projects: ok([project(10, 'P10')]),
        // Project 10 also tracks a repository the person never touched.
        projectItems: ok([projectItem(10, 'https://x/org/1', repoNoProject, ['someone-else'])]),
      }),
    )

    expect(summary.repositories.choices.map((choice) => choice.repo)).toEqual([repoB, repoA])
    expect(summary.repositories.choices.map((choice) => choice.repo)).not.toContain(repoNoProject)
  })

  it('makes a repository with no Project membership selectable and visible', () => {
    const summary = buildWeeklySummary(
      baseInput({
        commits: ok([commit('c1', repoNoProject, '2026-10-07T12:00:00.000Z')]),
        projects: ok([project(10, 'P10')]),
        projectItems: ok([projectItem(10, 'https://x/issues/7')]),
      }),
    )

    expect(summary.repositories.choices.map((choice) => choice.repo)).toEqual([repoNoProject])
    expect(summary.repositories.metric).toEqual({ status: 'ok', value: 1 })
    const row = summary.repositories.active.find((entry) => entry.repo === repoNoProject)
    expect(row?.commits).toEqual({ status: 'ok', value: 1 })
    expect(summary.commits.items.map((item) => item.repo)).toEqual([repoNoProject])
  })

  it('applies a repository filter to every item list and to commits', () => {
    const summary = buildWeeklySummary(
      baseInput({
        closedIssues: ok([
          closed('1', 'https://x/issues/1', '2026-10-06T15:00:00.000Z', 'COMPLETED', repoA),
          closed('2', 'https://x/issues/2', '2026-10-07T15:00:00.000Z', 'COMPLETED', repoB),
        ]),
        mergedPulls: ok([
          merged('m1', 'https://x/pull/1', '2026-10-07T10:00:00.000Z', repoA),
          merged('m2', 'https://x/pull/2', '2026-10-08T10:00:00.000Z', repoB),
        ]),
        commits: ok([
          commit('c1', repoA, '2026-10-07T12:00:00.000Z'),
          commit('c2', repoB, '2026-10-08T12:00:00.000Z'),
        ]),
        openIssues: ok([
          openIssue('3', repoA, 'https://x/issues/3'),
          openIssue('4', repoB, 'https://x/issues/4'),
        ]),
      }),
      { repoFilter: [repoA] },
    )

    expect(summary.issuesClosed.items.map((item) => item.repo)).toEqual([repoA])
    expect(summary.pullsMerged.items.map((item) => item.repo)).toEqual([repoA])
    expect(summary.commits.items.map((item) => item.repo)).toEqual([repoA])
    expect(summary.backlogIssues.items.map((item) => item.repo)).toEqual([repoA])
    expect(summary.issuesClosed.metric).toEqual({ status: 'ok', value: 1 })
    expect(summary.repositories.active.map((entry) => entry.repo)).toEqual([repoA])
    expect(summary.repositories.metric).toEqual({ status: 'ok', value: 1 })
  })

  it('intersects a repository filter with a Project filter', () => {
    const summary = buildWeeklySummary(
      baseInput({
        closedIssues: ok([
          closed('1', 'https://x/issues/1', '2026-10-06T15:00:00.000Z', 'COMPLETED', repoA),
          closed('2', 'https://x/issues/2', '2026-10-07T15:00:00.000Z', 'COMPLETED', repoB),
          closed('3', 'https://x/issues/3', '2026-10-08T15:00:00.000Z', 'COMPLETED', repoA),
        ]),
        projects: ok([project(10, 'P10')]),
        projectItems: ok([projectItem(10, 'https://x/issues/1')]),
      }),
      { repoFilter: [repoA], projectFilter: [10] },
    )

    expect(summary.issuesClosed.items.map((item) => item.id)).toEqual(['1'])
    expect(summary.repositories.active.map((entry) => entry.repo)).toEqual([repoA])
    expect(summary.repositories.active[0]?.issuesClosedInWeek).toBe(1)
  })

  it('excludes a Project whose only link is repository-derived commit activity', () => {
    const summary = buildWeeklySummary(
      baseInput({
        commits: ok([commit('c1', repoA, '2026-10-07T12:00:00.000Z')]),
        projects: ok([project(10, 'Repo-only P10')]),
        projectItems: ok([projectItem(10, 'https://x/org/1', repoA, ['someone-else'])]),
      }),
    )

    expect(summary.commits.items).toHaveLength(1)
    expect(summary.projects.active).toEqual([])
    expect(summary.projects.metric).toEqual({ status: 'ok', value: 0 })
  })

  it('makes active Project rows respect both the repository and Project filters', () => {
    const summary = buildWeeklySummary(
      baseInput({
        closedIssues: ok([
          closed('1', 'https://x/issues/1', '2026-10-06T15:00:00.000Z', 'COMPLETED', repoA),
          closed('2', 'https://x/issues/2', '2026-10-07T15:00:00.000Z', 'COMPLETED', repoB),
        ]),
        projects: ok([project(10, 'P10'), project(11, 'P11')]),
        projectItems: ok([
          projectItem(10, 'https://x/issues/1', repoA),
          projectItem(11, 'https://x/issues/2', repoB),
        ]),
      }),
      { repoFilter: [repoA] },
    )

    expect(summary.projects.active.map((entry) => entry.number)).toEqual([10])

    const byProjects = buildWeeklySummary(
      baseInput({
        closedIssues: ok([
          closed('1', 'https://x/issues/1', '2026-10-06T15:00:00.000Z', 'COMPLETED', repoA),
          closed('2', 'https://x/issues/2', '2026-10-07T15:00:00.000Z', 'COMPLETED', repoB),
        ]),
        projects: ok([project(10, 'P10'), project(11, 'P11')]),
        projectItems: ok([
          projectItem(10, 'https://x/issues/1', repoA),
          projectItem(11, 'https://x/issues/2', repoB),
        ]),
      }),
      { projectFilter: [11] },
    )

    expect(byProjects.projects.active.map((entry) => entry.number)).toEqual([11])
  })
})

describe('repository catalog choices', () => {
  const repoA = 'desarrollo-intelicorps/estelar-bi'
  const repoNoActivity = 'desarrollo-intelicorps/docs-site'

  it('keeps a catalog repository selectable with a real zero range count', () => {
    const summary = buildWeeklySummary(
      baseInput({
        catalog: [{ repo: repoNoActivity, pinned: true, source: 'manual' }],
      }),
    )

    const choice = summary.repositories.choices.find((entry) => entry.repo === repoNoActivity)
    expect(choice).toMatchObject({ itemCount: 0, pinned: true, source: 'manual' })
    // A pinned repository with no activity is a filter choice, not an activity row.
    expect(summary.repositories.active.map((entry) => entry.repo)).not.toContain(repoNoActivity)
  })

  it('attaches range counts to catalog entries without dropping old repositories', () => {
    const summary = buildWeeklySummary(
      baseInput({
        catalog: [
          { repo: repoA, pinned: true, source: 'manual' },
          { repo: repoNoActivity, pinned: false, source: 'observed' },
        ],
        commits: ok([commit('c1', repoA, '2026-10-07T12:00:00.000Z')]),
      }),
    )

    expect(summary.repositories.choices).toEqual([
      { repo: repoNoActivity, itemCount: 0, pinned: false, source: 'observed' },
      { repo: repoA, itemCount: 1, pinned: true, source: 'manual' },
    ])
    expect(summary.repositories.active.map((entry) => entry.repo)).toEqual([repoA])
  })

  it('labels range-observed repositories as observed choices when no catalog exists', () => {
    const summary = buildWeeklySummary(
      baseInput({ commits: ok([commit('c1', repoA, '2026-10-07T12:00:00.000Z')]) }),
    )

    expect(summary.repositories.choices).toEqual([
      { repo: repoA, itemCount: 1, pinned: false, source: 'observed' },
    ])
  })

  it('keeps a catalog entry when every range source is uncovered', () => {
    const summary = buildWeeklySummary(
      baseInput({
        catalog: [{ repo: repoA, pinned: true, source: 'manual' }],
        openIssues: notCovered(),
        openPulls: notCovered(),
        closedIssues: notCovered(),
        mergedPulls: notCovered(),
        commits: notCovered(),
      }),
    )

    expect(summary.repositories.choices.map((entry) => entry.repo)).toEqual([repoA])
    expect(summary.repositories.choices[0]?.itemCount).toBe(0)
    expect(summary.repositories.metric).toEqual({ status: 'not-covered' })
  })
})

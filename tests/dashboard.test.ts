import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDatabase, resetDatabaseForTests } from '@/db/client.server'
import { observeRepositories } from '@/db/repositories.server'
import { putIdentity } from '@/db/snapshots.server'
import { shiftIsoDate } from '@/lib/week'
import { loadDashboardData } from '@/server/dashboard.server'

const NO_PROJECT_REPO = 'demo-organization/docs-site'
const ORG = 'desarrollo-intelicorps'
const ACCOUNT = 'desarrollador1IR'

describe('default range', () => {
  it('defaults to the trailing 30 calendar days including today', async () => {
    const data = await loadDashboardData({ demo: true })
    const { range } = data.summary

    expect(range.preset).toBe('last-30-days')
    expect(shiftIsoDate(range.startDate, 29)).toBe(range.endDate)
    expect(range.mondayDate).toBeUndefined()
  })

  it('threads an explicit preset and anchor into the range', async () => {
    const data = await loadDashboardData({ demo: true, preset: 'last-week', weekStart: '2026-10-05' })
    expect(data.summary.range.preset).toBe('last-week')
    expect(data.summary.range.startDate).toBe('2026-09-28')
    expect(data.summary.range.endDate).toBe('2026-10-02')
  })

  it('freezes the default preset to an explicit local anchor', async () => {
    // The preset buttons pin the default preset to the local date they
    // rendered on; the range must stay on that date, not slide to "today".
    const data = await loadDashboardData({
      demo: true,
      preset: 'last-30-days',
      weekStart: '2026-10-05',
    })
    expect(data.summary.range.preset).toBe('last-30-days')
    expect(data.summary.range.startDate).toBe('2026-09-06')
    expect(data.summary.range.endDate).toBe('2026-10-05')
  })

  it('resolves anchored week presets to the Monday-Friday containing the anchor', async () => {
    const thisWeek = await loadDashboardData({
      demo: true,
      preset: 'this-week',
      weekStart: '2026-10-07',
    })
    expect(thisWeek.summary.range.startDate).toBe('2026-10-05')
    expect(thisWeek.summary.range.endDate).toBe('2026-10-09')

    const lastWeek = await loadDashboardData({
      demo: true,
      preset: 'last-week',
      weekStart: '2026-10-07',
    })
    expect(lastWeek.summary.range.startDate).toBe('2026-09-28')
    expect(lastWeek.summary.range.endDate).toBe('2026-10-02')
  })

  it('resolves a one-month lookback through the request', async () => {
    const data = await loadDashboardData({ demo: true, preset: 'one-month', weekStart: '2026-03-31' })
    expect(data.summary.range.startDate).toBe('2026-02-28')
    expect(data.summary.range.endDate).toBe('2026-03-31')
  })

  it('keeps a rolling anchor-based range wide enough for the demo dataset', async () => {
    const data = await loadDashboardData({ demo: true, preset: 'last-15-days' })
    expect(data.summary.range.preset).toBe('last-15-days')
    expect(data.summary.commits.items.length).toBeGreaterThan(0)
  })
})

describe('demo dashboard request threading', () => {
  it('exposes a demo repository that has no Project membership', async () => {
    const data = await loadDashboardData({ demo: true, weekStart: '2026-10-05' })

    expect(data.demo).toBe(true)
    expect(data.summary.repositories.choices.map((choice) => choice.repo)).toContain(NO_PROJECT_REPO)
    const row = data.summary.repositories.active.find((entry) => entry.repo === NO_PROJECT_REPO)
    expect(row?.commits).toEqual({ status: 'ok', value: 1 })
    expect(row?.issuesOpen).toBe(1)
  })

  it('threads the repository filter into the summary', async () => {
    const data = await loadDashboardData({
      demo: true,
      weekStart: '2026-10-05',
      repos: [NO_PROJECT_REPO],
    })

    expect(data.summary.commits.items.every((item) => item.repo === NO_PROJECT_REPO)).toBe(true)
    expect(data.summary.commits.items.length).toBeGreaterThan(0)
    expect(data.summary.repositories.active.map((entry) => entry.repo)).toEqual([NO_PROJECT_REPO])
  })

  it('intersects repository and Project filters in the demo dataset', async () => {
    const data = await loadDashboardData({
      demo: true,
      weekStart: '2026-10-05',
      repos: ['demo-organization/api-planning'],
      projects: [10],
    })

    expect(data.summary.issuesClosed.items.every((item) => item.repo === 'demo-organization/api-planning')).toBe(true)
    expect(data.summary.projects.active.map((project) => project.number)).toEqual([10])
  })
})

describe('repository catalog on the data route', () => {
  beforeEach(() => {
    process.env.CODXGIT_DB_PATH = ':memory:'
    resetDatabaseForTests()
  })

  afterEach(() => {
    delete process.env.CODXGIT_DB_PATH
    delete process.env.GITPOP_DB_PATH
    resetDatabaseForTests()
  })

  it('lists catalog repositories even when no snapshot is cached', async () => {
    const { db } = getDatabase()
    putIdentity(db, { login: ACCOUNT, name: null }, 100)
    observeRepositories(db, {
      account: ACCOUNT,
      organization: ORG,
      fullNames: [`${ORG}/api-autogestion`],
      seenAt: 100,
    })

    const data = await loadDashboardData({})

    expect(data.dataState).toBe('empty')
    expect(data.summary.repositories.choices.map((choice) => choice.repo)).toEqual([
      `${ORG}/api-autogestion`,
    ])
    expect(data.summary.repositories.choices[0]).toMatchObject({
      itemCount: 0,
      pinned: false,
      source: 'observed',
    })
  })
})

import { describe, expect, it } from 'vitest'
import { buildAnalyticsReport, formatLeadTime } from '@/lib/analytics'
import { buildDemoInput } from '@/lib/demo'
import { buildWeeklySummary } from '@/lib/summary'
import { getRange } from '@/lib/week'

describe('engineering analytics report', () => {
  it('includes completed work, merged pull requests, blockers, and links', () => {
    const range = getRange('last-7-days', new Date('2026-10-05T12:00:00Z'), 'UTC')
    const report = buildAnalyticsReport(buildWeeklySummary(buildDemoInput(range)))

    expect(report).toContain('# Engineering report')
    expect(report).toContain('Completed issues: 2')
    expect(report).toContain('Merged pull requests: 2')
    expect(report).toContain('## Blockers')
    expect(report).toContain('https://github.com/demo-organization/api-planning/issues/333')
  })

  it('formats lead time without introducing a productivity score', () => {
    expect(formatLeadTime({ status: 'ok', value: 90 })).toBe('1.5h')
    expect(formatLeadTime({ status: 'unavailable', reason: 'missing' })).toBe('Unavailable')
  })
})

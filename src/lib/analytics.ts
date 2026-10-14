import type { Metric, WeeklySummary } from './types'

function metricText(metric: Metric): string {
  if (metric.status === 'ok') return String(metric.value)
  if (metric.status === 'unavailable') return `Unavailable: ${metric.reason}`
  return 'Not covered'
}

function itemLine(item: { title: string; url: string; repo: string; number: number }): string {
  return `- [#${item.number} ${item.title}](${item.url}) — ${item.repo}`
}

/** Build a deterministic Markdown report from already-retrieved GitHub data. */
export function buildAnalyticsReport(summary: WeeklySummary): string {
  const completed = summary.issuesClosed.items.filter((item) => item.stateReason === 'COMPLETED')
  const merged = summary.pullsMerged.items
  const blocked = summary.blockedIssues.items

  const lines = [
    `# Engineering report · ${summary.range.label}`,
    '',
    `- Completed issues: ${metricText(summary.issuesClosed.completed)}`,
    `- Merged pull requests: ${metricText(summary.pullsMerged.metric)}`,
    `- Median PR lead time: ${
      summary.medianPrLeadTimeMinutes.status === 'ok'
        ? `${summary.medianPrLeadTimeMinutes.value} minutes`
        : metricText(summary.medianPrLeadTimeMinutes)
    }`,
    `- Blocked issues: ${metricText(summary.blockedIssues.metric)}`,
    '',
    '## Completed work',
    ...(completed.length > 0 ? completed.map(itemLine) : ['- None recorded in this range.']),
    '',
    '## Merged pull requests',
    ...(merged.length > 0 ? merged.map(itemLine) : ['- None recorded in this range.']),
    '',
    '## Blockers',
    ...(blocked.length > 0 ? blocked.map(itemLine) : ['- No open issues with the exact `blocked` label.']),
  ]

  return lines.join('\n')
}

export function formatLeadTime(metric: Metric): string {
  if (metric.status !== 'ok') return metric.status === 'unavailable' ? 'Unavailable' : 'Not covered'
  if (metric.value < 60) return `${metric.value}m`
  const hours = metric.value / 60
  if (hours < 24) return `${Number(hours.toFixed(1))}h`
  return `${Number((hours / 24).toFixed(1))}d`
}

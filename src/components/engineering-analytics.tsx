import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  ExternalLink,
  GitMerge,
  Timer,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MetricStatusBadge, MetricValue, metricStatusText } from '@/components/metric-value'
import { useI18n } from '@/i18n'
import { buildAnalyticsReport, formatLeadTime } from '@/lib/analytics'
import { formatInstant, shortRepo } from '@/lib/format'
import type { Metric, WeeklySummary } from '@/lib/types'

function MetricTile({
  label,
  description,
  metric,
  icon,
  value,
}: {
  label: string
  description: string
  metric: Metric
  icon: ReactNode
  value?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardDescription className="flex items-center gap-2">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className="flex items-center gap-2">
          {value ?? <MetricValue metric={metric} />}
          <MetricStatusBadge metric={metric} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-xs">{description}</p>
        {metric.status === 'unavailable' ? (
          <p className="text-muted-foreground mt-1 text-xs">{metric.reason}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function EngineeringAnalytics({ summary }: { summary: WeeklySummary }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const completed = summary.issuesClosed.items.filter((item) => item.stateReason === 'COMPLETED')
  const repositoryRows = summary.repositories.active.filter(
    (row) => row.issuesCompletedInRange > 0 || row.pullsMergedInWeek > 0,
  )
  const contributions = [
    ...completed.map((item) => ({
      id: `issue-${item.id}`,
      kind: t.analytics.issueType,
      title: `#${item.number} ${item.title}`,
      repo: item.repo,
      date: item.closedAt,
      url: item.url,
    })),
    ...summary.pullsMerged.items.map((item) => ({
      id: `pull-${item.id}`,
      kind: t.analytics.pullType,
      title: `#${item.number} ${item.title}`,
      repo: item.repo,
      date: item.mergedAt,
      url: item.url,
    })),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))

  async function copyReport() {
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(buildAnalyticsReport(summary))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopyError(t.analytics.copyError)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          {t.metrics.completedWork}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t.metrics.analyticsTitle}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.metrics.analyticsDescription}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricTile
          label={t.metrics.completedIssues}
          description={t.metrics.completedIssuesDesc}
          metric={summary.issuesClosed.completed}
          icon={<CheckCircle2 className="size-4" />}
        />
        <MetricTile
          label={t.metrics.mergedPullRequests}
          description={t.metrics.mergedPullRequestsDesc}
          metric={summary.pullsMerged.metric}
          icon={<GitMerge className="size-4" />}
        />
        <MetricTile
          label={t.metrics.medianLeadTime}
          description={t.metrics.medianLeadTimeDesc}
          metric={summary.medianPrLeadTimeMinutes}
          icon={<Clock3 className="size-4" />}
          value={
            <span className="text-3xl font-semibold tabular-nums">
              {formatLeadTime(summary.medianPrLeadTimeMinutes)}
            </span>
          }
        />
        <MetricTile
          label={t.metrics.blockedIssues}
          description={t.metrics.blockedIssuesDesc}
          metric={summary.blockedIssues.metric}
          icon={<CircleAlert className="size-4" />}
        />
        <MetricTile
          label={t.metrics.cycleTime}
          description={t.metrics.cycleTimeDesc}
          metric={summary.cycleTime}
          icon={<Timer className="size-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.analytics.repositoryTitle}</CardTitle>
          <CardDescription>{t.analytics.repositoryDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.repositories.metric.status !== 'ok' ? (
            <p className="text-muted-foreground text-sm">
              {metricStatusText(summary.repositories.metric, undefined, t)}
            </p>
          ) : repositoryRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t.analytics.repositoryEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.breakdowns.columns.repository}</TableHead>
                    <TableHead>{t.analytics.completedIssues}</TableHead>
                    <TableHead>{t.analytics.mergedPullRequests}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repositoryRows.map((row) => (
                    <TableRow key={row.repo}>
                      <TableCell className="font-medium">
                        <a
                          className="hover:underline"
                          href={`https://github.com/${row.repo}`}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {shortRepo(row.repo)}
                        </a>
                      </TableCell>
                      <TableCell>{row.issuesCompletedInRange}</TableCell>
                      <TableCell>{row.pullsMergedInWeek}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.analytics.contributionsTitle}</CardTitle>
          <CardDescription>{t.analytics.contributionsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {contributions.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t.analytics.contributionsEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.analytics.contributionType}</TableHead>
                    <TableHead>{t.workSections.itemHeader}</TableHead>
                    <TableHead>{t.workSections.repositoryHeader}</TableHead>
                    <TableHead>{t.analytics.contributionDate}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contributions.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant="outline">{item.kind}</Badge>
                      </TableCell>
                      <TableCell className="max-w-lg whitespace-normal">
                        <a
                          className="inline-flex items-center gap-1 font-medium hover:underline"
                          href={item.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {item.title}
                          <ExternalLink className="size-3 shrink-0 opacity-60" />
                        </a>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{shortRepo(item.repo)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatInstant(item.date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{t.analytics.reportTitle}</CardTitle>
            <CardDescription>{t.analytics.reportDescription}</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={copyReport}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? t.analytics.copiedReport : t.analytics.copyReport}
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted max-h-80 overflow-auto rounded-lg p-4 text-xs leading-relaxed whitespace-pre-wrap">
            {buildAnalyticsReport(summary)}
          </pre>
          {copyError ? <p className="text-destructive mt-2 text-xs">{copyError}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}

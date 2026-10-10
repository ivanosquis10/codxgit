import { ExternalLink } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MetricStatusBadge, metricStatusText } from '@/components/metric-value'
import { useI18n } from '@/i18n'
import { formatInstant, shortRepo } from '@/lib/format'
import type { Metric, WeeklySummary } from '@/lib/types'

export type WorkRow = {
  id: string
  title: string
  url: string
  repo: string
  meta: string
  badge?: { label: string; variant?: 'default' | 'secondary' | 'destructive' | 'outline' }
}

export function WorkSection({
  title,
  description,
  metric,
  rows,
  metaHeader,
  emptyText,
  unavailableHint,
}: {
  title: string
  description: string
  metric: Metric
  rows: WorkRow[]
  metaHeader: string
  emptyText: string
  unavailableHint?: string
}) {
  const { t } = useI18n()
  const statusText = metricStatusText(metric, unavailableHint, t)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {title}
          <MetricStatusBadge metric={metric} />
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {statusText ? (
          <p className="text-muted-foreground text-sm">{statusText}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyText}</p>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.workSections.itemHeader}</TableHead>
                    <TableHead>{t.workSections.repositoryHeader}</TableHead>
                    <TableHead>{metaHeader}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-md font-medium whitespace-normal">
                        <a
                          className="inline-flex items-center gap-1 hover:underline"
                          href={row.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {row.title}
                          <ExternalLink className="size-3 shrink-0 opacity-60" />
                        </a>
                        {row.badge ? (
                          <Badge variant={row.badge.variant ?? 'outline'} className="ml-2 align-middle">
                            {row.badge.label}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.repo}</TableCell>
                      <TableCell className="text-muted-foreground">{row.meta}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="space-y-3 md:hidden">
              {rows.map((row) => (
                <li key={row.id} className="rounded-lg border p-3">
                  <a
                    className="inline-flex items-center gap-1 font-medium hover:underline"
                    href={row.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {row.title}
                    <ExternalLink className="size-3 shrink-0 opacity-60" />
                  </a>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span>{row.repo}</span>
                    <span>{row.meta}</span>
                    {row.badge ? <Badge variant={row.badge.variant ?? 'outline'}>{row.badge.label}</Badge> : null}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function WorkSections({ summary }: { summary: WeeklySummary }) {
  const { t } = useI18n()

  const closedRows: WorkRow[] = summary.issuesClosed.items.map((item) => ({
    id: item.id,
    title: `#${item.number} ${item.title}`,
    url: item.url,
    repo: shortRepo(item.repo),
    meta: formatInstant(item.closedAt),
    badge:
      item.stateReason === 'NOT_PLANNED'
        ? { label: t.workSections.badges.notPlanned, variant: 'destructive' as const }
        : item.stateReason === 'COMPLETED'
          ? { label: t.workSections.badges.completed, variant: 'secondary' as const }
          : { label: item.stateReason.toLowerCase(), variant: 'outline' as const },
  }))

  const mergedRows: WorkRow[] = summary.pullsMerged.items.map((item) => ({
    id: item.id,
    title: `#${item.number} ${item.title}`,
    url: item.url,
    repo: shortRepo(item.repo),
    meta: formatInstant(item.mergedAt),
  }))

  const commitRows: WorkRow[] = summary.commits.items.map((item) => ({
    id: item.id,
    title: item.message || item.shortSha,
    url: item.url,
    repo: shortRepo(item.repo),
    meta: `${item.shortSha} · ${formatInstant(item.committedAt)}`,
  }))

  const backlogIssueRows: WorkRow[] = summary.backlogIssues.items.map((item) => ({
    id: item.id,
    title: `#${item.number} ${item.title}`,
    url: item.url,
    repo: shortRepo(item.repo),
    meta: `${t.workSections.updatedPrefix} ${formatInstant(item.updatedAt)}`,
  }))

  const backlogPullRows: WorkRow[] = summary.backlogPulls.items.map((item) => ({
    id: item.id,
    title: `#${item.number} ${item.title}`,
    url: item.url,
    repo: shortRepo(item.repo),
    meta: `${t.workSections.updatedPrefix} ${formatInstant(item.updatedAt)}`,
  }))

  return (
    <div className="space-y-4">
      <WorkSection
        title={t.workSections.closures}
        description={t.workSections.closuresDesc}
        metric={summary.issuesClosed.metric}
        rows={closedRows}
        metaHeader={t.workSections.closuresMeta}
        emptyText={t.workSections.closuresEmpty}
      />
      <WorkSection
        title={t.workSections.pullRequests}
        description={t.workSections.pullRequestsDesc}
        metric={summary.pullsMerged.metric}
        rows={mergedRows}
        metaHeader={t.workSections.pullRequestsMeta}
        emptyText={t.workSections.pullRequestsEmpty}
      />
      <WorkSection
        title={t.workSections.authoredCommits}
        description={t.workSections.authoredCommitsDesc}
        metric={summary.commits.metric}
        rows={commitRows}
        metaHeader={t.workSections.authoredCommitsMeta}
        emptyText={t.workSections.authoredCommitsEmpty}
      />
      <WorkSection
        title={t.workSections.backlogIssues}
        description={t.workSections.backlogIssuesDesc}
        metric={summary.backlogIssues.metric}
        rows={backlogIssueRows}
        metaHeader={t.workSections.backlogIssuesMeta}
        emptyText={t.workSections.backlogIssuesEmpty}
      />
      <WorkSection
        title={t.workSections.backlogPulls}
        description={t.workSections.backlogPullsDesc}
        metric={summary.backlogPulls.metric}
        rows={backlogPullRows}
        metaHeader={t.workSections.backlogPullsMeta}
        emptyText={t.workSections.backlogPullsEmpty}
      />
    </div>
  )
}

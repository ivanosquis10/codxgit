import type { ReactNode } from 'react'
import {
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  GitBranch,
  CircleDot,
  CheckCircle2,
} from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { MetricStatusBadge, MetricValue } from '@/components/metric-value'
import { useI18n } from '@/i18n'
import type { WeeklySummary } from '@/lib/types'

type Tile = {
  key: string
  label: string
  description: string
  metric: WeeklySummary['backlogIssues']['metric']
  icon: ReactNode
  footnote?: string
}

export function MetricCards({ summary }: { summary: WeeklySummary }) {
  const { t } = useI18n()
  const closed = summary.issuesClosed
  const commitNote =
    summary.commits.attribution === 'repository-derived'
      ? t.metrics.commitsAttributedDesc
      : t.metrics.commitsDefaultDesc

  const tiles: Tile[] = [
    {
      key: 'issues-closed',
      label: t.metrics.issues,
      description: t.metrics.issuesClosedDesc,
      metric: closed.metric,
      icon: <CheckCircle2 className="size-4" />,
      footnote:
        closed.completed.status === 'ok' && closed.notPlanned.status === 'ok'
          ? `${closed.completed.value} ${t.metrics.completedFootnote} · ${closed.notPlanned.value} ${t.metrics.notPlannedFootnote}`
          : undefined,
    },
    {
      key: 'pulls-merged',
      label: t.metrics.pullRequests,
      description: t.metrics.pullRequestsDesc,
      metric: summary.pullsMerged.metric,
      icon: <GitMerge className="size-4" />,
    },
    {
      key: 'commits',
      label: t.metrics.commits,
      description: commitNote,
      metric: summary.commits.metric,
      icon: <GitCommitHorizontal className="size-4" />,
    },
    {
      key: 'repositories',
      label: t.metrics.activeRepositories,
      description: t.metrics.activeRepositoriesDesc,
      metric: summary.repositories.metric,
      icon: <GitBranch className="size-4" />,
    },
    {
      key: 'backlog-issues',
      label: t.metrics.backlogIssues,
      description: t.metrics.backlogIssuesDesc,
      metric: summary.backlogIssues.metric,
      icon: <CircleDot className="size-4" />,
    },
    {
      key: 'backlog-pulls',
      label: t.metrics.backlogPulls,
      description: t.metrics.backlogPullsDesc,
      metric: summary.backlogPulls.metric,
      icon: <GitPullRequest className="size-4" />,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((tile) => (
        <Card key={tile.key}>
          <CardHeader className="gap-1">
            <CardDescription className="flex items-center gap-2">
              {tile.icon}
              {tile.label}
            </CardDescription>
            <CardTitle className="flex items-center gap-2">
              <MetricValue metric={tile.metric} />
              <MetricStatusBadge metric={tile.metric} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-muted-foreground text-xs">{tile.description}</p>
            {tile.footnote ? <p className="text-xs">{tile.footnote}</p> : null}
            {tile.metric.status === 'unavailable' ? (
              <p className="text-muted-foreground text-xs">{tile.metric.reason}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

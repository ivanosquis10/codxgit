import { GitBranch, Info } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { MetricStatusBadge } from '@/components/metric-value'
import { useI18n } from '@/i18n'
import { shortRepo } from '@/lib/format'
import type { WeeklySummary } from '@/lib/types'

function RepositoryTable({ repositories }: { repositories: WeeklySummary['repositories']['active'] }) {
  const { t } = useI18n()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.breakdowns.columns.repository}</TableHead>
          <TableHead className="text-right">{t.breakdowns.columns.openIssues}</TableHead>
          <TableHead className="text-right">{t.breakdowns.columns.openPRs}</TableHead>
          <TableHead className="text-right">{t.breakdowns.columns.closedInRange}</TableHead>
          <TableHead className="text-right">{t.breakdowns.columns.mergedInRange}</TableHead>
          <TableHead className="text-right">{t.breakdowns.columns.commits}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {repositories.map((entry) => (
          <TableRow key={entry.repo}>
            <TableCell className="font-medium whitespace-normal">
              <span title={entry.repo}>{shortRepo(entry.repo)}</span>
              <div className="text-muted-foreground text-xs">{entry.repo.split('/')[0]}</div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{entry.issuesOpen}</TableCell>
            <TableCell className="text-right tabular-nums">{entry.pullsOpen}</TableCell>
            <TableCell className="text-right tabular-nums">{entry.issuesClosedInWeek}</TableCell>
            <TableCell className="text-right tabular-nums">{entry.pullsMergedInWeek}</TableCell>
            <TableCell className="text-right tabular-nums">
              {entry.commits.status === 'ok' ? entry.commits.value : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RepositoryMobileList({
  repositories,
}: {
  repositories: WeeklySummary['repositories']['active']
}) {
  const { t } = useI18n()

  return (
    <ul className="space-y-3">
      {repositories.map((entry) => (
        <li key={entry.repo} className="rounded-lg border p-3">
          <div className="font-medium" title={entry.repo}>
            {shortRepo(entry.repo)}
          </div>
          <div className="text-muted-foreground text-xs">{entry.repo.split('/')[0]}</div>
          <div className="text-muted-foreground mt-2 grid grid-cols-2 gap-1 text-xs">
            <span>{t.breakdowns.columns.openIssues}: {entry.issuesOpen}</span>
            <span>{t.breakdowns.columns.openPRs}: {entry.pullsOpen}</span>
            <span>{t.breakdowns.columns.closedInRange}: {entry.issuesClosedInWeek}</span>
            <span>{t.breakdowns.columns.mergedInRange}: {entry.pullsMergedInWeek}</span>
            <span>
              {t.breakdowns.columns.commits}:{' '}
              {entry.commits.status === 'ok' ? entry.commits.value : t.metrics.unavailable}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** The primary grouping: repositories come from the catalog and personal sources. */
export function RepositoryBreakdown({ summary }: { summary: WeeklySummary }) {
  const { repositories } = summary
  const { t } = useI18n()
  const pinnedIdle = repositories.choices.filter((choice) => choice.pinned && choice.itemCount === 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <GitBranch className="size-4" aria-hidden />
          {t.breakdowns.byRepository}
          <MetricStatusBadge metric={repositories.metric} />
        </CardTitle>
        <CardDescription>{t.breakdowns.byRepositoryDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {repositories.metric.status === 'unavailable' ? (
          <Alert variant="destructive">
            <Info />
            <AlertTitle>{t.breakdowns.repositoriesUnavailableTitle}</AlertTitle>
            <AlertDescription>{repositories.metric.reason}</AlertDescription>
          </Alert>
        ) : repositories.metric.status === 'not-covered' ? (
          <Alert>
            <Info />
            <AlertTitle>{t.breakdowns.repositoriesNotSyncedTitle}</AlertTitle>
            <AlertDescription>{t.breakdowns.repositoriesNotSyncedDesc}</AlertDescription>
          </Alert>
        ) : repositories.active.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.breakdowns.emptyRepositoriesResult}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {repositories.active.length} {t.breakdowns.activeInRange}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {repositories.choices.length} {t.breakdowns.inCatalog}
              </span>
            </div>
            <div className="hidden md:block">
              <RepositoryTable repositories={repositories.active} />
            </div>
            <div className="md:hidden">
              <RepositoryMobileList repositories={repositories.active} />
            </div>
          </>
        )}
        {pinnedIdle.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            {t.breakdowns.pinnedIdleNotice}{' '}
            {pinnedIdle.map((choice) => shortRepo(choice.repo)).join(', ')}. {t.breakdowns.pinnedIdleSuffix}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

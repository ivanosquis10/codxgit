import { ExternalLink, Info, TriangleAlert } from 'lucide-react'

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
import type { WeeklySummary } from '@/lib/types'

function ProjectTable({ projects }: { projects: WeeklySummary['projects']['active'] }) {
  const { t } = useI18n()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.breakdowns.columns.project}</TableHead>
          <TableHead className="text-right">{t.breakdowns.columns.openIssues}</TableHead>
          <TableHead className="text-right">{t.breakdowns.columns.openPRs}</TableHead>
          <TableHead className="text-right">{t.breakdowns.columns.closedInRange}</TableHead>
          <TableHead className="text-right">{t.breakdowns.columns.mergedInRange}</TableHead>
          <TableHead className="text-right">{t.breakdowns.columns.commits}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <TableRow key={project.number}>
            <TableCell className="font-medium whitespace-normal">
              <a
                className="inline-flex items-center gap-1 hover:underline"
                href={project.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                {project.title}
                <ExternalLink className="size-3 opacity-60" />
              </a>
              <div className="text-muted-foreground text-xs">#{project.number}</div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{project.issuesOpen}</TableCell>
            <TableCell className="text-right tabular-nums">{project.pullsOpen}</TableCell>
            <TableCell className="text-right tabular-nums">{project.issuesClosedInWeek}</TableCell>
            <TableCell className="text-right tabular-nums">{project.pullsMergedInWeek}</TableCell>
            <TableCell className="text-right tabular-nums">
              {project.commits.status === 'ok' ? project.commits.value : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ProjectMobileList({ projects }: { projects: WeeklySummary['projects']['active'] }) {
  const { t } = useI18n()

  return (
    <ul className="space-y-3">
      {projects.map((project) => (
        <li key={project.number} className="rounded-lg border p-3">
          <a
            className="inline-flex items-center gap-1 font-medium hover:underline"
            href={project.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            {project.title}
            <ExternalLink className="size-3 opacity-60" />
          </a>
          <div className="text-muted-foreground mt-1 grid grid-cols-2 gap-1 text-xs">
            <span>{t.breakdowns.columns.openIssues}: {project.issuesOpen}</span>
            <span>{t.breakdowns.columns.openPRs}: {project.pullsOpen}</span>
            <span>{t.breakdowns.columns.closedInRange}: {project.issuesClosedInWeek}</span>
            <span>{t.breakdowns.columns.mergedInRange}: {project.pullsMergedInWeek}</span>
            <span>
              {t.breakdowns.columns.commits}:{' '}
              {project.commits.status === 'ok' ? project.commits.value : t.metrics.unavailable}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ProjectBreakdown({ summary }: { summary: WeeklySummary }) {
  const { projects } = summary
  const { t } = useI18n()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {t.breakdowns.byProject}
          <Badge variant="outline">{t.breakdowns.optionalBadge}</Badge>
          <MetricStatusBadge metric={projects.metric} />
          {projects.incomplete ? (
            <Badge variant="outline">{t.breakdowns.partialCoverageBadge}</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>{t.breakdowns.byProjectDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {projects.metric.status === 'unavailable' ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>{t.breakdowns.projectsUnavailableTitle}</AlertTitle>
            <AlertDescription>
              <p>{projects.reason}</p>
              <p>{t.breakdowns.projectsIndependentNotice}</p>
            </AlertDescription>
          </Alert>
        ) : projects.metric.status === 'not-covered' ? (
          <Alert>
            <Info />
            <AlertTitle>{t.breakdowns.projectsNotSyncedTitle}</AlertTitle>
            <AlertDescription>{t.breakdowns.projectsNotSyncedDesc}</AlertDescription>
          </Alert>
        ) : projects.active.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.breakdowns.emptyProjectsResult}</p>
        ) : (
          <>
            <div className="hidden md:block">
              <ProjectTable projects={projects.active} />
            </div>
            <div className="md:hidden">
              <ProjectMobileList projects={projects.active} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

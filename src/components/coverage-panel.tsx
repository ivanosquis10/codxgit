import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/i18n'
import { formatInstant, formatRelativeTime } from '@/lib/format'
import type { MetricStatus, SourceCoverage } from '@/lib/types'

function statusVariant(status: MetricStatus): 'secondary' | 'destructive' | 'outline' {
  if (status === 'ok') return 'secondary'
  if (status === 'unavailable') return 'destructive'
  return 'outline'
}

export function CoveragePanel({
  coverage,
  refreshedAt,
}: {
  coverage: SourceCoverage[]
  refreshedAt: string | null
}) {
  const { t } = useI18n()

  function getStatusLabel(status: MetricStatus): string {
    if (status === 'ok') return t.coverage.statusOk
    if (status === 'unavailable') return t.coverage.statusUnavailable
    return t.coverage.statusNotCovered
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.coverage.title}</CardTitle>
        <CardDescription>
          {t.coverage.descriptionPrefix} {formatRelativeTime(refreshedAt)} ({formatInstant(refreshedAt)}).{' '}
          {t.coverage.descriptionMissing}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {coverage.map((row) => (
            <li
              key={row.key}
              className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {row.label}
                  <Badge variant={statusVariant(row.status)}>{getStatusLabel(row.status)}</Badge>
                </div>
                {row.detail ? (
                  <p className="text-muted-foreground mt-1 text-xs">{row.detail}</p>
                ) : null}
              </div>
              <span className="text-muted-foreground text-xs">
                {row.fetchedAt ? formatRelativeTime(row.fetchedAt) : t.coverage.never}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/i18n'
import type { Translations } from '@/i18n/types'
import type { Metric } from '@/lib/types'
import { cn } from '@/lib/utils'

/** A metric value that never renders an unavailable or unsynced source as `0`. */
export function MetricValue({ metric, className }: { metric: Metric; className?: string }) {
  const { t } = useI18n()

  if (metric.status === 'ok') {
    return <span className={cn('text-3xl font-semibold tabular-nums', className)}>{metric.value}</span>
  }
  if (metric.status === 'unavailable') {
    return (
      <span
        title={metric.reason}
        className={cn('text-lg font-medium text-amber-700 dark:text-amber-400', className)}
      >
        {t.metrics.unavailable}
      </span>
    )
  }
  return (
    <span className={cn('text-lg font-medium text-muted-foreground', className)}>
      {t.metrics.notCovered}
    </span>
  )
}

/** A badge shown only when a source is not readable, so `ok` stays uncluttered. */
export function MetricStatusBadge({ metric }: { metric: Metric }) {
  const { t } = useI18n()

  if (metric.status === 'ok') return null
  if (metric.status === 'unavailable') {
    return (
      <Badge variant="destructive" title={metric.reason}>
        {t.coverage.statusUnavailable}
      </Badge>
    )
  }
  return <Badge variant="outline">{t.coverage.statusNotCovered}</Badge>
}

export function metricStatusText(
  metric: Metric,
  unavailableHint = '',
  t?: Translations,
): string | null {
  if (metric.status === 'ok') return null
  const unavailablePrefix = t ? t.metrics.unavailableSource : 'This source is unavailable.'
  const notSyncedMsg = t
    ? t.metrics.notSyncedWindow
    : 'This window has not been synced yet. Refresh to read it.'

  if (metric.status === 'unavailable') {
    return `${unavailablePrefix} ${metric.reason}${unavailableHint ? ` ${unavailableHint}` : ''}`
  }
  return notSyncedMsg
}

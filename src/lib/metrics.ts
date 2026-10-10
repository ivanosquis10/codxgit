import type { Metric, SourceResult } from './types'

/** A known count. */
export function okMetric(value: number): Metric {
  return { status: 'ok', value }
}

/** A count that could not be read; never rendered as zero. */
export function unavailableMetric(reason: string): Metric {
  return { status: 'unavailable', reason }
}

/** A window or source that was never synced. */
export const notCoveredMetric: Metric = { status: 'not-covered' }

/**
 * Derive a metric from a source result. The source's coverage status always
 * wins over the derived number, so an unavailable source can never be shown
 * as `0`.
 */
export function metricFromSource<T>(source: SourceResult<T>, value: number): Metric {
  if (source.status === 'not-covered') return notCoveredMetric
  if (source.status === 'unavailable') return unavailableMetric(source.reason)
  return okMetric(value)
}

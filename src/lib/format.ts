import type { Metric } from './types'

/** Render a metric so an unavailable or unsynced value never reads as `0`. */
export function formatMetric(metric: Metric): string {
  if (metric.status === 'ok') return String(metric.value)
  if (metric.status === 'unavailable') return 'unavailable'
  return 'not covered'
}

/** Compact description of how fresh a snapshot is. */
export function formatRelativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'never'
  const timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) return 'unknown'
  const seconds = Math.round((now - timestamp) / 1000)
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

/** Full local timestamp for detail rows and tooltips. */
export function formatInstant(iso: string | null): string {
  if (!iso) return '—'
  const timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) return iso
  return new Date(timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** `owner/name` → `name`, for compact repository labels. */
export function shortRepo(repo: string): string {
  const parts = repo.split('/')
  return parts.length === 2 ? (parts[1] ?? repo) : repo
}

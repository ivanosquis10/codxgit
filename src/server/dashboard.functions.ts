import { createServerFn } from '@tanstack/react-start'
import { parseAnchorParam, parseProjectList, parseRangePreset, parseRepoList } from '@/lib/query'
import { loadDashboardData, refreshDashboardData, type DashboardRequest } from './dashboard.server'

/**
 * Server functions are the data boundary. Route loaders are isomorphic, so all
 * database and `gh` access stays inside these handlers.
 */
function validateRequest(input: unknown): DashboardRequest {
  const record = (input ?? {}) as Record<string, unknown>
  return {
    preset: parseRangePreset(record.preset),
    weekStart: parseAnchorParam(record.weekStart),
    projects: parseProjectList(record.projects),
    repos: parseRepoList(record.repos),
    demo: record.demo === true,
  }
}

export const loadDashboard = createServerFn({ method: 'GET' })
  .validator(validateRequest)
  .handler(async ({ data }) => loadDashboardData(data))

export const refreshDashboard = createServerFn({ method: 'POST' })
  .validator(validateRequest)
  .handler(async ({ data }) => refreshDashboardData(data))

export const getLocaleServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { resolveLocaleFromCookie } = await import('./i18n.server')
  return resolveLocaleFromCookie()
})


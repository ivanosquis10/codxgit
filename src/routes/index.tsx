import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { Loader2, RefreshCw } from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { CoveragePanel } from '@/components/coverage-panel'
import { DashboardFilter } from '@/components/dashboard-filter'
import { MetricCards } from '@/components/metric-cards'
import { ProjectBreakdown } from '@/components/project-breakdown'
import { RepositoryBreakdown } from '@/components/repository-breakdown'
import { RepositoryFilter } from '@/components/repository-filter'
import { StateNotice } from '@/components/state-notice'
import { LanguageToggle } from '@/components/language-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { WorkSections } from '@/components/work-sections'
import { useI18n } from '@/i18n'
import { formatRelativeTime } from '@/lib/format'
import { parseProjectList, parseRepoList, serializeProjectList, serializeRepoList } from '@/lib/query'
import { loadDashboard, refreshDashboard } from '@/server/dashboard.functions'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    // Preserve the parsed value so the router's canonical URL matches the
    // requested one and does not redirect the params away.
    week: typeof search.week === 'string' ? search.week : undefined,
    preset: typeof search.preset === 'string' ? search.preset : undefined,
    projects: typeof search.projects === 'string' ? search.projects : undefined,
    repos: typeof search.repos === 'string' ? search.repos : undefined,
    demo:
      search.demo === true || search.demo === 1 || search.demo === '1' || search.demo === 'true'
        ? true
        : undefined,
  }),
  loaderDeps: ({ search }) => ({
    week: search.week,
    preset: search.preset,
    projects: search.projects,
    repos: search.repos,
    demo: search.demo,
  }),
  loader: ({ deps }) =>
    loadDashboard({
      data: {
        weekStart: deps.week,
        preset: deps.preset,
        projects: parseProjectList(deps.projects),
        repos: parseRepoList(deps.repos),
        demo: deps.demo,
      },
    }),
  component: DashboardPage,
})

function DashboardPage() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()
  const refresh = useServerFn(refreshDashboard)
  const { t } = useI18n()

  const [refreshing, setRefreshing] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const selectedProjects = parseProjectList(search.projects)
  const selectedRepos = parseRepoList(search.repos)

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshError(null)
    try {
      const result = await refresh({
        data: {
          weekStart: search.week,
          preset: search.preset,
          projects: selectedProjects,
          repos: selectedRepos,
          demo: search.demo,
        },
      })
      setWarnings(result.warnings)
      await router.invalidate({ sync: true })
    } catch (cause) {
      setRefreshError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRefreshing(false)
    }
  }

  function handleProjects(next: number[]) {
    void navigate({
      to: '/',
      search: (previous) => ({
        week: previous.week,
        preset: previous.preset,
        projects: serializeProjectList(next),
        repos: previous.repos,
        demo: previous.demo,
      }),
    })
  }

  function handleRepos(next: string[]) {
    void navigate({
      to: '/',
      search: (previous) => ({
        week: previous.week,
        preset: previous.preset,
        projects: previous.projects,
        repos: serializeRepoList(next),
        demo: previous.demo,
      }),
    })
  }

  // Wider, deliberate desktop standard (16rem) instead of min(12rem, 20vw): the
  // icon-collapsible rail needs room for labels while SidebarInset keeps the rest.
  return (
    <SidebarProvider style={{ '--sidebar-width': 'var(--app-sidebar-width)' } as CSSProperties}>
      <AppSidebar
        data={data}
        selectedProjects={selectedProjects}
        onProjectsChange={handleProjects}
      />
      <SidebarInset className="min-w-0">
        <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <SidebarTrigger aria-label={t.nav.toggleNavigation} />
              <RepositoryFilter
                choices={data.summary.repositories.choices}
                selected={selectedRepos}
                onChange={handleRepos}
                onCatalogChanged={() => void router.invalidate({ sync: true })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {t.common.refreshed} {formatRelativeTime(data.refreshedAt)}
              </span>
              <Button onClick={handleRefresh} disabled={refreshing} size="sm">
                {refreshing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {refreshing ? t.common.refreshing : t.common.refresh}
              </Button>
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="min-w-0 flex-1 space-y-6 px-4 py-6">
          {refreshError ? (
            <Alert variant="destructive">
              <AlertTitle>{t.common.refreshFailed}</AlertTitle>
              <AlertDescription>{refreshError}</AlertDescription>
            </Alert>
          ) : null}

          <StateNotice data={data} warnings={warnings} />

          <DashboardFilter range={data.summary.range} />

          <div id="overview" className="scroll-mt-20">
            <MetricCards summary={data.summary} />
          </div>

          <div id="repositories" className="scroll-mt-20">
            <RepositoryBreakdown summary={data.summary} />
          </div>

          <div id="projects" className="scroll-mt-20">
            <ProjectBreakdown summary={data.summary} />
          </div>

          <div id="work" className="scroll-mt-20">
            <WorkSections summary={data.summary} />
          </div>

          <div id="coverage" className="scroll-mt-20">
            <CoveragePanel coverage={data.summary.coverage} refreshedAt={data.refreshedAt} />
          </div>
        </div>

        <footer className="text-muted-foreground px-4 py-8 text-xs">
          <p>{t.common.readOnlyNotice}</p>
          <p className="mt-2">
            <Link
              className="underline underline-offset-4"
              to="/"
              search={(previous) => ({
                week: previous.week,
                preset: previous.preset,
                projects: previous.projects,
                repos: previous.repos,
                demo: previous.demo ? undefined : true,
              })}
            >
              {data.demo ? t.common.exitDemo : t.common.previewDemo}
            </Link>
          </p>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}

import type { LucideIcon } from 'lucide-react'
import { BarChart3, FolderKanban, GitBranch, GitCommitHorizontal, LayoutDashboard, ShieldCheck } from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { ProjectFilter } from '@/components/project-filter'
import { BrandLogo } from '@/components/brand-logo'
import { useI18n } from '@/i18n'
import type { DashboardData } from '@/lib/types'

type SectionKey = 'overview' | 'analytics' | 'repositories' | 'projects' | 'work' | 'coverage'

const SECTION_ICONS: Record<SectionKey, LucideIcon> = {
  overview: LayoutDashboard,
  analytics: BarChart3,
  repositories: GitBranch,
  projects: FolderKanban,
  work: GitCommitHorizontal,
  coverage: ShieldCheck,
}

function SidebarNav() {
  const { isMobile, setOpenMobile } = useSidebar()
  const { t } = useI18n()

  const links: { href: string; label: string; icon: LucideIcon }[] = [
    { href: '#overview', label: t.nav.overview, icon: SECTION_ICONS.overview },
    { href: '/analytics', label: t.nav.analytics, icon: SECTION_ICONS.analytics },
    { href: '#repositories', label: t.nav.repositories, icon: SECTION_ICONS.repositories },
    { href: '#projects', label: t.nav.projects, icon: SECTION_ICONS.projects },
    { href: '#work', label: t.nav.rangeWork, icon: SECTION_ICONS.work },
    { href: '#coverage', label: t.nav.coverage, icon: SECTION_ICONS.coverage },
  ]

  return (
    <SidebarMenu>
      {links.map(({ href, label, icon: Icon }) => (
        <SidebarMenuItem key={href}>
          <SidebarMenuButton asChild tooltip={label}>
            <a
              href={href}
              onClick={() => {
                if (isMobile) setOpenMobile(false)
              }}
            >
              <Icon />
              <span>{label}</span>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

export function AppSidebar({
  data,
  selectedProjects,
  onProjectsChange,
}: {
  data: DashboardData
  selectedProjects: number[]
  onProjectsChange: (next: number[]) => void
}) {
  const { summary } = data
  const { t } = useI18n()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <BrandLogo className="size-5 shrink-0 text-foreground" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-semibold tracking-tight">CodxGit</div>
            <div className="text-sidebar-foreground/70 truncate text-xs">
              {t.common.subtitle}
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-hidden">
        <SidebarGroup>
          <SidebarGroupLabel>{t.nav.overview}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarNav />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>{t.filters.projectsOptional}</SidebarGroupLabel>
          <SidebarGroupContent>
            <ProjectFilter
              projects={summary.projects.all}
              involved={summary.projects.involved}
              selected={selectedProjects}
              onChange={onProjectsChange}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-1">
        <div className="min-w-0 px-2 py-1 group-data-[collapsible=icon]:hidden">
          <div className="truncate text-sm font-medium">
            {data.identity ? `@${data.identity.login}` : t.common.noIdentity}
          </div>
          <div className="text-sidebar-foreground/70 truncate text-xs">{data.organization}</div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

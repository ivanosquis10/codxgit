import { FolderKanban } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import type { ProjectRef } from '@/lib/types'

/**
 * Optional, secondary Project filter for the sidebar.
 *
 * Projects the account is personally involved in are listed first, so the ones
 * that can actually produce rows are the quickest to reach. Selecting a Project
 * narrows the view in addition to the repository filter.
 *
 * Like the repository filter, the list is potentially long, so it lives in a
 * bounded, portaled dropdown that keeps the sidebar itself scroll-free.
 */
export function ProjectFilter({
  projects,
  involved,
  selected,
  onChange,
}: {
  projects: ProjectRef[]
  involved: number[]
  selected: number[]
  onChange: (next: number[]) => void
}) {
  const { state, isMobile } = useSidebar()
  const { t } = useI18n()

  function toggle(number: number) {
    onChange(
      selected.includes(number)
        ? selected.filter((value) => value !== number)
        : [...selected, number],
    )
  }

  const ordered = projects
    .slice()
    .sort((a, b) => {
      const aInvolved = involved.includes(a.number) ? 0 : 1
      const bInvolved = involved.includes(b.number) ? 0 : 1
      return aInvolved - bInvolved || a.number - b.number
    })

  const single = selected.length === 1 ? ordered.find((p) => p.number === selected[0]) : undefined
  const current =
    selected.length === 0
      ? t.filters.allProjects
      : single
        ? `${single.title} (#${single.number})`
        : `${selected.length} ${t.filters.projects}`

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          {/* Tooltip and menu share one trigger: the tooltip names the control
              when the sidebar collapses to icons, while the menu owns selection. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  isActive={selected.length > 0}
                  aria-label={`${t.filters.projects}: ${current}`}
                >
                  <FolderKanban />
                  <span className="truncate">{current}</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              align="center"
              hidden={state !== 'collapsed' || isMobile}
            >
              {t.filters.projects} · {current}
            </TooltipContent>
          </Tooltip>

          <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-64">
            <DropdownMenuLabel className="flex items-center justify-between gap-2">
              <span>{t.filters.projectsOptional}</span>
              <span className="text-muted-foreground text-xs font-normal">
                {selected.length === 0 ? t.filters.all : `${selected.length} ${t.filters.selected}`}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={selected.length === 0}
              onCheckedChange={(checked) => {
                if (checked) onChange([])
              }}
              onSelect={(event) => event.preventDefault()}
            >
              {t.filters.allProjects}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {ordered.map((project) => (
              <DropdownMenuCheckboxItem
                key={project.number}
                checked={selected.includes(project.number)}
                title={`${project.title} (#${project.number})`}
                onCheckedChange={() => toggle(project.number)}
                onSelect={(event) => event.preventDefault()}
              >
                <span className="min-w-0 truncate">{project.title}</span>
                <DropdownMenuShortcut className="flex items-center gap-1.5">
                  {involved.includes(project.number) ? (
                    <span className="bg-sidebar-primary size-1.5 rounded-full" aria-hidden />
                  ) : null}
                  #{project.number}
                </DropdownMenuShortcut>
              </DropdownMenuCheckboxItem>
            ))}
            {ordered.length === 0 ? (
              <div className="text-muted-foreground px-2 py-1.5 text-xs">
                {t.filters.emptyProjects}
              </div>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DATE_RANGE_PRESET_LABELS,
  DATE_RANGE_PRESETS,
  type DateRange,
  type DateRangePreset,
} from '@/lib/types'
import { useI18n } from '@/i18n'
import { serializeRangePreset } from '@/lib/query'
import { adjacentWeekAnchor, canNavigateNextWeek, getRange, localIsoDate } from '@/lib/week'

/**
 * Date-range control: one button per preset plus week navigation.
 *
 * Previous/Next only appear for the week presets, because a rolling range is
 * always anchored on today. Moving by a week keeps the selected week preset but
 * anchors it explicitly, so the URL (and browser back/forward) preserves the
 * exact range.
 *
 * Every preset link carries the local date it rendered on. A rolling range is
 * recomputed from "today" on each visit, so a preset link with no anchor would
 * slide its window forward when the user revisits a bookmark or shared URL.
 * The captured date is what keeps the selected period frozen to that day.
 */
export function RangeNav({ range }: { range: DateRange }) {
  const { t } = useI18n()
  const isWeekPreset = range.preset === 'this-week' || range.preset === 'last-week'
  const now = new Date()
  // The local date this render is anchored on. Every preset link emits it, so
  // the selected period stays frozen to that day when the link is revisited;
  // Next still reads it to stop at the newest navigable week.
  const todayDate = localIsoDate(now, range.timeZone)
  const previousAnchor = adjacentWeekAnchor(range, 'previous')
  const nextAnchor = adjacentWeekAnchor(range, 'next')
  // The current week is the newest navigable one, so Next stops once the next
  // displayed Monday would pass today's local Monday.
  const canGoNext = canNavigateNextWeek(range, now)

  function getPresetName(preset: DateRangePreset): string {
    switch (preset) {
      case 'this-week':
        return t.time.presets.thisWeek
      case 'last-week':
        return t.time.presets.lastWeek
      case 'last-15-days':
        return t.time.presets.trailing15
      case 'last-30-days':
        return t.time.presets.trailing30
      case 'one-month':
        return t.time.presets.month1
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {DATE_RANGE_PRESETS.map((preset) => {
        const natural = getRange(preset, now, range.timeZone)
        const active = natural.startDate === range.startDate && natural.endDate === range.endDate
        return (
          <Button key={preset} asChild variant={active ? 'default' : 'outline'} size="sm">
            <Link
              to="/"
              search={(previous) => ({
                week: todayDate,
                preset: serializeRangePreset(preset, todayDate),
                projects: previous.projects,
                repos: previous.repos,
                demo: previous.demo,
              })}
            >
              {getPresetName(preset)}
            </Link>
          </Button>
        )
      })}
      {isWeekPreset ? (
        <>
          <Button asChild variant="outline" size="sm">
            <Link
              to="/"
              search={(previous) => ({
                week: previousAnchor,
                preset: previous.preset,
                projects: previous.projects,
                repos: previous.repos,
                demo: previous.demo,
              })}
            >
              <ChevronLeft className="size-4" />
              {t.time.prevWeek}
            </Link>
          </Button>
          {canGoNext && nextAnchor ? (
            <Button asChild variant="outline" size="sm">
              <Link
                to="/"
                search={(previous) => ({
                  week: nextAnchor,
                  preset: previous.preset,
                  projects: previous.projects,
                  repos: previous.repos,
                  demo: previous.demo,
                })}
              >
                {t.time.nextWeek}
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              {t.time.nextWeek}
              <ChevronRight className="size-4" />
            </Button>
          )}
        </>
      ) : null}
      <div className="ml-1 min-w-40">
        <div className="text-sm font-medium">{range.label}</div>
        <div className="text-muted-foreground text-xs">
          {getPresetName(range.preset)} · {range.timeZone}
        </div>
      </div>
    </div>
  )
}

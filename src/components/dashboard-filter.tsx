import { Calendar } from 'lucide-react'

import { RangeNav } from '@/components/week-nav'
import { useI18n } from '@/i18n'
import type { DateRange } from '@/lib/types'

export function DashboardFilter({
  range,
  to = '/',
}: {
  range: DateRange
  to?: '/' | '/analytics'
}) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-xs sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Calendar className="size-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{t.time.activePeriod}</h2>
          <p className="text-muted-foreground text-xs">{t.time.filterDescription}</p>
        </div>
      </div>
      <RangeNav range={range} to={to} />
    </div>
  )
}

import type { DateRange, DateRangePreset } from './types'

const MS_PER_DAY = 86_400_000
const DAYS_IN_WEEK = 7
const FRIDAY_OFFSET = 4

type LocalParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** UTC calendar date of a `Date`, as `YYYY-MM-DD`. */
function toIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function parseIsoDate(date: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) throw new Error(`Invalid ISO date: ${date}`)
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

/** The wall-clock parts of an instant as seen in `timeZone`. */
function localParts(date: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  }
}

/** Offset in milliseconds between `timeZone` wall time and UTC at `date`. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = localParts(date, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** Convert a wall-clock time in `timeZone` into the matching UTC instant. */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  const offset = timeZoneOffsetMs(new Date(utcGuess), timeZone)
  let timestamp = utcGuess - offset
  const refined = timeZoneOffsetMs(new Date(timestamp), timeZone)
  if (refined !== offset) timestamp = utcGuess - refined
  return new Date(timestamp)
}

/** Shift a `YYYY-MM-DD` calendar date by whole days without timezone drift. */
export function shiftIsoDate(date: string, days: number): string {
  const { year, month, day } = parseIsoDate(date)
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * MS_PER_DAY)
  return toIsoDate(shifted)
}

/** The local calendar date (`YYYY-MM-DD`) of an instant in `timeZone`. */
export function localIsoDate(date: Date, timeZone: string): string {
  const parts = localParts(date, timeZone)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

/** The Monday `YYYY-MM-DD` of the local week that contains `date`. */
function mondayOf(date: string): string {
  const { year, month, day } = parseIsoDate(date)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay() // 0 = Sunday
  const daysSinceMonday = (weekday + 6) % DAYS_IN_WEEK
  return shiftIsoDate(date, -daysSinceMonday)
}

/**
 * Shift a `YYYY-MM-DD` date by whole months, clamping the day to the last
 * valid day of the target month (March 31 → February 28/29, January 31 →
 * December 31).
 */
export function shiftMonthClamped(date: string, months: number): string {
  const { year, month, day } = parseIsoDate(date)
  const totalMonths = year * 12 + (month - 1) + months
  const targetYear = Math.floor(totalMonths / 12)
  const targetMonth = (((totalMonths % 12) + 12) % 12) + 1
  const lastDayOfMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
  return `${targetYear}-${pad(targetMonth)}-${pad(Math.min(day, lastDayOfMonth))}`
}

const LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function formatLabel(startDate: string, endDate: string): string {
  const start = parseIsoDate(startDate)
  const end = parseIsoDate(endDate)
  return `${LABEL_FORMATTER.format(new Date(Date.UTC(start.year, start.month - 1, start.day)))} – ${LABEL_FORMATTER.format(
    new Date(Date.UTC(end.year, end.month - 1, end.day)),
  )}`
}

/** Build a range from inclusive local calendar dates, converting both edges to instants. */
function rangeFromDates(
  startDate: string,
  endDate: string,
  timeZone: string,
  preset: DateRangePreset,
): DateRange {
  const start = parseIsoDate(startDate)
  const end = parseIsoDate(endDate)
  const startInstant = zonedTimeToUtc(start.year, start.month, start.day, 0, 0, 0, 0, timeZone)
  const endInstant = zonedTimeToUtc(end.year, end.month, end.day, 23, 59, 59, 999, timeZone)

  const range: DateRange = {
    timeZone,
    preset,
    startDate,
    endDate,
    startIso: startInstant.toISOString(),
    endIso: endInstant.toISOString(),
    label: formatLabel(startDate, endDate),
  }

  // The week presets are the only ones that expose a Monday and a Friday.
  if (preset === 'this-week' || preset === 'last-week') {
    range.mondayDate = startDate
    range.fridayDate = endDate
  }

  return range
}

/** Build a Monday–Friday range that contains `anchorDate`, which may be any day of the week. */
function weekRange(anchorDate: string, timeZone: string, preset: DateRangePreset): DateRange {
  const mondayDate = mondayOf(anchorDate)
  return rangeFromDates(mondayDate, shiftIsoDate(mondayDate, FRIDAY_OFFSET), timeZone, preset)
}

/**
 * Resolve the date range for a preset.
 *
 * Every boundary is a local calendar boundary in `timeZone`: the range starts
 * at local midnight of `startDate` and ends at the last instant of `endDate`,
 * so it includes today. Rolling presets are anchored on the anchor's local
 * date, never its UTC date.
 */
export function getRange(preset: DateRangePreset, anchor: Date, timeZone: string): DateRange {
  const anchorDate = localIsoDate(anchor, timeZone)

  switch (preset) {
    case 'this-week':
      return weekRange(anchorDate, timeZone, preset)
    case 'last-week':
      return weekRange(shiftIsoDate(anchorDate, -DAYS_IN_WEEK), timeZone, preset)
    case 'last-15-days':
      return rangeFromDates(shiftIsoDate(anchorDate, -14), anchorDate, timeZone, preset)
    case 'last-30-days':
      return rangeFromDates(shiftIsoDate(anchorDate, -29), anchorDate, timeZone, preset)
    case 'one-month':
      return rangeFromDates(shiftMonthClamped(anchorDate, -1), anchorDate, timeZone, preset)
  }
}

/** Resolve the Monday–Friday window that contains `anchor` in `timeZone`. */
export function getWeekRange(anchor: Date, timeZone: string): DateRange {
  return getRange('this-week', anchor, timeZone)
}

/** True for the two presets that expose a Monday–Friday window. */
function isWeekPreset(preset: DateRangePreset): boolean {
  return preset === 'this-week' || preset === 'last-week'
}

/**
 * The `week` anchor that resolves to the week adjacent to `range`.
 *
 * The week presets differ in how `getRange` reads its anchor: `this-week`
 * contains the anchor's own Monday, while `last-week` subtracts a week first.
 * The anchor is therefore compensated per preset so that following the link
 * moves the displayed window by exactly seven calendar days. Returns
 * `undefined` for a rolling preset, which has no week to step through.
 */
export function adjacentWeekAnchor(
  range: DateRange,
  direction: 'previous' | 'next',
): string | undefined {
  if (!isWeekPreset(range.preset) || !range.mondayDate) return undefined

  const step = direction === 'previous' ? -DAYS_IN_WEEK : DAYS_IN_WEEK
  // `last-week` already subtracts a week from its anchor, so Previous hands
  // back the displayed Monday and Next leads it by two weeks.
  const offset = range.preset === 'last-week' ? step + DAYS_IN_WEEK : step
  return shiftIsoDate(range.mondayDate, offset)
}

/**
 * Whether Next may advance the displayed week.
 *
 * The newest navigable window is the local week that contains `today`, so Next
 * is allowed only while the next displayed Monday is at or before today's
 * local Monday. Comparing Mondays, not the range end, keeps Next disabled for
 * the current week on the weekend while still letting a past week step forward
 * to today's week.
 */
export function canNavigateNextWeek(range: DateRange, today: Date): boolean {
  if (!isWeekPreset(range.preset) || !range.mondayDate) return false
  const targetMonday = shiftIsoDate(range.mondayDate, DAYS_IN_WEEK)
  const todayMonday = mondayOf(localIsoDate(today, range.timeZone))
  return targetMonday <= todayMonday
}

/** Inclusive membership test for an ISO-8601 instant against a range. */
export function isWithinRange(iso: string, range: DateRange): boolean {
  const timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) return false
  return timestamp >= Date.parse(range.startIso) && timestamp <= Date.parse(range.endIso)
}

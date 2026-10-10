import { describe, expect, it } from 'vitest'
import type { DateRange } from '@/lib/types'
import {
  adjacentWeekAnchor,
  canNavigateNextWeek,
  getRange,
  getWeekRange,
  isWithinRange,
  shiftIsoDate,
} from '@/lib/week'

const CARACAS = 'America/Caracas'
const NEW_YORK = 'America/New_York'
const ANCHOR = new Date('2026-10-05T19:34:47Z')

describe('getWeekRange', () => {
  it('resolves a Monday-Friday window with explicit inclusive instants', () => {
    const range = getWeekRange(new Date('2026-10-05T19:34:47Z'), CARACAS)
    expect(range.mondayDate).toBe('2026-10-05')
    expect(range.fridayDate).toBe('2026-10-09')
    expect(range.startIso).toBe('2026-10-05T04:00:00.000Z')
    expect(range.endIso).toBe('2026-10-10T03:59:59.999Z')
    expect(range.timeZone).toBe(CARACAS)
  })

  it('keeps a late-Friday local instant in the week that just ended', () => {
    // Saturday 2026-10-10 00:00 local (UTC-4) is still Friday's week.
    const range = getWeekRange(new Date('2026-10-10T04:00:00Z'), CARACAS)
    expect(range.mondayDate).toBe('2026-10-05')
    expect(range.fridayDate).toBe('2026-10-09')
  })

  it('treats local Monday 00:00 as the start of the new week', () => {
    expect(getWeekRange(new Date('2026-10-12T03:30:00Z'), CARACAS).mondayDate).toBe('2026-10-05')
    expect(getWeekRange(new Date('2026-10-12T04:00:00Z'), CARACAS).mondayDate).toBe('2026-10-12')
  })

  it('honors the requested timezone instead of the host timezone', () => {
    const range = getWeekRange(new Date('2026-10-05T19:34:47Z'), 'UTC')
    expect(range.mondayDate).toBe('2026-10-05')
    expect(range.startIso).toBe('2026-10-05T00:00:00.000Z')
    expect(range.endIso).toBe('2026-10-09T23:59:59.999Z')
  })

  it('handles a week that spans a month boundary', () => {
    const range = getWeekRange(new Date('2026-10-01T15:00:00Z'), CARACAS)
    expect(range.mondayDate).toBe('2026-09-28')
    expect(range.fridayDate).toBe('2026-10-02')
  })
})

describe('getRange rolling presets', () => {
  it('defaults to the trailing 30 local calendar dates including today', () => {
    const range = getRange('last-30-days', ANCHOR, CARACAS)
    expect(range.preset).toBe('last-30-days')
    expect(range.startDate).toBe('2026-09-06')
    expect(range.endDate).toBe('2026-10-05')
    expect(range.startIso).toBe('2026-09-06T04:00:00.000Z')
    expect(range.endIso).toBe('2026-10-06T03:59:59.999Z')
    // Rolling ranges carry no week fields.
    expect(range.mondayDate).toBeUndefined()
    expect(range.fridayDate).toBeUndefined()
  })

  it('resolves the trailing 15 local calendar dates including today', () => {
    const range = getRange('last-15-days', ANCHOR, CARACAS)
    expect(range.startDate).toBe('2026-09-21')
    expect(range.endDate).toBe('2026-10-05')
    expect(range.startIso).toBe('2026-09-21T04:00:00.000Z')
    expect(range.endIso).toBe('2026-10-06T03:59:59.999Z')
  })

  it('resolves this week and last week as Monday-Friday', () => {
    const thisWeek = getRange('this-week', ANCHOR, CARACAS)
    expect(thisWeek).toMatchObject({
      preset: 'this-week',
      startDate: '2026-10-05',
      endDate: '2026-10-09',
      mondayDate: '2026-10-05',
      fridayDate: '2026-10-09',
    })
    const lastWeek = getRange('last-week', ANCHOR, CARACAS)
    expect(lastWeek).toMatchObject({
      preset: 'last-week',
      startDate: '2026-09-28',
      endDate: '2026-10-02',
      mondayDate: '2026-09-28',
      fridayDate: '2026-10-02',
    })
  })

  it('anchors rolling ranges on the local date, not the UTC date', () => {
    // 2026-10-06T02:00Z is still 2026-10-05 22:00 in Caracas (UTC-4).
    const range = getRange('last-30-days', new Date('2026-10-06T02:00:00Z'), CARACAS)
    expect(range.endDate).toBe('2026-10-05')
    expect(range.endIso).toBe('2026-10-06T03:59:59.999Z')
  })
})

describe('getRange one-month lookback', () => {
  it('clamps to the last valid day of a shorter prior month', () => {
    const range = getRange('one-month', new Date('2026-03-31T15:00:00Z'), CARACAS)
    expect(range.startDate).toBe('2026-02-28')
    expect(range.endDate).toBe('2026-03-31')
  })

  it('clamps to February 29 in a leap year', () => {
    const range = getRange('one-month', new Date('2024-03-31T15:00:00Z'), CARACAS)
    expect(range.startDate).toBe('2024-02-29')
    expect(range.endDate).toBe('2024-03-31')
  })

  it('preserves the day when the prior month is long enough', () => {
    const range = getRange('one-month', new Date('2026-03-15T15:00:00Z'), CARACAS)
    expect(range.startDate).toBe('2026-02-15')
    expect(range.endDate).toBe('2026-03-15')
  })

  it('crosses a year boundary deterministically', () => {
    const range = getRange('one-month', new Date('2026-01-31T15:00:00Z'), CARACAS)
    expect(range.startDate).toBe('2025-12-31')
    expect(range.endDate).toBe('2026-01-31')
  })
})

describe('getRange local timezone and DST', () => {
  it('uses local midnight and end-of-day instants across a spring-forward', () => {
    const range = getRange('last-15-days', new Date('2026-03-09T16:00:00Z'), NEW_YORK)
    expect(range.startDate).toBe('2026-02-23')
    expect(range.endDate).toBe('2026-03-09')
    // EST (UTC-5) at the start; EDT (UTC-4) after 2026-03-08.
    expect(range.startIso).toBe('2026-02-23T05:00:00.000Z')
    expect(range.endIso).toBe('2026-03-10T03:59:59.999Z')
  })

  it('keeps a week boundary stable across a fall-back', () => {
    const range = getWeekRange(new Date('2026-11-02T16:00:00Z'), NEW_YORK)
    expect(range.mondayDate).toBe('2026-11-02')
    expect(range.fridayDate).toBe('2026-11-06')
    expect(range.startIso).toBe('2026-11-02T05:00:00.000Z')
    expect(range.endIso).toBe('2026-11-07T04:59:59.999Z')
  })
})

describe('isWithinRange', () => {
  it('includes the exact start and end instants of an explicit range', () => {
    const range = getRange('last-30-days', ANCHOR, CARACAS)
    expect(isWithinRange(range.startIso, range)).toBe(true)
    expect(isWithinRange(range.endIso, range)).toBe(true)
  })

  it('excludes instants just outside an explicit range', () => {
    const range = getRange('last-30-days', ANCHOR, CARACAS)
    expect(isWithinRange('2026-09-06T03:59:59.999Z', range)).toBe(false)
    expect(isWithinRange('2026-10-06T04:00:00.000Z', range)).toBe(false)
  })
})

describe('shiftIsoDate', () => {
  it('adds calendar days without timezone drift', () => {
    expect(shiftIsoDate('2026-10-09', 7)).toBe('2026-10-16')
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftIsoDate('2026-01-01', -1)).toBe('2025-12-31')
  })
})

/** Resolve `getRange` from a bare `YYYY-MM-DD` anchor, as the URL does. */
function rangeAt(preset: DateRange['preset'], anchorDate: string): DateRange {
  return getRange(preset, new Date(`${anchorDate}T12:00:00.000Z`), CARACAS)
}

describe('adjacentWeekAnchor', () => {
  it('steps this-week by exactly one week in each direction', () => {
    const range = getRange('this-week', ANCHOR, CARACAS)
    expect(range.mondayDate).toBe('2026-10-05')
    expect(adjacentWeekAnchor(range, 'previous')).toBe('2026-09-28')
    expect(adjacentWeekAnchor(range, 'next')).toBe('2026-10-12')
  })

  it('compensates for the last-week resolver offsetting a week itself', () => {
    const range = getRange('last-week', ANCHOR, CARACAS)
    expect(range.mondayDate).toBe('2026-09-28')
    // The resolver subtracts a week, so Previous must hand back the displayed
    // Monday and Next must skip two weeks ahead of it.
    expect(adjacentWeekAnchor(range, 'previous')).toBe('2026-09-28')
    expect(adjacentWeekAnchor(range, 'next')).toBe('2026-10-12')
  })

  it('moves the resolved week start by exactly seven days when followed (this-week)', () => {
    const range = getRange('this-week', ANCHOR, CARACAS)
    const previous = rangeAt('this-week', adjacentWeekAnchor(range, 'previous') as string)
    const next = rangeAt('this-week', adjacentWeekAnchor(range, 'next') as string)
    expect(previous.mondayDate).toBe('2026-09-28')
    expect(next.mondayDate).toBe('2026-10-12')
    expect(shiftIsoDate(range.mondayDate as string, -7)).toBe(previous.mondayDate)
    expect(shiftIsoDate(range.mondayDate as string, 7)).toBe(next.mondayDate)
  })

  it('moves the resolved week start by exactly seven days when followed (last-week)', () => {
    const range = getRange('last-week', ANCHOR, CARACAS)
    const previous = rangeAt('last-week', adjacentWeekAnchor(range, 'previous') as string)
    const next = rangeAt('last-week', adjacentWeekAnchor(range, 'next') as string)
    expect(previous.mondayDate).toBe('2026-09-21')
    expect(next.mondayDate).toBe('2026-10-05')
    expect(shiftIsoDate(range.mondayDate as string, -7)).toBe(previous.mondayDate)
    expect(shiftIsoDate(range.mondayDate as string, 7)).toBe(next.mondayDate)
  })

  it('has no adjacent anchor for a rolling preset', () => {
    const range = getRange('last-30-days', ANCHOR, CARACAS)
    expect(adjacentWeekAnchor(range, 'previous')).toBeUndefined()
    expect(adjacentWeekAnchor(range, 'next')).toBeUndefined()
  })
})

describe('canNavigateNextWeek', () => {
  it('disables Next for the current week on Saturday', () => {
    // Saturday 2026-10-10 15:34 local (UTC-4): the current week is 2026-10-05,
    // still displayed on the weekend, but the next target Monday is future.
    const saturday = new Date('2026-10-10T19:34:47Z')
    const range = getRange('this-week', saturday, CARACAS)
    expect(range.mondayDate).toBe('2026-10-05')
    expect(canNavigateNextWeek(range, saturday)).toBe(false)
  })

  it('enables Next when last week can advance to the current week', () => {
    const range = getRange('last-week', ANCHOR, CARACAS)
    expect(range.mondayDate).toBe('2026-09-28')
    expect(canNavigateNextWeek(range, ANCHOR)).toBe(true)
  })

  it('enables Next for an older displayed week and blocks a future one', () => {
    const older = rangeAt('this-week', '2026-09-28')
    const future = rangeAt('this-week', '2026-10-12')
    expect(canNavigateNextWeek(older, ANCHOR)).toBe(true)
    expect(canNavigateNextWeek(future, ANCHOR)).toBe(false)
  })
})

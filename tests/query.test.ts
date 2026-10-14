import { describe, expect, it } from 'vitest'
import { DATE_RANGE_PRESETS, DEFAULT_RANGE_PRESET } from '@/lib/types'
import {
  parseAnchorParam,
  parseProjectList,
  parseRangePreset,
  parseRepoList,
  serializeProjectList,
  serializeRangePreset,
  serializeRepoList,
} from '@/lib/query'

describe('parseAnchorParam', () => {
  it('accepts a YYYY-MM-DD anchor and rejects everything else', () => {
    expect(parseAnchorParam('2026-10-05')).toBe('2026-10-05')
    expect(parseAnchorParam('tomorrow')).toBeUndefined()
    expect(parseAnchorParam(20261005)).toBeUndefined()
    expect(parseAnchorParam(undefined)).toBeUndefined()
  })
})

describe('range preset params', () => {
  it('accepts only known presets and rejects everything else', () => {
    for (const preset of DATE_RANGE_PRESETS) {
      expect(parseRangePreset(preset)).toBe(preset)
    }
    expect(parseRangePreset('last-180-days')).toBeUndefined()
    expect(parseRangePreset(undefined)).toBeUndefined()
    expect(parseRangePreset(30)).toBeUndefined()
    expect(DEFAULT_RANGE_PRESET).toBe('last-30-days')
  })

  it('round-trips a preset through the URL form and omits the default', () => {
    expect(serializeRangePreset('last-30-days')).toBeUndefined()
    expect(serializeRangePreset('last-15-days')).toBe('last-15-days')
    expect(parseRangePreset(serializeRangePreset('one-month'))).toBe('one-month')
    expect(parseRangePreset(serializeRangePreset(undefined) ?? DEFAULT_RANGE_PRESET)).toBe(
      'last-30-days',
    )
  })

  it('keeps the default preset explicit beside a date anchor', () => {
    // An anchor without a preset reads as the historical Monday-Friday week, so
    // a preset button that encodes a date must not drop the default preset.
    expect(serializeRangePreset('last-30-days', '2026-10-05')).toBe('last-30-days')
    expect(serializeRangePreset('last-15-days', '2026-10-05')).toBe('last-15-days')
    expect(serializeRangePreset(undefined, '2026-10-05')).toBeUndefined()
  })
})

describe('project list params', () => {
  it('round-trips through a URL-safe p-prefixed form', () => {
    expect(serializeProjectList([10])).toBe('p10')
    expect(serializeProjectList([11, 10])).toBe('p10,p11')
    expect(serializeProjectList([])).toBeUndefined()
    expect(parseProjectList('p10,p11')).toEqual([10, 11])
    expect(parseProjectList(serializeProjectList([12, 10]))).toEqual([10, 12])
  })

  it('stays a plain non-numeric string so the router never coerces or redirects it', () => {
    const serialized = serializeProjectList([10])
    expect(typeof serialized).toBe('string')
    expect(serialized).not.toBe('10')
    expect(Number(serialized)).toBeNaN()
  })

  it('tolerates plain numbers, repeated params and junk', () => {
    expect(parseProjectList('10,11')).toEqual([10, 11])
    expect(parseProjectList(10)).toEqual([10])
    expect(parseProjectList(['p10', 'p11'])).toEqual([10, 11])
    expect(parseProjectList('p10,p10,p11')).toEqual([10, 11])
    expect(parseProjectList('nope')).toEqual([])
    expect(parseProjectList('-3')).toEqual([])
    expect(parseProjectList(undefined)).toEqual([])
  })
})

describe('repository list params', () => {
  it('round-trips through a comma-separated owner/name form', () => {
    expect(parseRepoList('acme/api,acme/web')).toEqual(['acme/api', 'acme/web'])
    expect(parseRepoList(serializeRepoList(['acme/web', 'acme/api']))).toEqual([
      'acme/api',
      'acme/web',
    ])
    expect(serializeRepoList([])).toBeUndefined()
  })

  it('dedupes and sorts by owner then name deterministically', () => {
    expect(serializeRepoList(['z/web', 'acme/web', 'acme/api', 'ACME/API'])).toBe(
      'acme/api,acme/web,z/web',
    )
    expect(parseRepoList(['acme/api,acme/api', 'acme/web'])).toEqual(['acme/api', 'acme/web'])
  })

  it('rejects path and traversal shaped values', () => {
    expect(parseRepoList('../etc/passwd')).toEqual([])
    expect(parseRepoList('acme/../../etc')).toEqual([])
    expect(parseRepoList('acme/api/extra')).toEqual([])
    expect(parseRepoList('/acme/api')).toEqual([])
    expect(parseRepoList('acme/')).toEqual([])
    expect(parseRepoList('acme\api')).toEqual([])
    expect(parseRepoList('acme/..')).toEqual([])
    expect(parseRepoList('acme api')).toEqual([])
    expect(parseRepoList(undefined)).toEqual([])
  })

  it('tolerates repeated params and mixed junk', () => {
    expect(parseRepoList(['acme/api', 'acme/web'])).toEqual(['acme/api', 'acme/web'])
    expect(parseRepoList('acme/api,,nope,acme/web')).toEqual(['acme/api', 'acme/web'])
  })
})

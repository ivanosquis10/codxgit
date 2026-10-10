import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  SUPPORTED_LOCALES,
  en,
  es,
  isLocale,
  parseLocaleCookie,
  translations,
} from '@/i18n'
import { resolveLocaleFromCookie } from '@/server/i18n.server'

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...collectKeys(value as Record<string, unknown>, fullPath))
    } else {
      keys.push(fullPath)
    }
  }
  return keys.sort()
}

function collectLeaves(obj: Record<string, unknown>, prefix = ''): Array<{ path: string; value: unknown }> {
  const leaves: Array<{ path: string; value: unknown }> = []
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      leaves.push(...collectLeaves(value as Record<string, unknown>, fullPath))
    } else {
      leaves.push({ path: fullPath, value })
    }
  }
  return leaves
}

describe('i18n dictionary parity and completeness', () => {
  it('has identical keys in English and Spanish dictionaries', () => {
    const enKeys = collectKeys(en as unknown as Record<string, unknown>)
    const esKeys = collectKeys(es as unknown as Record<string, unknown>)

    expect(enKeys).toEqual(esKeys)
    expect(enKeys.length).toBeGreaterThan(40)
  })

  it('contains non-empty strings for all leaf values in en', () => {
    const enLeaves = collectLeaves(en as unknown as Record<string, unknown>)
    for (const leaf of enLeaves) {
      expect(typeof leaf.value, `Expected leaf ${leaf.path} to be string in en`).toBe('string')
      expect((leaf.value as string).trim().length, `Leaf ${leaf.path} is empty in en`).toBeGreaterThan(0)
    }
  })

  it('contains non-empty strings for all leaf values in es', () => {
    const esLeaves = collectLeaves(es as unknown as Record<string, unknown>)
    for (const leaf of esLeaves) {
      expect(typeof leaf.value, `Expected leaf ${leaf.path} to be string in es`).toBe('string')
      expect((leaf.value as string).trim().length, `Leaf ${leaf.path} is empty in es`).toBeGreaterThan(0)
    }
  })

  it('provides translations for both supported locales in registry', () => {
    expect(translations.en).toBeDefined()
    expect(translations.es).toBeDefined()
    expect(SUPPORTED_LOCALES).toContain('en')
    expect(SUPPORTED_LOCALES).toContain('es')
  })

  it('validates supported locales with isLocale', () => {
    expect(isLocale('en')).toBe(true)
    expect(isLocale('es')).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(isLocale(null)).toBe(false)
    expect(isLocale(undefined)).toBe(false)
    expect(isLocale(123)).toBe(false)
  })

  it('contains all required top-level domains', () => {
    const domains = [
      'common',
      'nav',
      'time',
      'filters',
      'metrics',
      'breakdowns',
      'workSections',
      'coverage',
      'notices',
      'language',
      'theme',
    ] as const

    for (const domain of domains) {
      expect(en).toHaveProperty(domain)
      expect(es).toHaveProperty(domain)
    }
  })

  it('contains expected core strings across presets, notices and metrics', () => {
    expect(en.time.presets.trailing30).toBe('Last 30 days')
    expect(es.time.presets.trailing30).toBe('Últimos 30 días')
    expect(en.time.presets.trailing15).toBe('Last 15 days')
    expect(es.time.presets.trailing15).toBe('Últimos 15 días')
    expect(en.time.presets.month1).toBe('1 month')
    expect(es.time.presets.month1).toBe('1 mes')
    expect(en.time.presets.thisWeek).toBe('This week')
    expect(es.time.presets.thisWeek).toBe('Esta semana')
    expect(en.time.presets.lastWeek).toBe('Last week')
    expect(es.time.presets.lastWeek).toBe('Semana pasada')

    expect(en.time.prevWeek).toBe('Previous')
    expect(es.time.prevWeek).toBe('Anterior')
    expect(en.time.nextWeek).toBe('Next')
    expect(es.time.nextWeek).toBe('Siguiente')

    expect(en.language.switchToEs).toBe('Switch to Spanish')
    expect(es.language.switchToEn).toBe('Cambiar a inglés')
  })
})

describe('cookie parsing and defaults', () => {
  it('returns DEFAULT_LOCALE when cookie string is empty or absent', () => {
    expect(parseLocaleCookie()).toBe(DEFAULT_LOCALE)
    expect(parseLocaleCookie(null)).toBe(DEFAULT_LOCALE)
    expect(parseLocaleCookie('')).toBe(DEFAULT_LOCALE)
  })

  it('correctly parses es from standalone cookie', () => {
    expect(parseLocaleCookie(`${LOCALE_COOKIE_NAME}=es`)).toBe('es')
  })

  it('correctly parses en from standalone cookie', () => {
    expect(parseLocaleCookie(`${LOCALE_COOKIE_NAME}=en`)).toBe('en')
  })

  it('extracts locale from complex Cookie header with multiple cookies', () => {
    const header = `theme=dark; session=xyz; ${LOCALE_COOKIE_NAME}=es; other=123`
    expect(parseLocaleCookie(header)).toBe('es')

    const headerEn = `theme=dark; ${LOCALE_COOKIE_NAME}=en; other=123`
    expect(parseLocaleCookie(headerEn)).toBe('en')
  })

  it('falls back to default for unsupported or malformed cookie values', () => {
    expect(parseLocaleCookie(`${LOCALE_COOKIE_NAME}=fr`)).toBe(DEFAULT_LOCALE)
    expect(parseLocaleCookie(`${LOCALE_COOKIE_NAME}=`)).toBe(DEFAULT_LOCALE)
    expect(parseLocaleCookie(`${LOCALE_COOKIE_NAME}=es-ES`)).toBe(DEFAULT_LOCALE)
  })

  it('resolveLocaleFromCookie falls back cleanly when invoked outside SSR request context', () => {
    // When called in unit tests without an active HTTP server request
    expect(resolveLocaleFromCookie()).toBe(DEFAULT_LOCALE)
  })
})

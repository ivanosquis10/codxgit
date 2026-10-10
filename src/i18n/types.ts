import type { Translations } from './locales/en'

export type Locale = 'en' | 'es'
export type { Translations }

export const DEFAULT_LOCALE: Locale = 'en'
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'es'] as const
export const LOCALE_COOKIE_NAME = 'codxgit-locale'

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'es'
}

export function parseLocaleCookie(cookieHeader?: string | null): Locale {
  if (!cookieHeader) return DEFAULT_LOCALE
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE_NAME}=([^;]+)`))
  if (match && isLocale(match[1])) {
    return match[1]
  }
  return DEFAULT_LOCALE
}

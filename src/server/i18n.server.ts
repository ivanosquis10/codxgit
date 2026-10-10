import { getCookie } from '@tanstack/react-start/server'
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, type Locale } from '@/i18n/types'

/**
 * Resolves the user's preferred locale from the request cookie `codxgit-locale`.
 * Defaults to 'en' when absent, invalid, or during non-SSR contexts.
 */
export function resolveLocaleFromCookie(): Locale {
  try {
    const raw = getCookie(LOCALE_COOKIE_NAME)
    if (raw === 'es' || raw === 'en') {
      return raw
    }
  } catch {
    // If invoked outside of an active HTTP request context (e.g., CLI or unit tests)
  }
  return DEFAULT_LOCALE
}

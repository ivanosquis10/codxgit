import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en } from './locales/en'
import { es } from './locales/es'
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, type Locale, type Translations } from './types'

export const translations: Record<Locale, Translations> = {
  en,
  es,
}

export type I18nContextValue = {
  locale: Locale
  setLocale: (nextLocale: Locale) => void
  t: Translations
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode
  initialLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  function setLocale(nextLocale: Locale) {
    setLocaleState(nextLocale)
    if (typeof document !== 'undefined') {
      document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`
      document.documentElement.lang = nextLocale
    }
  }

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
    }
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: translations[locale] ?? translations[DEFAULT_LOCALE],
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: translations[DEFAULT_LOCALE],
    }
  }
  return context
}

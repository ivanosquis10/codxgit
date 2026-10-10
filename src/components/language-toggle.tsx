import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

/** Compact language toggle placed in the header next to ThemeToggle. */
export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n()

  function toggleLanguage() {
    setLocale(locale === 'en' ? 'es' : 'en')
  }

  const label = locale === 'en' ? t.language.switchToEs : t.language.switchToEn

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      aria-label={label}
      title={label}
      className="h-8 gap-1 px-2 font-medium"
    >
      <Languages className="size-4" aria-hidden />
      <span className="text-xs font-semibold uppercase">{locale === 'en' ? 'ES' : 'EN'}</span>
    </Button>
  )
}

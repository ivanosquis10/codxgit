import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

type Theme = 'light' | 'dark'

/** Neutral theme toggle. Starts deterministic so SSR and hydration agree. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const { t } = useI18n()

  useEffect(() => {
    const stored =
      window.localStorage.getItem('codxgit-theme') ??
      window.localStorage.getItem('gitpop-theme')
    const initial: Theme =
      stored === 'dark' || stored === 'light'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
    setTheme(initial)
    document.documentElement.classList.toggle('dark', initial === 'dark')
  }, [])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    window.localStorage.setItem('codxgit-theme', next)
  }

  const ariaLabel = theme === 'dark' ? t.theme.switchToLight : t.theme.switchToDark

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleTheme}
      aria-label={ariaLabel}
      title={t.theme.toggleTheme}
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

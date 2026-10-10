import { Info, Sparkles, TriangleAlert } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useI18n } from '@/i18n'
import type { DashboardData } from '@/lib/types'

export function StateNotice({ data, warnings }: { data: DashboardData; warnings: string[] }) {
  const { t } = useI18n()

  if (data.demo) {
    return (
      <Alert>
        <Sparkles />
        <AlertTitle>{t.notices.demoTitle}</AlertTitle>
        <AlertDescription>{t.notices.demoDesc}</AlertDescription>
      </Alert>
    )
  }

  if (data.identityError) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>{t.notices.cliCredsNotice}</AlertTitle>
        <AlertDescription>
          <p>{data.identityError}</p>
          <p>{t.notices.ghPermissionGuidance}</p>
        </AlertDescription>
      </Alert>
    )
  }

  if (warnings.length > 0) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>{t.notices.warningsTitle}</AlertTitle>
        <AlertDescription>
          <ul className="list-disc space-y-1 pl-4">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    )
  }

  if (data.dataState === 'empty') {
    return (
      <Alert>
        <Info />
        <AlertTitle>{t.notices.emptyTitle}</AlertTitle>
        <AlertDescription>
          {t.notices.emptyDescPress} <strong>{t.notices.emptyDescRefresh}</strong>{' '}
          {t.notices.emptyDescSuffix}
        </AlertDescription>
      </Alert>
    )
  }

  return null
}

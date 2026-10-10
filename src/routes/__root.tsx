import type { ReactNode } from 'react'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { I18nProvider, useI18n, type Locale } from '@/i18n'
import { getLocaleServerFn } from '@/server/dashboard.functions'

import appCss from '@/styles/app.css?url'

export const Route = createRootRoute({
  loader: async (): Promise<{ locale: Locale }> => {
    const locale = await getLocaleServerFn()
    return { locale }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'CodxGit — personal GitHub work' },
      {
        name: 'description',
        content:
          'Local-first dashboard for personal GitHub work across repositories: issues, pull requests, commits and GitHub Projects.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
})

function RootComponent() {
  const { locale } = Route.useLoaderData()
  return (
    <I18nProvider initialLocale={locale}>
      <RootDocument>
        <Outlet />
      </RootDocument>
    </I18nProvider>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const { locale } = useI18n()
  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground min-h-dvh antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}

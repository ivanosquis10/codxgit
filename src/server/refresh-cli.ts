import { readServerConfig } from './config.server'
import { refreshDashboardData } from './dashboard.server'

/**
 * Headless refresh, for the first sync or for a scheduled local run.
 *
 * Usage:
 *   npm run refresh
 *   npm run refresh -- 2026-10-05
 *   npm run refresh -- --demo
 */
async function main() {
  const args = process.argv.slice(2)
  const demo = args.includes('--demo')
  const weekStart = args.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg))
  const config = readServerConfig()

  console.log(
    `Reading ${config.organization} with the active gh identity (week anchor: ${weekStart ?? 'current'}).`,
  )

  const result = await refreshDashboardData({ weekStart, demo })
  console.log(`Refreshed at ${result.fetchedAt}`)

  if (result.warnings.length === 0) {
    console.log('No coverage warnings.')
    return
  }

  for (const warning of result.warnings) {
    console.log(`warning: ${warning}`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

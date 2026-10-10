import { resolve } from 'node:path'

export type ServerConfig = {
  organization: string
  timeZone: string
  databasePath: string
  demoEnvEnabled: boolean
}

/**
 * Read configuration per request. Env is never read at module scope, so a
 * server secret can never be inlined into the client bundle.
 */
export function readServerConfig(): ServerConfig {
  return {
    organization: (process.env.CODXGIT_ORG ?? process.env.GITPOP_ORG)?.trim() || 'desarrollo-intelicorps',
    timeZone: (process.env.CODXGIT_TIMEZONE ?? process.env.GITPOP_TIMEZONE)?.trim() || 'America/Caracas',
    databasePath:
      (process.env.CODXGIT_DB_PATH ?? process.env.GITPOP_DB_PATH)?.trim() ||
      resolve(process.cwd(), '.data', 'codxgit.sqlite'),
    demoEnvEnabled: (process.env.CODXGIT_DEMO_MODE ?? process.env.GITPOP_DEMO_MODE) === '1',
  }
}

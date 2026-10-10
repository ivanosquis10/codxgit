import BetterSqlite3 from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import * as schema from './schema'

export type Database = BetterSQLite3Database<typeof schema>

export type DatabaseBundle = {
  sqlite: BetterSqlite3.Database
  db: Database
}

const DEFAULT_DATABASE_FILE = '.data/codxgit.sqlite'

/** Open (or create) a SQLite database file and wrap it with Drizzle. */
export function createDatabase(file: string): DatabaseBundle {
  let target = file
  if (file !== ':memory:') {
    target = isAbsolute(file) ? file : resolve(process.cwd(), file)
    mkdirSync(dirname(target), { recursive: true })
  }
  const sqlite = new BetterSqlite3(target)
  if (file !== ':memory:') sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return { sqlite, db: drizzle(sqlite, { schema }) }
}

function migrationsFolder(): string {
  return (
    process.env.CODXGIT_MIGRATIONS_PATH ??
    process.env.GITPOP_MIGRATIONS_PATH ??
    resolve(process.cwd(), 'drizzle')
  )
}

/** Apply the generated Drizzle migrations to a database handle. */
export function migrateDatabase(db: Database): void {
  migrate(db, { migrationsFolder: migrationsFolder() })
}

let bundle: DatabaseBundle | null = null

/**
 * Lazily open the process-wide database. Env is read per call, never at module
 * scope, so the value cannot be inlined into a client bundle.
 *
 * The database file lives outside source control by default (`.data/`).
 */
export function getDatabase(): DatabaseBundle {
  if (bundle) return bundle
  const file =
    process.env.CODXGIT_DB_PATH ??
    process.env.GITPOP_DB_PATH ??
    resolve(process.cwd(), DEFAULT_DATABASE_FILE)
  bundle = createDatabase(file)
  migrateDatabase(bundle.db)
  return bundle
}

export function resetDatabaseForTests(): void {
  if (bundle) bundle.sqlite.close()
  bundle = null
}

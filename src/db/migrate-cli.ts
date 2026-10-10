import { getDatabase } from './client.server'

/** Apply the generated Drizzle migrations to the configured SQLite file. */
const { db } = getDatabase()
console.log(
  `Migrations applied to ${
    process.env.CODXGIT_DB_PATH ?? process.env.GITPOP_DB_PATH ?? '.data/codxgit.sqlite'
  }`,
)
void db

import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.CODXGIT_DB_PATH ?? process.env.GITPOP_DB_PATH ?? './.data/codxgit.sqlite',
  },
})

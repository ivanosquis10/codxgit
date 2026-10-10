import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Cached GitHub snapshots.
 *
 * Every row is scoped to an account and organization so two identities or two
 * organizations never blend into one view. The `key` is the deterministic
 * cache key derived from account + organization + scope + window.
 */
export const snapshots = sqliteTable('snapshots', {
  key: text('key').primaryKey(),
  account: text('account').notNull(),
  organization: text('organization').notNull(),
  scope: text('scope').notNull(),
  windowStart: text('window_start'),
  windowEnd: text('window_end'),
  fetchedAt: integer('fetched_at').notNull(),
  incomplete: integer('incomplete', { mode: 'boolean' }).notNull().default(false),
  note: text('note'),
  payload: text('payload', { mode: 'json' }).notNull(),
})

/** The GitHub identity a snapshot set was read with. */
export const accounts = sqliteTable('accounts', {
  login: text('login').primaryKey(),
  name: text('name'),
  fetchedAt: integer('fetched_at').notNull(),
})

/**
 * The durable repository catalog.
 *
 * A repository stays selectable independently of any single date range or of
 * the current 30-day activity. Identity is `account + organization + normalized
 * full name`: the normalized key makes GitHub's case-insensitive `owner/name`
 * unique, while `fullName` keeps the exact display spelling observed from
 * GitHub. `pinned` marks a repository the user added (or kept) by hand;
 * observation never clears it and a missing repository is never deleted.
 */
export const repositories = sqliteTable(
  'repositories',
  {
    account: text('account').notNull(),
    organization: text('organization').notNull(),
    /** Lowercased `owner/name`, the unique key part. */
    fullNameKey: text('full_name_key').notNull(),
    /** Exact display spelling, as GitHub reported it. */
    fullName: text('full_name').notNull(),
    url: text('url').notNull(),
    firstSeenAt: integer('first_seen_at').notNull(),
    lastSeenAt: integer('last_seen_at').notNull(),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    /** `observed` from a sync, `manual` from a validated hand add. */
    source: text('source').notNull().default('observed'),
  },
  (table) => [primaryKey({ columns: [table.account, table.organization, table.fullNameKey] })],
)

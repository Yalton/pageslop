import { pgTable, text, timestamp, unique, index, integer } from 'drizzle-orm/pg-core'

// Better Auth tables — generated via `npx @better-auth/cli generate`
// The auth CLI will create: user, session, account, verification tables
// Run `npx @better-auth/cli generate --output src/lib/db/auth-schema.ts` AFTER auth server is configured in Plan 02
// For now, define a placeholder reference for the user table foreign key:

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: text('email_verified').$type<boolean>(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  encryptedApiKey: text('encrypted_api_key'),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})

export const links = pgTable('links', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  title: text('title'),
  description: text('description'),
  ogImage: text('og_image'),
  favicon: text('favicon'),
  domain: text('domain'),
  status: text('status').notNull().default('pending'),
  category: text('category'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // Uptime monitoring columns
  uptimeStatus: text('uptime_status').notNull().default('unchecked'),
  lastStatusCode: integer('last_status_code'),
  lastCheckedAt: timestamp('last_checked_at'),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
}, (table) => ({
  uniqueUserUrl: unique().on(table.userId, table.url),
  userIdIdx: index('links_user_id_idx').on(table.userId),
  statusIdx: index('links_status_idx').on(table.status),
  createdIdx: index('links_created_at_idx').on(table.createdAt),
}))

export const rawContent = pgTable('raw_content', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  linkId: text('link_id').notNull().references(() => links.id, { onDelete: 'cascade' }),
  bodyText: text('body_text'),
  rawHtml: text('raw_html'),
  fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
})

export const tags = pgTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  source: text('source').notNull().default('user'),
}, (table) => ({
  uniqueUserTag: unique().on(table.userId, table.name),
}))

export const linkTags = pgTable('link_tags', {
  linkId: text('link_id').notNull().references(() => links.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  uniqueLinkTag: unique().on(table.linkId, table.tagId),
}))

export const importJobs = pgTable('import_jobs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // pending | processing | complete | error
  totalUrls: integer('total_urls').notNull().default(0),
  processedUrls: integer('processed_urls').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

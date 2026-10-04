import { db } from '@/lib/db/client'
import { apiTokens } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'

export interface ApiTokenSummary {
  id: string
  name: string
  createdAt: Date
  lastUsedAt: Date | null
}

// Columns safe to return to clients. Never add tokenHash here.
const summaryColumns = {
  id: apiTokens.id,
  name: apiTokens.name,
  createdAt: apiTokens.createdAt,
  lastUsedAt: apiTokens.lastUsedAt,
}

export async function createApiToken(
  userId: string,
  name: string,
  tokenHash: string
): Promise<ApiTokenSummary> {
  const [row] = await db
    .insert(apiTokens)
    .values({ userId, name, tokenHash })
    .returning(summaryColumns)
  return row
}

export async function listApiTokens(userId: string): Promise<ApiTokenSummary[]> {
  return db
    .select(summaryColumns)
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt))
}

export async function deleteApiToken(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
    .returning({ id: apiTokens.id })
  return rows.length > 0
}

export async function findTokenByHash(
  tokenHash: string
): Promise<{ id: string; userId: string; lastUsedAt: Date | null } | null> {
  const [row] = await db
    .select({ id: apiTokens.id, userId: apiTokens.userId, lastUsedAt: apiTokens.lastUsedAt })
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, tokenHash))
    .limit(1)
  return row ?? null
}

export async function touchApiToken(id: string): Promise<void> {
  await db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, id))
}

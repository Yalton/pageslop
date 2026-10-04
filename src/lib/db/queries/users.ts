/**
 * User API key DB helpers.
 * Provides get/set/clear operations for the encryptedApiKey column on the user table.
 * All values stored/retrieved are encrypted blobs — never plaintext.
 */

import { db } from '@/lib/db/client'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Returns the encrypted API key for a user, or null if not configured.
 */
export async function getEncryptedApiKey(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ encryptedApiKey: user.encryptedApiKey })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return row?.encryptedApiKey ?? null
}

/**
 * Stores an encrypted API key for a user.
 * The caller is responsible for encrypting the key before passing it here.
 */
export async function setEncryptedApiKey(userId: string, encrypted: string): Promise<void> {
  await db
    .update(user)
    .set({ encryptedApiKey: encrypted })
    .where(eq(user.id, userId))
}

/**
 * Clears the encrypted API key for a user.
 * After calling this, getEncryptedApiKey will return null.
 */
export async function clearEncryptedApiKey(userId: string): Promise<void> {
  await db
    .update(user)
    .set({ encryptedApiKey: null })
    .where(eq(user.id, userId))
}

/**
 * Returns the user's email, or null if the user does not exist.
 * Used by GET /api/stash/ping to show which account a token belongs to.
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return row?.email ?? null
}

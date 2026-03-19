/**
 * Uptime status update logic with two-consecutive-failure rule.
 *
 * Rules:
 * - Success: sets uptimeStatus='up', resets consecutiveFailures to 0
 * - Failure: atomically increments consecutiveFailures;
 *   flips uptimeStatus to 'down' only when consecutiveFailures reaches 2
 */
import { db } from '@/lib/db/client'
import { links } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function updateUptimeStatus(
  linkId: string,
  up: boolean,
  statusCode: number | null
): Promise<void> {
  if (up) {
    await db
      .update(links)
      .set({
        uptimeStatus: 'up',
        lastStatusCode: statusCode,
        lastCheckedAt: new Date(),
        consecutiveFailures: 0,
        updatedAt: new Date(),
      })
      .where(eq(links.id, linkId))
  } else {
    await db
      .update(links)
      .set({
        consecutiveFailures: sql`${links.consecutiveFailures} + 1`,
        lastStatusCode: statusCode,
        lastCheckedAt: new Date(),
        uptimeStatus: sql`CASE WHEN ${links.consecutiveFailures} + 1 >= 2 THEN 'down' ELSE ${links.uptimeStatus} END`,
        updatedAt: new Date(),
      })
      .where(eq(links.id, linkId))
  }
}

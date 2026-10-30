import { rm } from 'node:fs/promises'
import { join } from 'node:path'

/** Where the worker writes link screenshots; the app serves and deletes them from here. */
export const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || join(process.cwd(), 'data', 'screenshots')

export function screenshotFilePath(linkId: string, dir: string = SCREENSHOT_DIR): string {
  return join(dir, `${linkId}.webp`)
}

/**
 * Delete the screenshot files of deleted links. Missing files are fine (most
 * links have none); other failures are logged, never thrown, so a link delete
 * never fails because of a leftover file.
 */
export async function removeScreenshots(linkIds: string[], dir: string = SCREENSHOT_DIR): Promise<void> {
  await Promise.all(
    linkIds.map((id) =>
      rm(screenshotFilePath(id, dir), { force: true }).catch((err) => {
        console.error(`[screenshot] could not delete the screenshot of link ${id}:`, err)
      }),
    ),
  )
}

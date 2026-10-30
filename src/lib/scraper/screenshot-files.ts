import { rm } from 'node:fs/promises'
import { join } from 'node:path'

/** Where the worker writes link screenshots and cached images; the app serves and deletes them from here. */
export const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || join(process.cwd(), 'data', 'screenshots')

export function screenshotFilePath(linkId: string, dir: string = SCREENSHOT_DIR): string {
  return join(dir, `${linkId}.webp`)
}

/** Kinds of image the worker caches per link (see image-cache.ts). */
export const IMAGE_KINDS = ['og', 'favicon'] as const
export type ImageKind = (typeof IMAGE_KINDS)[number]

export function cachedImagePath(linkId: string, kind: ImageKind, dir: string = SCREENSHOT_DIR): string {
  return join(dir, `${linkId}-${kind}.webp`)
}

/**
 * Delete the screenshot and cached image files of deleted links. Missing files are fine (most
 * links have none); other failures are logged, never thrown, so a link delete
 * never fails because of a leftover file.
 */
export async function removeScreenshots(linkIds: string[], dir: string = SCREENSHOT_DIR): Promise<void> {
  await Promise.all(
    linkIds.flatMap((id) =>
      [screenshotFilePath(id, dir), ...IMAGE_KINDS.map((kind) => cachedImagePath(id, kind, dir))].map((path) =>
        rm(path, { force: true }).catch((err) => {
          console.error(`[screenshot] could not delete ${path} of link ${id}:`, err)
        }),
      ),
    ),
  )
}

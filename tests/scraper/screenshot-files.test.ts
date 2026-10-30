import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { removeScreenshots, screenshotFilePath } from '@/lib/scraper/screenshot-files'

describe('removeScreenshots', () => {
  it('deletes the named links\' screenshots and leaves the rest', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'shots-'))
    for (const id of ['a', 'b', 'c']) await writeFile(screenshotFilePath(id, dir), 'x')
    await removeScreenshots(['a', 'c'], dir)
    expect(await readdir(dir)).toEqual(['b.webp'])
  })

  it('ignores links that have no screenshot', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'shots-'))
    await expect(removeScreenshots(['missing'], dir)).resolves.toBeUndefined()
  })
})

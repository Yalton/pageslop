import puppeteer from 'puppeteer'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || join(process.cwd(), 'data', 'screenshots')

export async function screenshotUrl(url: string, linkId: string): Promise<string | null> {
  let browser
  try {
    await mkdir(SCREENSHOT_DIR, { recursive: true })

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 })

    const filePath = join(SCREENSHOT_DIR, `${linkId}.webp`)
    await page.screenshot({
      path: filePath,
      type: 'webp',
      quality: 75,
      clip: { x: 0, y: 0, width: 1280, height: 800 },
    })

    await browser.close()
    return `/api/screenshots/${linkId}`
  } catch (err) {
    console.error(`[screenshot] failed for ${url}:`, err)
    if (browser) await browser.close().catch(() => {})
    return null
  }
}

import puppeteer, { type Browser } from 'puppeteer'
import { mkdir } from 'node:fs/promises'
import { type GuardedProxy, startGuardedProxy } from '../net/guarded-proxy'
import { validateUrl } from '../net/ssrf-guard'
import { SCREENSHOT_DIR, screenshotFilePath } from './screenshot-files'


// Schemes that never touch the network
const LOCAL_SCHEMES = ['data:', 'blob:', 'about:']

export async function screenshotUrl(url: string, linkId: string): Promise<string | null> {
  let browser: Browser | undefined
  let proxy: GuardedProxy | undefined
  try {
    // Refuse up front so blocked URLs never start a browser
    await validateUrl(url)
    await mkdir(SCREENSHOT_DIR, { recursive: true })

    // All Chromium traffic goes through a loopback proxy that resolves hosts
    // itself and refuses private/internal addresses (SSRF guard).
    proxy = await startGuardedProxy()

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--disable-gpu',
        `--proxy-server=http://127.0.0.1:${proxy.port}`,
        // Chromium bypasses proxies for loopback by default; don't.
        '--proxy-bypass-list=<-loopback>',
        // Keep WebRTC from sending UDP outside the proxy
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
      ],
    })

    const page = await browser.newPage()

    // Second layer: abort any request (document, subresource, redirect hop)
    // whose URL fails the SSRF policy before Chromium sends it.
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      if (req.isInterceptResolutionHandled()) return
      const reqUrl = req.url()
      if (LOCAL_SCHEMES.some((s) => reqUrl.startsWith(s))) {
        req.continue().catch(() => {})
        return
      }
      validateUrl(reqUrl).then(
        () => req.continue().catch(() => {}),
        () => req.abort('blockedbyclient').catch(() => {}),
      )
    })

    await page.setViewport({ width: 1280, height: 800 })
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 })

    const filePath = screenshotFilePath(linkId)
    await page.screenshot({
      path: filePath,
      type: 'webp',
      quality: 75,
      clip: { x: 0, y: 0, width: 1280, height: 800 },
    })

    return `/api/screenshots/${linkId}`
  } catch (err) {
    console.error(`[screenshot] failed for ${url}:`, err)
    return null
  } finally {
    if (browser) await browser.close().catch(() => {})
    if (proxy) await proxy.close().catch(() => {})
  }
}

/**
 * HTTP HEAD/GET availability checker with AbortController timeout.
 *
 * Strategy:
 * 1. Try HEAD request with 10-second timeout
 * 2. On 405 Method Not Allowed, retry with GET
 * 3. On timeout (AbortError) or network error, return up=false with null statusCode
 */
export async function checkUrl(url: string): Promise<{ statusCode: number | null; up: boolean }> {
  const result = await attemptRequest(url, 'HEAD')

  // 405 Method Not Allowed — server doesn't support HEAD, retry with GET
  if (result.statusCode === 405) {
    return attemptRequest(url, 'GET')
  }

  return result
}

async function attemptRequest(
  url: string,
  method: 'HEAD' | 'GET'
): Promise<{ statusCode: number | null; up: boolean }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timeoutId)
    return { statusCode: response.status, up: response.status < 400 }
  } catch {
    clearTimeout(timeoutId)
    return { statusCode: null, up: false }
  }
}

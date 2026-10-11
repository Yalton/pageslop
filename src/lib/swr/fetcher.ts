/**
 * SWR fetcher for the app's JSON API. Throws on HTTP errors so SWR reports
 * them in `error` instead of caching an error body as data.
 */
export async function jsonFetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`)
  return res.json() as Promise<T>
}

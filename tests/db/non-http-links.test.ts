import { describe, it, expect } from 'vitest'
import { nonHttpLinks, NON_HTTP_WHERE } from '../../scripts/non-http-links.mjs'

function fakeClient() {
  const queries: string[] = []
  return { queries, query: async (q: string) => (queries.push(q), { rows: [{ id: 'l1', user_id: 'u1', url: 'javascript:alert(1)' }] }) }
}

describe('nonHttpLinks', () => {
  it('only lists by default', async () => {
    const client = fakeClient()
    expect(await nonHttpLinks(client)).toHaveLength(1)
    expect(client.queries[0]).toMatch(/^select /)
    expect(client.queries[0]).toContain(NON_HTTP_WHERE)
  })

  it('deletes only when asked', async () => {
    const client = fakeClient()
    await nonHttpLinks(client, { remove: true })
    expect(client.queries[0]).toMatch(/^delete from links where .* returning/)
  })

  it('matches the same URLs the app refuses', () => {
    const pattern = new RegExp(NON_HTTP_WHERE.match(/'(.*)'/)![1], 'i')
    for (const ok of ['https://a.com', 'http://a.com', 'HTTPS://A.COM']) expect(pattern.test(ok)).toBe(true)
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://a.com', 'file:///etc/passwd']) expect(pattern.test(bad)).toBe(false)
  })
})

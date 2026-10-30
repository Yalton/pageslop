import { describe, expect, it } from 'vitest'
import { hostForLog } from '@/lib/net/log-url'

describe('hostForLog', () => {
  it('keeps only the host, dropping path, query and credentials', () => {
    expect(hostForLog('https://user:pw@bucket.s3.amazonaws.com:8443/key?X-Amz-Signature=abc')).toBe('bucket.s3.amazonaws.com:8443')
  })

  it('does not echo an unparseable URL', () => {
    expect(hostForLog('not a url ?token=secret')).toBe('(invalid URL)')
  })
})

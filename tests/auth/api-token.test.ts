import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/queries/api-tokens', () => ({
  findTokenByHash: vi.fn(),
  touchApiToken: vi.fn(),
}))

import { generateToken, hashToken, authenticateBearer } from '@/lib/auth/api-token'
import { findTokenByHash, touchApiToken } from '@/lib/db/queries/api-tokens'

const VALID_RAW = 'ps_' + 'A'.repeat(43)

function req(authorization?: string): Request {
  const headers = new Headers()
  if (authorization !== undefined) headers.set('authorization', authorization)
  return new Request('http://localhost/api/stash', { method: 'POST', headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(touchApiToken).mockResolvedValue(undefined)
})

describe('hashToken', () => {
  it('is deterministic SHA-256 hex', () => {
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
    expect(hashToken(VALID_RAW)).toBe(hashToken(VALID_RAW))
  })

  it('returns 64 lowercase hex chars and never the raw token', () => {
    const hash = hashToken(VALID_RAW)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toBe(VALID_RAW)
    expect(hash).not.toContain('ps_')
  })
})

describe('generateToken', () => {
  it('returns ps_ + 43 base64url chars and its hash', () => {
    const { raw, hash } = generateToken()
    expect(raw).toMatch(/^ps_[A-Za-z0-9_-]{43}$/)
    expect(hash).toBe(hashToken(raw))
    expect(hash).not.toBe(raw)
  })

  it('returns a different token each call', () => {
    expect(generateToken().raw).not.toBe(generateToken().raw)
  })
})

describe('authenticateBearer', () => {
  it('returns null when the Authorization header is missing', async () => {
    await expect(authenticateBearer(req())).resolves.toBeNull()
    expect(findTokenByHash).not.toHaveBeenCalled()
  })

  it.each([
    ['empty', ''],
    ['wrong scheme', `Basic ${VALID_RAW}`],
    ['no token', 'Bearer '],
    ['missing ps_ prefix', 'Bearer ' + 'A'.repeat(46)],
    ['too short', 'Bearer ps_abc'],
    ['illegal characters', 'Bearer ps_' + '+'.repeat(43)],
    ['two tokens', `Bearer ${VALID_RAW} ${VALID_RAW}`],
  ])('returns null for a malformed header (%s)', async (_label, header) => {
    await expect(authenticateBearer(req(header))).resolves.toBeNull()
    expect(findTokenByHash).not.toHaveBeenCalled()
  })

  it('returns null for an unknown or revoked token and does not touch', async () => {
    vi.mocked(findTokenByHash).mockResolvedValueOnce(null)
    await expect(authenticateBearer(req(`Bearer ${VALID_RAW}`))).resolves.toBeNull()
    expect(findTokenByHash).toHaveBeenCalledWith(hashToken(VALID_RAW))
    expect(touchApiToken).not.toHaveBeenCalled()
  })

  it('looks up by hash, touches lastUsedAt, and returns the userId', async () => {
    vi.mocked(findTokenByHash).mockResolvedValueOnce({ id: 'tok-1', userId: 'user-1' })
    await expect(authenticateBearer(req(`Bearer ${VALID_RAW}`))).resolves.toEqual({
      userId: 'user-1',
    })
    expect(findTokenByHash).toHaveBeenCalledWith(hashToken(VALID_RAW))
    expect(touchApiToken).toHaveBeenCalledWith('tok-1')
  })

  it('accepts a lowercase "bearer" scheme', async () => {
    vi.mocked(findTokenByHash).mockResolvedValueOnce({ id: 'tok-1', userId: 'user-1' })
    await expect(authenticateBearer(req(`bearer ${VALID_RAW}`))).resolves.toEqual({
      userId: 'user-1',
    })
  })

  it('still authenticates when touching lastUsedAt fails', async () => {
    vi.mocked(findTokenByHash).mockResolvedValueOnce({ id: 'tok-1', userId: 'user-1' })
    vi.mocked(touchApiToken).mockRejectedValueOnce(new Error('db hiccup'))
    await expect(authenticateBearer(req(`Bearer ${VALID_RAW}`))).resolves.toEqual({
      userId: 'user-1',
    })
  })

  it('works with a freshly generated token', async () => {
    const { raw, hash } = generateToken()
    vi.mocked(findTokenByHash).mockResolvedValueOnce({ id: 'tok-2', userId: 'user-2' })
    await expect(authenticateBearer(req(`Bearer ${raw}`))).resolves.toEqual({ userId: 'user-2' })
    expect(findTokenByHash).toHaveBeenCalledWith(hash)
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { createCipheriv, randomBytes } from 'crypto'

/** A blob in the pre-v2 format: iv:tag:ciphertext with no associated data. */
function legacyEncrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`
}

// Note: ENCRYPTION_KEY is set in tests/setup.ts as '0'.repeat(64)

describe('encryptApiKey / decryptApiKey / maskApiKey', () => {
  beforeEach(() => {
    // Ensure the env var is set (setup.ts does this, but make explicit)
    process.env.ENCRYPTION_KEY = '0'.repeat(64)
  })

  it('encryptApiKey returns a string in v2:iv:tag:ciphertext hex format', async () => {
    const { encryptApiKey } = await import('@/lib/enrichment/crypto')
    const result = encryptApiKey('sk-ant-test-key-12345678', 'user-1')
    expect(typeof result).toBe('string')
    expect(result.startsWith('v2:')).toBe(true)
    const parts = result.slice(3).split(':')
    expect(parts).toHaveLength(3)
    // Each part should be a non-empty hex string
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0)
      expect(/^[0-9a-f]+$/.test(part)).toBe(true)
    }
  })

  it('decryptApiKey(encryptApiKey(key, userId), userId) === key', async () => {
    const { encryptApiKey, decryptApiKey } = await import('@/lib/enrichment/crypto')
    const key = 'sk-ant-test-key-12345678'
    const encrypted = encryptApiKey(key, 'user-1')
    const decrypted = decryptApiKey(encrypted, 'user-1')
    expect(decrypted).toBe(key)
  })

  it('encryptApiKey produces different output each call (unique IV)', async () => {
    const { encryptApiKey } = await import('@/lib/enrichment/crypto')
    const key = 'sk-ant-test-key-12345678'
    const enc1 = encryptApiKey(key, 'user-1')
    const enc2 = encryptApiKey(key, 'user-1')
    expect(enc1).not.toBe(enc2)
  })

  it('decryptApiKey throws on tampered ciphertext (flip a byte in the encrypted portion)', async () => {
    const { encryptApiKey, decryptApiKey } = await import('@/lib/enrichment/crypto')
    const key = 'sk-ant-test-key-12345678'
    const encrypted = encryptApiKey(key, 'user-1')
    const [, ivHex, tagHex, ciphertextHex] = encrypted.split(':')
    // Flip the first byte of ciphertext
    const tampered = ciphertextHex.slice(0, -2) + (ciphertextHex.slice(-2) === 'ff' ? '00' : 'ff')
    const tamperedEncrypted = `v2:${ivHex}:${tagHex}:${tampered}`
    expect(() => decryptApiKey(tamperedEncrypted, 'user-1')).toThrow()
  })

  it('decryptApiKey throws if ENCRYPTION_KEY env var is missing', async () => {
    const { decryptApiKey } = await import('@/lib/enrichment/crypto')
    const savedKey = process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_KEY
    expect(() => decryptApiKey('v2:fake:beef:cafe', 'user-1')).toThrow()
    process.env.ENCRYPTION_KEY = savedKey
  })

  it('decryptApiKey throws if ENCRYPTION_KEY has wrong length', async () => {
    const { decryptApiKey } = await import('@/lib/enrichment/crypto')
    const savedKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = 'tooshort'
    expect(() => decryptApiKey('v2:fake:beef:cafe', 'user-1')).toThrow()
    process.env.ENCRYPTION_KEY = savedKey
  })

  it('decryptApiKey throws if ENCRYPTION_KEY is 64 chars but not hex (e.g. a placeholder)', async () => {
    const { decryptApiKey } = await import('@/lib/enrichment/crypto')
    const savedKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = 'g'.repeat(64)
    expect(() => decryptApiKey('v2:fake:beef:cafe', 'user-1')).toThrow(/64-char hex/)
    process.env.ENCRYPTION_KEY = savedKey
  })

  it("decryptApiKey throws for another user's blob", async () => {
    const { encryptApiKey, decryptApiKey } = await import('@/lib/enrichment/crypto')
    const encrypted = encryptApiKey('sk-ant-test-key-12345678', 'user-1')
    expect(() => decryptApiKey(encrypted, 'user-2')).toThrow()
  })

  it('decryptApiKey refuses a pre-v2 blob', async () => {
    const { decryptApiKey } = await import('@/lib/enrichment/crypto')
    expect(() => decryptApiKey(legacyEncrypt('sk-ant-test-key-12345678'), 'user-1')).toThrow(/predates v2/)
  })

  it('reencryptLegacyApiKey turns a pre-v2 blob into a v2 blob for that user', async () => {
    const { decryptApiKey, reencryptLegacyApiKey } = await import('@/lib/enrichment/crypto')
    const upgraded = reencryptLegacyApiKey(legacyEncrypt('sk-ant-test-key-12345678'), 'user-1')
    expect(upgraded).toMatch(/^v2:/)
    expect(decryptApiKey(upgraded!, 'user-1')).toBe('sk-ant-test-key-12345678')
    expect(() => decryptApiKey(upgraded!, 'user-2')).toThrow()
  })

  it('reencryptLegacyApiKey leaves a v2 blob alone', async () => {
    const { encryptApiKey, reencryptLegacyApiKey } = await import('@/lib/enrichment/crypto')
    expect(reencryptLegacyApiKey(encryptApiKey('sk-ant-test-key-12345678', 'user-1'), 'user-1')).toBeNull()
  })

  it("maskApiKey('sk-ant-api03-longkeyvalue') returns 'sk-a...alue' (first 4 + ... + last 4)", async () => {
    const { maskApiKey } = await import('@/lib/enrichment/crypto')
    const result = maskApiKey('sk-ant-api03-longkeyvalue')
    expect(result).toBe('sk-a...alue')
  })

  it("maskApiKey('short') returns '****' (key <= 8 chars)", async () => {
    const { maskApiKey } = await import('@/lib/enrichment/crypto')
    expect(maskApiKey('short')).toBe('****')
    expect(maskApiKey('12345678')).toBe('****')
  })
})

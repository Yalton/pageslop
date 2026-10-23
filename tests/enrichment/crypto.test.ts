import { describe, it, expect, beforeEach } from 'vitest'

// Note: ENCRYPTION_KEY is set in tests/setup.ts as '0'.repeat(64)

describe('encryptApiKey / decryptApiKey / maskApiKey', () => {
  beforeEach(() => {
    // Ensure the env var is set (setup.ts does this, but make explicit)
    process.env.ENCRYPTION_KEY = '0'.repeat(64)
  })

  it('encryptApiKey returns a string in iv:tag:ciphertext hex format', async () => {
    const { encryptApiKey } = await import('@/lib/enrichment/crypto')
    const result = encryptApiKey('sk-ant-test-key-12345678')
    expect(typeof result).toBe('string')
    const parts = result.split(':')
    expect(parts).toHaveLength(3)
    // Each part should be a non-empty hex string
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0)
      expect(/^[0-9a-f]+$/.test(part)).toBe(true)
    }
  })

  it('decryptApiKey(encryptApiKey(key)) === key for any input string', async () => {
    const { encryptApiKey, decryptApiKey } = await import('@/lib/enrichment/crypto')
    const key = 'sk-ant-test-key-12345678'
    const encrypted = encryptApiKey(key)
    const decrypted = decryptApiKey(encrypted)
    expect(decrypted).toBe(key)
  })

  it('encryptApiKey produces different output each call (unique IV)', async () => {
    const { encryptApiKey } = await import('@/lib/enrichment/crypto')
    const key = 'sk-ant-test-key-12345678'
    const enc1 = encryptApiKey(key)
    const enc2 = encryptApiKey(key)
    expect(enc1).not.toBe(enc2)
  })

  it('decryptApiKey throws on tampered ciphertext (flip a byte in the encrypted portion)', async () => {
    const { encryptApiKey, decryptApiKey } = await import('@/lib/enrichment/crypto')
    const key = 'sk-ant-test-key-12345678'
    const encrypted = encryptApiKey(key)
    const [ivHex, tagHex, ciphertextHex] = encrypted.split(':')
    // Flip the first byte of ciphertext
    const tampered = ciphertextHex.slice(0, -2) + (ciphertextHex.slice(-2) === 'ff' ? '00' : 'ff')
    const tamperedEncrypted = `${ivHex}:${tagHex}:${tampered}`
    expect(() => decryptApiKey(tamperedEncrypted)).toThrow()
  })

  it('decryptApiKey throws if ENCRYPTION_KEY env var is missing', async () => {
    const { decryptApiKey } = await import('@/lib/enrichment/crypto')
    const savedKey = process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_KEY
    expect(() => decryptApiKey('fake:beef:cafe')).toThrow()
    process.env.ENCRYPTION_KEY = savedKey
  })

  it('decryptApiKey throws if ENCRYPTION_KEY has wrong length', async () => {
    const { decryptApiKey } = await import('@/lib/enrichment/crypto')
    const savedKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = 'tooshort'
    expect(() => decryptApiKey('fake:beef:cafe')).toThrow()
    process.env.ENCRYPTION_KEY = savedKey
  })

  it('decryptApiKey throws if ENCRYPTION_KEY is 64 chars but not hex (e.g. a placeholder)', async () => {
    const { decryptApiKey } = await import('@/lib/enrichment/crypto')
    const savedKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = 'g'.repeat(64)
    expect(() => decryptApiKey('fake:beef:cafe')).toThrow(/64-char hex/)
    process.env.ENCRYPTION_KEY = savedKey
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

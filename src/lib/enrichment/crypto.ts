/**
 * AES-256-GCM encrypt/decrypt helpers for API key storage.
 *
 * Stored format: v2:iv:authTag:ciphertext (hex-encoded parts)
 * IV: 12 bytes (96 bits, NIST recommended for GCM)
 * Auth tag: 16 bytes (128-bit, full GCM auth tag)
 * Associated data: the owning user's id, so a blob copied into another
 * user's row fails to decrypt instead of lending that user someone's key.
 *
 * Blobs written before v2 have no prefix and no associated data. The worker
 * re-encrypts them at startup with reencryptLegacyApiKey; decryptApiKey
 * refuses them.
 *
 * ENCRYPTION_KEY env var: 64-char hex string = 32 bytes = 256 bits.
 * Generate with: openssl rand -hex 32
 *
 * Note: Key rotation requires a migration — old encrypted blobs cannot be
 * decrypted with a new key.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { requireEncryptionKey } from '@/lib/env'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12  // 96 bits — NIST recommended for GCM
const TAG_LENGTH = 16 // 128-bit auth tag
const VERSION_PREFIX = 'v2:'

// Validated on each use, so a bad key fails the first encrypt/decrypt with a
// clear message instead of producing a short or garbage key.
function getKey(): Buffer {
  return requireEncryptionKey(process.env.ENCRYPTION_KEY)
}

function associatedData(userId: string): Buffer {
  return Buffer.from(`pageslop:user:${userId}`, 'utf8')
}

function decrypt(parts: string, aad: Buffer | null): string {
  const [ivHex, tagHex, encryptedHex] = parts.split(':')
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'))
  if (aad) decipher.setAAD(aad)
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8')
}

/**
 * Encrypts a user's plaintext API key using AES-256-GCM, bound to their id.
 * Returns "v2:iv:authTag:ciphertext". Each call generates a fresh random IV.
 */
export function encryptApiKey(plaintext: string, userId: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  cipher.setAAD(associatedData(userId))
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${VERSION_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypts a stored "v2:iv:authTag:ciphertext" blob belonging to userId.
 * Throws if the blob is tampered with, belongs to another user, predates v2,
 * or if ENCRYPTION_KEY is missing.
 */
export function decryptApiKey(stored: string, userId: string): string {
  if (!stored.startsWith(VERSION_PREFIX)) {
    throw new Error('API key blob predates v2; the worker re-encrypts these at startup')
  }
  return decrypt(stored.slice(VERSION_PREFIX.length), associatedData(userId))
}

/**
 * Re-encrypts a pre-v2 blob (no associated data) as v2 bound to userId.
 * Returns null when the blob is already v2. Throws if it cannot be decrypted.
 */
export function reencryptLegacyApiKey(stored: string, userId: string): string | null {
  if (stored.startsWith(VERSION_PREFIX)) return null
  return encryptApiKey(decrypt(stored, null), userId)
}

/**
 * Returns a masked display string for the API key.
 * Shows first 4 + "..." + last 4 chars.
 * Returns "****" if the key is 8 chars or fewer.
 */
export function maskApiKey(plaintext: string): string {
  if (plaintext.length <= 8) return '****'
  return `${plaintext.slice(0, 4)}...${plaintext.slice(-4)}`
}

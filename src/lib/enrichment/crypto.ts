/**
 * AES-256-GCM encrypt/decrypt helpers for API key storage.
 *
 * Stored format: iv:authTag:ciphertext (all hex-encoded)
 * IV: 12 bytes (96 bits, NIST recommended for GCM)
 * Auth tag: 16 bytes (128-bit, full GCM auth tag)
 *
 * ENCRYPTION_KEY env var: 64-char hex string = 32 bytes = 256 bits.
 * Generate with: openssl rand -hex 32
 *
 * Note: Key rotation requires a migration — old encrypted blobs cannot be
 * decrypted with a new key. The iv:tag:ciphertext format accommodates future
 * versioning by prepending a version prefix if needed.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { requireEncryptionKey } from '@/lib/env'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12  // 96 bits — NIST recommended for GCM
const TAG_LENGTH = 16 // 128-bit auth tag

// Validated on each use, so a bad key fails the first encrypt/decrypt with a
// clear message instead of producing a short or garbage key.
function getKey(): Buffer {
  return requireEncryptionKey(process.env.ENCRYPTION_KEY)
}

/**
 * Encrypts a plaintext API key using AES-256-GCM.
 * Returns "iv:authTag:ciphertext" — all hex-encoded.
 * Each call generates a fresh random IV.
 */
export function encryptApiKey(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypts a stored "iv:authTag:ciphertext" blob.
 * Throws if the auth tag is invalid (ciphertext tampered) or if ENCRYPTION_KEY is missing.
 */
export function decryptApiKey(stored: string): string {
  const key = getKey()
  const [ivHex, tagHex, encryptedHex] = stored.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
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

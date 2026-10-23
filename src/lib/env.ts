/**
 * Validation for security-critical environment variables.
 *
 * Better Auth only rejects its own built-in default secret, so a self-hoster who
 * keeps a placeholder from an old .env.example would sign sessions and
 * verify-email tokens with a publicly known key. These checks refuse to start
 * instead.
 */

// Placeholders shipped in earlier versions of .env.example. Never valid.
const PLACEHOLDER_SECRETS = new Set([
  'generate-a-random-32-char-string',
  'generate-a-64-char-hex-string',
  'change-me',
  'changeme',
])

const MIN_SECRET_LENGTH = 32

/**
 * True while `next build` collects pages. Modules are imported then without
 * runtime env, so validation is skipped and runs again when the server starts.
 */
export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build'
}

/** Returns the auth secret, or throws if it is missing, a placeholder or too short. */
export function requireAuthSecret(value: string | undefined): string {
  const secret = value?.trim()
  if (!secret) {
    throw new Error(
      'BETTER_AUTH_SECRET is not set. Generate one with: openssl rand -base64 32',
    )
  }
  if (PLACEHOLDER_SECRETS.has(secret.toLowerCase())) {
    throw new Error(
      'BETTER_AUTH_SECRET is still the .env.example placeholder. Generate one with: openssl rand -base64 32',
    )
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters. Generate one with: openssl rand -base64 32`,
    )
  }
  return secret
}

/** Returns the public app URL, or throws if it is missing or not an http(s) URL. */
export function requireAuthUrl(value: string | undefined): string {
  const url = value?.trim()
  if (!url) {
    throw new Error(
      'BETTER_AUTH_URL is not set. Set it to the public URL of the app, e.g. https://pageslop.example.com',
    )
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`BETTER_AUTH_URL is not a valid URL: ${url}`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`BETTER_AUTH_URL must use http or https: ${url}`)
  }
  return url
}

/** Returns the 32-byte AES key, or throws if ENCRYPTION_KEY is not 64 hex chars. */
export function requireEncryptionKey(value: string | undefined): Buffer {
  const hex = value?.trim()
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate one with: openssl rand -hex 32',
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Parses a comma-separated env list, e.g. TRUSTED_IP_HEADER="cf-connecting-ip".
 * Header names are lowercased. Returns undefined when unset or empty.
 */
export function parseList(value: string | undefined, lowercase = false): string[] | undefined {
  const items = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (lowercase ? item.toLowerCase() : item))
  return items.length > 0 ? items : undefined
}

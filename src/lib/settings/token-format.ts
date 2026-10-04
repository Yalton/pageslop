import { format } from 'date-fns'

/** Row shape returned by GET /api/settings/tokens. Dates are ISO strings over JSON. */
export interface ApiTokenSummary {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
}

/** Response of POST /api/settings/tokens. `token` is the raw value, shown once. */
export interface CreatedApiToken {
  id: string
  name: string
  token: string
}

export const TOKEN_NAME_MAX = 100

export function formatTokenDate(value: string | Date | null): string {
  if (value === null) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  return format(date, 'MMM d, yyyy')
}

/** Returns an error message, or null when the name is acceptable. */
export function validateTokenName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'Name is required'
  if (trimmed.length > TOKEN_NAME_MAX) return `Name must be ${TOKEN_NAME_MAX} characters or fewer`
  return null
}

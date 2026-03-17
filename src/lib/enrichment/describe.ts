/**
 * Description extraction heuristics.
 * Extracts the first meaningful paragraph from body text.
 */

const MIN_PARAGRAPH_LENGTH = 20
const MAX_DESCRIPTION_LENGTH = 150

/**
 * Extracts a description from raw body text.
 * Strategy:
 * 1. Split text into candidate paragraphs (by newlines or sentences)
 * 2. Find the first paragraph with >= 20 chars
 * 3. Truncate at sentence boundary to ~150 chars
 * Returns empty string if no meaningful paragraph found.
 */
export function extractDescription(text: string): string {
  if (!text || text.trim().length === 0) return ''

  // Split by newlines first, then try sentences if no good paragraph found
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= MIN_PARAGRAPH_LENGTH)

  const candidate = paragraphs.length > 0 ? paragraphs[0] : text.trim()

  if (candidate.length < MIN_PARAGRAPH_LENGTH) return ''

  return truncateAtSentenceBoundary(candidate, MAX_DESCRIPTION_LENGTH)
}

/**
 * Truncates text at a sentence boundary near the target length.
 * Prefers ending on a period, exclamation, or question mark.
 */
function truncateAtSentenceBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text

  // Try to find a sentence-ending punctuation at or before maxLength
  const segment = text.slice(0, maxLength + 10) // look slightly beyond for a sentence end
  const sentenceEndRegex = /[.!?]/g
  let lastSentenceEnd = -1
  let match: RegExpExecArray | null

  while ((match = sentenceEndRegex.exec(segment)) !== null) {
    if (match.index <= maxLength) {
      lastSentenceEnd = match.index + 1
    }
  }

  if (lastSentenceEnd > MIN_PARAGRAPH_LENGTH) {
    return text.slice(0, lastSentenceEnd).trim()
  }

  // Fall back to word boundary truncation
  const truncated = text.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > MIN_PARAGRAPH_LENGTH) {
    return truncated.slice(0, lastSpace) + '…'
  }

  return truncated + '…'
}

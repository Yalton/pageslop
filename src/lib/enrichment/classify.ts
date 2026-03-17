/**
 * Core enrichment module.
 * Provides tag extraction, categorization, and the main enrich() entry point.
 */

import { CATEGORIES } from '@/types/index'
import { getDomainHints } from './domain-hints'
import { extractDescription } from './describe'

export { CATEGORIES }

export interface EnrichmentResult {
  tags: string[]
  description: string
  category: string
}

// ---------------------------------------------------------------------------
// Stop words — filtered out during keyword extraction
// ---------------------------------------------------------------------------

export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'it', 'its', 'this', 'that', 'these', 'those', 'he', 'she', 'they', 'we',
  'i', 'you', 'me', 'my', 'your', 'his', 'her', 'our', 'their', 'us',
  'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'each',
  'more', 'most', 'other', 'such', 'than', 'too', 'very', 'can', 'just',
  'if', 'as', 'when', 'where', 'how', 'what', 'which', 'who', 'all', 'any',
  'also', 'however', 'because', 'while', 'after', 'before', 'then', 'than',
  'here', 'there', 'only', 'new', 'get', 'use', 'using', 'used',
])

// ---------------------------------------------------------------------------
// Category signals — words that indicate each category
// ---------------------------------------------------------------------------

export const CATEGORY_SIGNALS: Record<string, string[]> = {
  Technology: [
    'software', 'programming', 'api', 'code', 'developer', 'tech', 'computer',
    'javascript', 'python', 'react', 'typescript', 'database', 'server', 'cloud',
    'framework', 'library', 'web', 'app', 'algorithm', 'data', 'network',
    'linux', 'devops', 'github', 'security', 'machine', 'learning', 'ai',
    'artificial', 'intelligence', 'open-source', 'docker', 'kubernetes',
  ],
  News: [
    'news', 'breaking', 'report', 'journalist', 'press', 'media', 'article',
    'latest', 'update', 'headline', 'story', 'coverage', 'election', 'politics',
    'government', 'policy', 'announcement', 'statement',
  ],
  Reference: [
    'reference', 'documentation', 'docs', 'guide', 'manual', 'tutorial',
    'specification', 'wiki', 'encyclopedia', 'definition', 'glossary',
    'faq', 'howto', 'how-to', 'readme', 'changelog',
  ],
  Entertainment: [
    'movie', 'film', 'music', 'game', 'play', 'watch', 'listen', 'show',
    'series', 'episode', 'album', 'artist', 'entertainment', 'celebrity',
    'actor', 'actress', 'director', 'cinema', 'theatre', 'concert', 'festival',
    'video', 'streaming', 'netflix', 'spotify', 'gaming', 'esports',
  ],
  Shopping: [
    'buy', 'shop', 'price', 'deal', 'discount', 'product', 'review', 'store',
    'sale', 'purchase', 'order', 'delivery', 'shipping', 'cart', 'checkout',
    'brand', 'merchandise', 'marketplace', 'ecommerce',
  ],
  Social: [
    'social', 'community', 'forum', 'discussion', 'thread', 'comment', 'share',
    'follow', 'profile', 'network', 'friends', 'group', 'post', 'tweet',
    'message', 'chat', 'conversation', 'reddit', 'twitter', 'facebook',
  ],
  Education: [
    'learn', 'course', 'education', 'school', 'university', 'college', 'lesson',
    'lecture', 'study', 'student', 'teacher', 'professor', 'class', 'training',
    'certificate', 'degree', 'academic', 'research', 'science', 'math',
    'history', 'biology', 'chemistry', 'physics', 'lecture', 'mooc',
  ],
  Finance: [
    'finance', 'money', 'investment', 'stock', 'market', 'economy', 'business',
    'bank', 'crypto', 'bitcoin', 'trading', 'portfolio', 'savings', 'budget',
    'tax', 'insurance', 'loan', 'mortgage', 'startup', 'venture', 'fund',
  ],
  Health: [
    'health', 'medical', 'medicine', 'doctor', 'hospital', 'fitness', 'exercise',
    'diet', 'nutrition', 'mental', 'therapy', 'wellness', 'disease', 'symptoms',
    'treatment', 'vaccine', 'clinical', 'patient', 'surgery', 'yoga',
  ],
  Creative: [
    'design', 'art', 'creative', 'photography', 'drawing', 'painting', 'craft',
    'illustration', 'graphic', 'typography', 'logo', 'color', 'ui', 'ux',
    'animation', 'fashion', 'interior', 'architecture', 'sculpture',
  ],
}

// ---------------------------------------------------------------------------
// extractKeywords — frequency-based top-N keyword extraction
// ---------------------------------------------------------------------------

/**
 * Tokenizes text, filters stop words, counts frequency, returns top-N keywords.
 */
export function extractKeywords(text: string, limit = 10): string[] {
  if (!text || text.trim().length === 0) return []

  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => {
      return (
        token.length >= 3 &&
        !STOP_WORDS.has(token) &&
        !/^\d+$/.test(token)
      )
    })

  const freq = new Map<string, number>()
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1)
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word)
}

// ---------------------------------------------------------------------------
// categorize — score text against category signals
// ---------------------------------------------------------------------------

/**
 * Returns the best-matching category or "Other" if no signals score > 0.
 */
export function categorize(text: string): string {
  if (!text || text.trim().length === 0) return 'Other'

  const normalized = text.toLowerCase()
  let bestCategory = 'Other'
  let bestScore = 0

  for (const [category, signals] of Object.entries(CATEGORY_SIGNALS)) {
    let score = 0
    for (const signal of signals) {
      if (normalized.includes(signal)) {
        score++
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestCategory = category
    }
  }

  return bestCategory
}

// ---------------------------------------------------------------------------
// buildTags — combine keyword extraction + domain hints
// ---------------------------------------------------------------------------

/**
 * Builds a deduplicated, normalized, 2-4 tag array from text and domain.
 */
export function buildTags(text: string, domain: string | null): string[] {
  const keywords = extractKeywords(text, 6)
  const domainHints = getDomainHints(domain)

  // Combine: domain hints first (higher signal), then keywords
  const combined = [...domainHints, ...keywords]
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length >= 2)

  // Deduplicate
  const seen = new Set<string>()
  const unique: string[] = []
  for (const tag of combined) {
    if (!seen.has(tag)) {
      seen.add(tag)
      unique.push(tag)
    }
  }

  // Ensure 2-4 tags
  const tags = unique.slice(0, 4)

  // Pad to minimum 2 if we don't have enough
  if (tags.length < 2) {
    const fallbacks = ['link', 'saved', 'content', 'resource']
    for (const fallback of fallbacks) {
      if (tags.length >= 2) break
      if (!seen.has(fallback)) {
        tags.push(fallback)
        seen.add(fallback)
      }
    }
  }

  return tags
}

// ---------------------------------------------------------------------------
// enrich — main entry point
// ---------------------------------------------------------------------------

export interface EnrichInput {
  bodyText: string | null
  existingDescription: string | null
  domain: string | null
  title: string | null
}

/**
 * Enriches a link with tags, description, and category.
 * Uses existing description when available; falls back to bodyText extraction.
 * Combines bodyText and title for tag/category signals.
 */
export function enrich(opts: EnrichInput): EnrichmentResult {
  const { bodyText, existingDescription, domain, title } = opts

  // Combine available text signals for analysis
  const textSignals = [bodyText, title].filter(Boolean).join(' ')

  // Tags: combine keyword extraction + domain hints
  const tags = buildTags(textSignals, domain)

  // Description: use existing or extract from bodyText
  const description =
    existingDescription !== null && existingDescription !== undefined
      ? existingDescription
      : extractDescription(bodyText ?? title ?? '')

  // Category: classify combined text
  const category = categorize(textSignals)

  return { tags, description, category }
}

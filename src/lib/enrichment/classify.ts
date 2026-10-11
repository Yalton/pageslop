/**
 * Core enrichment module.
 * Provides tag extraction, categorization, and the main enrich() entry point.
 */

import { CATEGORIES } from '@/types/index'
import { getDomainHints } from './domain-hints'
import { extractDescription } from './describe'
import { isTopicSignal, isTopicTag, matchTopics } from './topics'

export { CATEGORIES }

export interface EnrichmentResult {
  tags: string[]
  description: string
  category: string
}

// ---------------------------------------------------------------------------
// Stop words — filtered out during keyword extraction
// ---------------------------------------------------------------------------

/** English function words and generic filler that never make useful tags. */
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
  'also', 'however', 'because', 'while', 'after', 'before', 'then',
  'here', 'there', 'only', 'new', 'get', 'use', 'using', 'used',
  // pronouns / determiners / prepositions
  'him', 'them', 'theirs', 'ours', 'yours', 'mine', 'whom', 'whose', 'why',
  'itself', 'yourself', 'themselves', 'ourselves', 'myself', 'himself', 'herself',
  'some', 'many', 'much', 'few', 'several', 'every', 'own', 'same', 'another',
  'out', 'off', 'over', 'under', 'again', 'further', 'once', 'above', 'below',
  'between', 'against', 'without', 'within', 'along', 'across', 'behind',
  'beyond', 'around', 'among', 'toward', 'towards', 'upon', 'onto', 'via',
  'per', 'until', 'since', 'though', 'although', 'unless', 'whether', 'whereas',
  'shall', 'must', 'ought', 'cannot', 'cant', 'dont', 'doesnt', 'didnt',
  'isnt', 'arent', 'wasnt', 'werent', 'wont', 'wouldnt', 'couldnt', 'shouldnt',
  'ive', 'youre', 'youve', 'youll', 'theyre', 'thats', 'whats', 'lets', 'im',
  // generic verbs / filler
  'ago', 'please', 'make', 'makes', 'made', 'making', 'need', 'needs', 'needed',
  'update', 'updated', 'updates', 'gets', 'got', 'getting', 'uses', 'one', 'two',
  'three', 'first', 'second', 'last', 'next', 'like', 'likes', 'liked', 'well',
  'even', 'still', 'really', 'actually', 'always', 'never', 'often', 'sometimes',
  'now', 'today', 'yesterday', 'tomorrow', 'day', 'days', 'week', 'weeks',
  'month', 'months', 'year', 'years', 'hour', 'hours', 'minute', 'minutes',
  'time', 'times', 'way', 'ways', 'thing', 'things', 'lot', 'lots', 'kind',
  'go', 'goes', 'going', 'went', 'gone', 'come', 'comes', 'coming', 'came',
  'take', 'takes', 'taking', 'took', 'give', 'gives', 'given', 'gave',
  'see', 'sees', 'seen', 'saw', 'look', 'looks', 'looking', 'know', 'knows',
  'known', 'think', 'thinks', 'want', 'wants', 'wanted', 'say', 'says', 'said',
  'tell', 'told', 'try', 'tries', 'tried', 'find', 'found', 'keep', 'keeps',
  'let', 'put', 'set', 'sets', 'show', 'shows', 'shown', 'seem', 'seems',
  'became', 'become', 'becomes', 'work', 'works', 'working', 'worked',
  'start', 'started', 'starts', 'help', 'helps', 'call', 'called', 'read',
  'good', 'great', 'best', 'better', 'bad', 'big', 'small', 'large', 'little',
  'long', 'high', 'low', 'old', 'right', 'left', 'full', 'able', 'sure',
  'yes', 'okay', 'thanks', 'thank', 'hello', 'welcome', 'via', 'etc',
  'available', 'currently', 'recently', 'already', 'enough', 'almost',
  'back', 'down', 'top', 'bottom', 'part', 'based', 'including', 'within',
  'something', 'anything', 'everything', 'nothing', 'someone', 'anyone',
  'everyone', 'people', 'without', 'maybe', 'perhaps', 'quite', 'rather',
  'view', 'views', 'more', 'less', 'least', 'ever', 'far', 'almost',
])

/**
 * Markup, browser-chrome, and boilerplate words that leak out of page source
 * (attributes, cookie banners, bot challenges, footers) and are never topics.
 */
export const WEB_NOISE_WORDS = new Set([
  // markup / CSS / URLs
  'class', 'iframe', 'src', 'href', 'https', 'http', 'www', 'html', 'htm',
  'div', 'span', 'img', 'alt', 'width', 'height', 'style', 'styles', 'script',
  'noscript', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'url', 'uri',
  'rel', 'nofollow', 'noopener', 'noreferrer', 'target', 'blank', 'px', 'rem',
  'font', 'align', 'margin', 'padding', 'border', 'display', 'none', 'flex',
  'auto', 'solid', 'inherit', 'transparent', 'webkit', 'moz', 'important',
  'null', 'undefined', 'true', 'false', 'var', 'const', 'function', 'return',
  'amp', 'nbsp', 'quot', 'utf', 'charset', 'meta', 'viewport', 'json', 'xml',
  'com', 'org', 'net', 'index', 'php', 'aspx',
  // browser chrome / bot challenges
  'cookie', 'cookies', 'warning', 'enable', 'enabled', 'disable', 'disabled',
  'browser', 'browsers', 'error', 'errors', 'text', 'challenge', 'loading',
  'loaded', 'load', 'reload', 'refresh', 'redirect', 'redirecting', 'captcha',
  'verify', 'verifying', 'human', 'robot', 'cloudflare', 'ray', 'checking',
  'continue', 'wait', 'moment', 'seconds', 'request', 'requests', 'blocked',
  'access', 'denied', 'forbidden', 'unsupported', 'supported', 'outdated',
  // app chrome and site-wide footers that end up on many unrelated pages
  'tab', 'tabs', 'window', 'token', 'test', 'free', 'interface', 'generation',
  'signed-in', 'signed', 'password', 'otp', 'google', 'youtube', 'session', 'white', 'change', 'woff',
  // navigation / footer boilerplate
  'click', 'tap', 'menu', 'sign', 'signin', 'signup', 'login', 'logout', 'log',
  'register', 'account', 'subscribe', 'subscription', 'newsletter-signup',
  'privacy', 'terms', 'copyright', 'rights', 'reserved', 'policy', 'policies',
  'legal', 'contact', 'skip', 'toggle', 'navigation', 'search', 'home',
  'close', 'open-menu', 'accept', 'decline', 'consent', 'preferences',
  'settings', 'cancel', 'submit', 'button', 'link', 'links', 'page', 'pages',
  'site', 'website', 'learn-more', 'more-info', 'share', 'tweet', 'email',
  'follow', 'press', 'advertise', 'advertising', 'ads', 'sponsored', 'feedback',
  'help-center', 'faq', 'careers', 'jobs-at', 'sitemap', 'powered',
  // sign-up forms: country pickers and code-resend prompts
  'resend', 'verification', 'enter', 'island', 'islands', 'south', 'north', 'east', 'west', 'republic',
  'saint', 'united', 'guinea', 'country', 'region',
])

const MAX_TOKEN_LENGTH = 20

/**
 * True when a lower-cased token is not a plausible tag: too short/long,
 * contains digits (hex colours, ids, hashes), malformed hyphenation,
 * a stop word, or markup/boilerplate noise.
 */
export function isJunkToken(token: string): boolean {
  const t = token.toLowerCase().trim()
  if (t.length < 3 || t.length > MAX_TOKEN_LENGTH) return true
  if (/\d/.test(t)) return true // digits: 221f1f, 0-29b-a4b, ids, years
  if (!/^[a-z-]+$/.test(t)) return true
  if (t.startsWith('-') || t.endsWith('-') || t.includes('--')) return true
  if (new Set(t.replace(/-/g, '')).size < 3) return true // ffffff, aaa, zzz

  const isNoise = (w: string) => STOP_WORDS.has(w) || WEB_NOISE_WORDS.has(w)
  if (isNoise(t) || isNoise(normalizeTag(t))) return true

  if (t.includes('-')) {
    const segments = t.split('-')
    if (segments.length > 3) return true // more than two hyphens
    if (segments.some((s) => s.length < 2)) return true
    const noisy = segments.filter(isNoise).length
    if (noisy * 2 > segments.length) return true // e.g. challenge-error-text
  }
  return false
}

// ---------------------------------------------------------------------------
// normalizeTag — lower-case and fold simple English plurals
// ---------------------------------------------------------------------------

/** Words ending in "s" that are not plurals (or whose plural we keep). */
const NON_PLURAL_S = new Set([
  'news', 'series', 'species', 'kubernetes', 'postgres', 'jenkins', 'always', 'devops', 'jobs',
  'perhaps', 'yes', 'thanks', 'chaos', 'ethos', 'pathos', 'cosmos', 'kudos',
  'ios', 'macos', 'tvos', 'watchos', 'chromeos', 'centos', 'aws', 'gas',
  'atlas', 'canvas', 'alias', 'bias', 'pancreas', 'lens', 'means', 'mars',
  'christmas', 'texas', 'kansas', 'arkansas', 'vegas', 'ares', 'hermes',
  'diabetes', 'herpes', 'rabies', 'scabies', 'measles', 'mumps', 'whereas',
  'overseas', 'sometimes', 'nowadays', 'besides', 'towards', 'afterwards',
  'backwards', 'forwards', 'upwards', 'downwards', 'sales', 'ones', 'yours',
  'ours', 'theirs', 'hers', 'its', 'this', 'thus', 'paris', 'athens',
  'wales', 'dallas', 'brussels', 'mercedes', 'adidas', 'pandas', 'numpy',
])

/** "-ies" words that pluralise a "-ie" singular, not a "-y" one. */
const IE_PLURALS = new Set([
  'movies', 'cookies', 'zombies', 'selfies', 'hippies', 'goodies', 'freebies',
  'calories', 'smoothies', 'brownies', 'rookies', 'indies', 'aussies',
  'pies', 'ties', 'lies', 'dies', 'genies', 'hoodies', 'techies', 'newbies',
  'foodies', 'roomies', 'birdies', 'boogies', 'collies', 'veggies',
])

/** "-ches" words whose singular ends in "-che". */
const CHE_PLURALS = new Set([
  'caches', 'niches', 'aches', 'headaches', 'avalanches', 'mustaches',
  'moustaches', 'cliches', 'quiches', 'psyches', 'creches', 'apaches',
])

function singularize(word: string): string {
  if (word.length <= 3) return word
  if (NON_PLURAL_S.has(word)) return word
  if (!word.endsWith('s')) return word
  if (/(ss|us|is|ics|ous|sis)$/.test(word)) return word

  if (word.endsWith('ies')) {
    if (IE_PLURALS.has(word)) return word.slice(0, -1)
    return word.length > 4 ? word.slice(0, -3) + 'y' : word
  }
  if (word.endsWith('sses')) return word.slice(0, -2) // classes -> class
  if (/(xes|zzes|shes)$/.test(word)) return word.slice(0, -2) // boxes, buzzes, dishes
  if (word.endsWith('ches')) {
    return CHE_PLURALS.has(word) ? word.slice(0, -1) : word.slice(0, -2)
  }
  return word.slice(0, -1)
}

/**
 * Canonical tag form: lower-cased, trimmed, with simple English plurals folded
 * to singular (agents -> agent, libraries -> library). For hyphenated tags only
 * the final segment is singularized (ai-agents -> ai-agent).
 */
export function normalizeTag(name: string): string {
  const t = name.toLowerCase().trim()
  const idx = t.lastIndexOf('-')
  if (idx === -1) return singularize(t)
  return t.slice(0, idx + 1) + singularize(t.slice(idx + 1))
}

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

/** A keyword must occur at least this many times to become a tag. */
export const MIN_KEYWORD_FREQUENCY = 2

/** Adds normalized, non-junk token counts from `text` into `freq`. */
function countKeywords(text: string, freq: Map<string, number>, weight = 1): void {
  if (!text) return
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)
  for (const token of tokens) {
    if (isJunkToken(token)) continue
    const tag = normalizeTag(token)
    freq.set(tag, (freq.get(tag) ?? 0) + weight)
  }
}

function topKeywords(freq: Map<string, number>, limit: number, minFrequency: number): string[] {
  return Array.from(freq.entries())
    .filter(([, count]) => count >= minFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word)
}

/**
 * Tokenizes text, drops junk tokens (stop words, markup noise, digit/hex
 * tokens), folds plurals, and returns the top-N keywords that occur at least
 * `minFrequency` times.
 */
export function extractKeywords(
  text: string,
  limit = 10,
  minFrequency = MIN_KEYWORD_FREQUENCY,
): string[] {
  if (!text || text.trim().length === 0) return []
  const freq = new Map<string, number>()
  countKeywords(text, freq)
  return topKeywords(freq, limit, minFrequency)
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

const MAX_TAGS = 4

export interface BuildTagsOptions {
  description?: string | null
  url?: string | null
  /**
   * Tag names the user already has on other links. When given, keyword tags
   * are kept only if they are in it, so a page's one-off words do not each
   * become a tag nobody else shares.
   */
  knownTags?: ReadonlySet<string>
}

/**
 * Builds a deduplicated, normalized tag array (at most 4): shared topic tags
 * first (see topics.ts), then domain hints, then keywords. Title words count
 * double, so a title word alone qualifies as a keyword.
 * Returns fewer tags (possibly none) rather than padding with generic ones.
 */
export function buildTags(
  text: string,
  domain: string | null,
  title?: string | null,
  opts: BuildTagsOptions = {},
): string[] {
  const topics = matchTopics({ title, description: opts.description, bodyText: text, url: opts.url })
  const domainHints = getDomainHints(domain).map((t) => t.toLowerCase().trim())

  const freq = new Map<string, number>()
  countKeywords(text, freq)
  if (title) countKeywords(title, freq, MIN_KEYWORD_FREQUENCY)
  let keywords = topKeywords(freq, 6, MIN_KEYWORD_FREQUENCY)
  if (opts.knownTags) keywords = keywords.filter((k) => opts.knownTags!.has(k))
  // "game" next to "gaming" says nothing new. A topic's own name ("code" in
  // "verification code") only comes from topic matching, never as a keyword.
  keywords = keywords.filter((k) => !isTopicSignal(k, topics) && !isTopicTag(k))

  const seen = new Set<string>()
  const tags: string[] = []
  for (const tag of [...topics, ...domainHints, ...keywords]) {
    if (tag.length < 2 || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
  }
  return tags.slice(0, MAX_TAGS)
}

// ---------------------------------------------------------------------------
// enrich — main entry point
// ---------------------------------------------------------------------------

export interface EnrichInput {
  bodyText: string | null
  existingDescription: string | null
  domain: string | null
  title: string | null
  url?: string | null
  /** See BuildTagsOptions.knownTags. */
  knownTags?: ReadonlySet<string>
}

/**
 * Enriches a link with tags, description, and category.
 * Uses existing description when available; falls back to bodyText extraction.
 * Combines bodyText and title for tag/category signals; title words weigh double for tags.
 */
export function enrich(opts: EnrichInput): EnrichmentResult {
  const { bodyText, existingDescription, domain, title, url, knownTags } = opts

  // Combine available text signals for analysis
  const textSignals = [bodyText, title].filter(Boolean).join(' ')

  // Tags: topics, domain hints, then keywords (title weighted higher)
  const tags = buildTags(bodyText ?? '', domain, title, { description: existingDescription, url, knownTags })

  // Description: use existing or extract from bodyText
  const description =
    existingDescription !== null && existingDescription !== undefined
      ? existingDescription
      : extractDescription(bodyText ?? title ?? '')

  // Category: classify combined text
  const category = categorize(textSignals)

  return { tags, description, category }
}

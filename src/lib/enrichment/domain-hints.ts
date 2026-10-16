/**
 * Domain-aware tag hints for known websites.
 * Maps domain patterns to guaranteed tag arrays.
 */

export const DOMAIN_HINTS: Record<string, string[]> = {
  'github.com': ['code', 'open-source'],
  'gitlab.com': ['code', 'open-source'],
  'bitbucket.org': ['code', 'open-source'],
  'stackoverflow.com': ['code', 'programming'],
  'developer.mozilla.org': ['reference', 'documentation'],
  'mdn': ['reference', 'documentation'],
  'youtube.com': ['video'],
  'youtu.be': ['video'],
  'vimeo.com': ['video'],
  'twitch.tv': ['video', 'streaming'],
  'wikipedia.org': ['reference', 'wiki'],
  'wikimedia.org': ['reference', 'wiki'],
  'medium.com': ['article', 'blog'],
  'substack.com': ['article', 'newsletter'],
  'dev.to': ['code', 'blog'],
  'hashnode.com': ['code', 'blog'],
  'hackernews': ['technology', 'news'],
  'news.ycombinator.com': ['technology', 'news'],
  'reddit.com': ['social', 'community'],
  'twitter.com': ['social'],
  'x.com': ['social'],
  'linkedin.com': ['social', 'professional'],
  'amazon.com': ['shopping'],
  'ebay.com': ['shopping'],
  'etsy.com': ['shopping', 'creative'],
  'npmjs.com': ['code', 'package'],
  'pypi.org': ['code', 'package'],
  'crates.io': ['code', 'package'],
  'docs.': ['documentation', 'reference'],
  'arxiv.org': ['research', 'education'],
  'scholar.google.com': ['research', 'education'],
  'coursera.org': ['education', 'course'],
  'udemy.com': ['education', 'course'],
  'edx.org': ['education', 'course'],
  'khanacademy.org': ['education'],
  'news.google.com': ['news'],
  'bbc.com': ['news'],
  'nytimes.com': ['news'],
  'theguardian.com': ['news'],
  'reuters.com': ['news'],
  'figma.com': ['design', 'creative'],
  'dribbble.com': ['design', 'creative'],
  'behance.net': ['design', 'creative'],
  'codepen.io': ['code', 'demo'],
  'jsfiddle.net': ['code', 'demo'],
  'codesandbox.io': ['code', 'demo'],
}

/**
 * Get domain-based tag hints for a given domain.
 * Supports partial matching for subdomains (e.g., docs.github.com -> github.com hints).
 */
export function getDomainHints(domain: string | null): string[] {
  if (!domain) return []

  const normalizedDomain = domain.toLowerCase()

  // Exact match first
  if (normalizedDomain in DOMAIN_HINTS) {
    return DOMAIN_HINTS[normalizedDomain]
  }

  // Partial match: check if domain contains a known key (for subdomains)
  for (const [key, hints] of Object.entries(DOMAIN_HINTS)) {
    // Skip prefix patterns like 'docs.'
    if (key.endsWith('.')) {
      if (normalizedDomain.startsWith(key)) {
        return hints
      }
      continue
    }
    // Match if domain ends with the key (e.g., docs.github.com contains github.com)
    if (normalizedDomain === key || normalizedDomain.endsWith(`.${key}`)) {
      return hints
    }
    // Match if domain includes the key as a substring (e.g., hackernews)
    if (!key.includes('.') && normalizedDomain.includes(key)) {
      return hints
    }
  }

  return []
}

/**
 * Default category for sites whose pages say little about themselves (a YouTube
 * watch page scrapes as the site footer). Matched like DOMAIN_HINTS: exact
 * host or any subdomain of it.
 */
export const DOMAIN_CATEGORIES: Record<string, string> = {
  'youtube.com': 'Entertainment',
  'youtu.be': 'Entertainment',
  'vimeo.com': 'Entertainment',
  'twitch.tv': 'Entertainment',
  'spotify.com': 'Entertainment',
  'soundcloud.com': 'Entertainment',
  'bandcamp.com': 'Entertainment',
  'netflix.com': 'Entertainment',
  'imdb.com': 'Entertainment',
  'itch.io': 'Entertainment',
  'github.com': 'Technology',
  'gitlab.com': 'Technology',
  'huggingface.co': 'Technology',
  'stackoverflow.com': 'Technology',
  'npmjs.com': 'Technology',
  'pypi.org': 'Technology',
  'crates.io': 'Technology',
  'dev.to': 'Technology',
  'news.ycombinator.com': 'Technology',
  'wikipedia.org': 'Reference',
  'developer.mozilla.org': 'Reference',
  'arxiv.org': 'Education',
  'coursera.org': 'Education',
  'udemy.com': 'Education',
  'edx.org': 'Education',
  'khanacademy.org': 'Education',
  'reddit.com': 'Social',
  'twitter.com': 'Social',
  'x.com': 'Social',
  'bsky.app': 'Social',
  'linkedin.com': 'Social',
  'amazon.com': 'Shopping',
  'ebay.com': 'Shopping',
  'etsy.com': 'Shopping',
  'bbc.com': 'News',
  'nytimes.com': 'News',
  'theguardian.com': 'News',
  'reuters.com': 'News',
  'news.google.com': 'News',
  'figma.com': 'Creative',
  'dribbble.com': 'Creative',
  'behance.net': 'Creative',
}

/** The DOMAIN_CATEGORIES entry for `domain` or one of its parent domains. */
export function getDomainCategory(domain: string | null | undefined): string | null {
  if (!domain) return null
  let host = domain.toLowerCase().replace(/^www\./, '')
  while (host.includes('.')) {
    if (host in DOMAIN_CATEGORIES) return DOMAIN_CATEGORIES[host]
    host = host.slice(host.indexOf('.') + 1)
  }
  return null
}

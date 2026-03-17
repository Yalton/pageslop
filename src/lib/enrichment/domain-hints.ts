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

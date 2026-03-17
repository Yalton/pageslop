import { describe, it, expect } from 'vitest'
import { enrich, categorize, CATEGORIES } from '@/lib/enrichment/classify'
import { extractDescription } from '@/lib/enrichment/describe'
import { getDomainHints, DOMAIN_HINTS } from '@/lib/enrichment/domain-hints'

describe('enrich()', () => {
  it('returns 2-4 lowercase tags from bodyText with react/javascript', () => {
    const result = enrich({
      bodyText: 'react javascript component hooks state management tutorial',
      existingDescription: null,
      domain: null,
      title: null,
    })
    expect(result.tags.length).toBeGreaterThanOrEqual(2)
    expect(result.tags.length).toBeLessThanOrEqual(4)
    const hasReactOrJS = result.tags.some((t) => t === 'react' || t === 'javascript')
    expect(hasReactOrJS).toBe(true)
    result.tags.forEach((tag) => expect(tag).toBe(tag.toLowerCase()))
  })

  it('returns tags derived from title when bodyText is null', () => {
    const result = enrich({
      bodyText: null,
      existingDescription: null,
      domain: null,
      title: 'Python Machine Learning Tutorial',
    })
    expect(result.tags.length).toBeGreaterThanOrEqual(2)
    expect(result.tags.length).toBeLessThanOrEqual(4)
  })

  it('includes domain hint tags for github.com', () => {
    const result = enrich({
      bodyText: 'some content',
      existingDescription: null,
      domain: 'github.com',
      title: null,
    })
    const hasGithubTag = result.tags.some(
      (t) => t === 'open-source' || t === 'code' || t === 'github'
    )
    expect(hasGithubTag).toBe(true)
  })

  it('includes "video" tag for youtube.com domain', () => {
    const result = enrich({
      bodyText: 'watch this tutorial video',
      existingDescription: null,
      domain: 'youtube.com',
      title: null,
    })
    expect(result.tags).toContain('video')
  })

  it('tags are always lowercase', () => {
    const result = enrich({
      bodyText: 'React JavaScript TypeScript Programming Tutorial',
      existingDescription: null,
      domain: null,
      title: null,
    })
    result.tags.forEach((tag) => {
      expect(tag).toBe(tag.toLowerCase())
    })
  })

  it('tags count is between 2 and 4', () => {
    const result = enrich({
      bodyText: 'simple content',
      existingDescription: null,
      domain: null,
      title: null,
    })
    expect(result.tags.length).toBeGreaterThanOrEqual(2)
    expect(result.tags.length).toBeLessThanOrEqual(4)
  })

  it('returns existing description without override', () => {
    const result = enrich({
      bodyText: 'This body text should be ignored.',
      existingDescription: 'Already has one',
      domain: null,
      title: null,
    })
    expect(result.description).toBe('Already has one')
  })

  it('extracts first meaningful paragraph when existingDescription is null', () => {
    const result = enrich({
      bodyText: 'First paragraph here. Second paragraph.',
      existingDescription: null,
      domain: null,
      title: null,
    })
    expect(result.description).toBeTruthy()
    expect(result.description.length).toBeGreaterThan(0)
    expect(result.description.length).toBeLessThanOrEqual(160)
  })

  it('categorizes Technology from software/programming/api bodyText', () => {
    const result = enrich({
      bodyText: 'software programming api development code architecture patterns',
      existingDescription: null,
      domain: null,
      title: null,
    })
    expect(result.category).toBe('Technology')
  })

  it('categorizes Entertainment from movie/film content', () => {
    const result = enrich({
      bodyText: 'movie film cinema director actor actress award',
      existingDescription: null,
      domain: null,
      title: null,
    })
    expect(result.category).toBe('Entertainment')
  })

  it('returns "Other" when no category signals match', () => {
    const result = enrich({
      bodyText: 'asdf qwerty zxcv mnop random words',
      existingDescription: null,
      domain: null,
      title: null,
    })
    expect(result.category).toBe('Other')
  })

  it('returns EnrichmentResult shape: {tags, description, category}', () => {
    const result = enrich({
      bodyText: 'test content',
      existingDescription: null,
      domain: null,
      title: null,
    })
    expect(Array.isArray(result.tags)).toBe(true)
    expect(typeof result.description).toBe('string')
    expect(typeof result.category).toBe('string')
  })
})

describe('categorize()', () => {
  it('returns "Other" for empty string', () => {
    expect(categorize('')).toBe('Other')
  })

  it('returns a value from CATEGORIES', () => {
    const result = categorize('software programming code api')
    expect(CATEGORIES).toContain(result)
  })
})

describe('extractDescription()', () => {
  it('returns empty string when text is empty', () => {
    expect(extractDescription('')).toBe('')
  })

  it('extracts first paragraph with 20+ chars', () => {
    const result = extractDescription(
      'This is a meaningful paragraph with enough content. Another sentence here.'
    )
    expect(result.length).toBeGreaterThan(0)
  })

  it('truncates at approximately 150 chars on sentence boundary', () => {
    const longText =
      'First sentence is quite short. Second sentence adds more context and information about the topic at hand in detail. Third sentence is here too. Fourth sentence is here. Fifth sentence.'
    const result = extractDescription(longText)
    expect(result.length).toBeLessThanOrEqual(160)
  })

  it('returns empty string when no paragraph has 20+ chars', () => {
    const result = extractDescription('Hi. Ok. Yes.')
    expect(result).toBe('')
  })
})

describe('getDomainHints()', () => {
  it('returns tags for github.com', () => {
    const hints = getDomainHints('github.com')
    expect(hints.length).toBeGreaterThan(0)
    const hasCodeOrOS = hints.some((h) => h === 'code' || h === 'open-source')
    expect(hasCodeOrOS).toBe(true)
  })

  it('returns tags for youtube.com', () => {
    const hints = getDomainHints('youtube.com')
    expect(hints).toContain('video')
  })

  it('returns empty array for unknown domain', () => {
    const hints = getDomainHints('totally-unknown-xyz.com')
    expect(hints).toEqual([])
  })

  it('returns empty array for null domain', () => {
    const hints = getDomainHints(null)
    expect(hints).toEqual([])
  })

  it('supports subdomain matching for known domains', () => {
    const hints = getDomainHints('docs.github.com')
    expect(hints.length).toBeGreaterThan(0)
  })

  it('DOMAIN_HINTS map contains known entries', () => {
    expect('github.com' in DOMAIN_HINTS).toBe(true)
    expect('youtube.com' in DOMAIN_HINTS).toBe(true)
    expect('wikipedia.org' in DOMAIN_HINTS).toBe(true)
  })
})

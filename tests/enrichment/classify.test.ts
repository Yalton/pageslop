import { describe, it, expect } from 'vitest'
import {
  enrich,
  categorize,
  CATEGORIES,
  extractKeywords,
  buildTags,
  normalizeTag,
  isJunkToken,
} from '@/lib/enrichment/classify'
import { extractDescription } from '@/lib/enrichment/describe'
import { getDomainHints, DOMAIN_HINTS } from '@/lib/enrichment/domain-hints'

describe('enrich()', () => {
  it('returns 2-4 lowercase tags from bodyText with react/javascript', () => {
    const result = enrich({
      bodyText:
        'react javascript component hooks. react state management with javascript tutorial',
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

  it('tags count is at most 4 and never padded with generic fallbacks', () => {
    const result = enrich({
      bodyText: 'simple content',
      existingDescription: null,
      domain: null,
      title: null,
    })
    expect(result.tags.length).toBeLessThanOrEqual(4)
    for (const generic of ['link', 'saved', 'content', 'resource']) {
      expect(result.tags).not.toContain(generic)
    }
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

describe('isJunkToken()', () => {
  it('rejects tokens with fewer than three distinct letters', () => {
    expect(isJunkToken('ffffff')).toBe(true)
    expect(isJunkToken('aaa')).toBe(true)
    expect(isJunkToken('facade')).toBe(false)
  })

  it('rejects app chrome and site-wide footer words', () => {
    for (const w of ['tab', 'window', 'google', 'youtube', 'password', 'signed-in']) expect(isJunkToken(w)).toBe(true)
  })

  it('rejects sign-up form words (country pickers, resend code)', () => {
    for (const w of ['island', 'islands', 'south', 'resend']) expect(isJunkToken(w)).toBe(true)
  })

  it.each([
    'aboutpresscopyrightcontact', // concatenated footer links (>20 chars)
    '0-29b-a4b',
    '221f1f',
    'a4b2c9',
    'web3x9',
    'challenge-error-text',
    'a-b-c-d',
    '-foo',
    'foo-',
    'class',
    'iframe',
    'src',
    'href',
    'https',
    'http',
    'www',
    'html',
    'div',
    'span',
    'cookie',
    'cookies',
    'javascript-disabled-warning',
    'enable',
    'browser',
    'copyright',
    'ago',
    'please',
    'make',
    'need',
    'updated',
    'get',
    'one',
    'like',
    'just',
    '12345',
    'ab',
  ])('rejects %s', (token) => {
    expect(isJunkToken(token)).toBe(true)
  })

  it.each([
    'code',
    'cloud',
    'data',
    'linux',
    'python',
    'react',
    'agent',
    'kubernetes',
    'open-source',
    'machine-learning',
    'database',
  ])('accepts %s', (token) => {
    expect(isJunkToken(token)).toBe(false)
  })
})

describe('normalizeTag()', () => {
  it.each([
    ['agents', 'agent'],
    ['tools', 'tool'],
    ['videos', 'video'],
    ['databases', 'database'],
    ['libraries', 'library'],
    ['boxes', 'box'],
    ['matches', 'match'],
    ['classes', 'class'],
    ['movies', 'movie'],
    ['cookies', 'cookie'],
    ['ai-agents', 'ai-agent'],
    ['Agents', 'agent'],
    ['  Tools ', 'tool'],
  ])('folds %s -> %s', (input, expected) => {
    expect(normalizeTag(input)).toBe(expected)
  })

  it.each([
    'class',
    'linux',
    'news',
    'analysis',
    'status',
    'physics',
    'analytics',
    'series',
    'kubernetes',
    'css',
    'business',
    'bus',
  ])('leaves %s alone', (word) => {
    expect(normalizeTag(word)).toBe(word)
  })
})

describe('extractKeywords()', () => {
  it('drops keywords that occur only once', () => {
    const kws = extractKeywords('rust rust compiler borrow checker rust compiler')
    expect(kws).toEqual(['rust', 'compiler'])
  })

  it('merges plurals when counting', () => {
    const kws = extractKeywords('agents are great. an agent framework for building agent systems')
    expect(kws).toContain('agent')
    expect(kws).not.toContain('agents')
  })

  it('filters markup, hex and filler junk even when repeated', () => {
    const text =
      'class iframe src https 221f1f 0-29b-a4b challenge-error-text please make ago updated need enable ' +
      'class iframe src https 221f1f 0-29b-a4b challenge-error-text please make ago updated need enable ' +
      'kubernetes kubernetes'
    expect(extractKeywords(text)).toEqual(['kubernetes'])
  })
})

describe('buildTags()', () => {
  it('produces no junk tags from a YouTube-style junk page', () => {
    const text =
      'About Press Copyright Contact us Creators Advertise Developers Terms Privacy Policy & Safety ' +
      'How YouTube works Test new features 221f1f iframe src https class please enable javascript ' +
      'About Press Copyright Contact us Terms Privacy 2 days ago'
    const tags = buildTags(text, 'youtube.com')
    expect(tags).toContain('video')
    for (const junk of ['aboutpresscopyrightcontact', '221f1f', 'iframe', 'src', 'https', 'class', 'ago', 'please', 'enable', 'copyright', 'privacy', 'terms']) {
      expect(tags).not.toContain(junk)
    }
  })

  it('does not pad with generic fallback tags', () => {
    expect(buildTags('one lonely word', null)).toEqual([])
  })

  it('keeps domain hints even when body text has nothing repeated', () => {
    expect(buildTags('some content', 'github.com')).toEqual(['code', 'open-source'])
  })

  it('gives title words enough weight to become tags', () => {
    const tags = buildTags('', null, 'Python Machine Learning Tutorial')
    expect(tags).toEqual(expect.arrayContaining(['ai', 'code', 'learning']))
    expect(tags.length).toBeGreaterThanOrEqual(2)
    expect(tags.length).toBeLessThanOrEqual(4)
  })

  it('puts shared topic tags first, using the description and URL', () => {
    const tags = buildTags('', 'jellyfin.billbert.co', 'Jellyfin', {
      description: 'Stream your movie library',
      url: 'https://jellyfin.billbert.co/web',
    })
    expect(tags.slice(0, 2).sort()).toEqual(['media', 'self-hosted'])
  })

  it('keeps only keywords the user already has when knownTags is given', () => {
    const text = 'zorb bounce zorb bounce plushie plushie'
    expect(buildTags(text, null, 'Zorb Bounce', { knownTags: new Set(['plushie']) })).toEqual(['plushie'])
    expect(buildTags(text, null, 'Zorb Bounce', { knownTags: new Set() })).toEqual([])
  })

  it('drops keyword tags that repeat a chosen topic', () => {
    expect(buildTags('game game game', null, 'Steam game')).toEqual(['gaming'])
  })

  it('returns no duplicate singular/plural tags', () => {
    const tags = buildTags('agents agents agent tools tool tools', null)
    expect(tags).toEqual(expect.arrayContaining(['agent', 'tool']))
    expect(tags).not.toContain('agents')
    expect(tags).not.toContain('tools')
  })
})

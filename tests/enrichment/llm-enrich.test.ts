import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getMockCreate, MockAuthenticationError, MockRateLimitError } from '../setup'

// Valid EnrichInput for tests
const sampleInput = {
  bodyText: 'This is a TypeScript tutorial about async programming and React hooks.',
  existingDescription: null,
  domain: 'example.com',
  title: 'TypeScript Async Guide',
}

const validLLMResponse = {
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        tags: ['typescript', 'async', 'react', 'hooks', 'programming'],
        description: 'A comprehensive guide to TypeScript async programming with React hooks.',
        category: 'Technology',
      }),
    },
  ],
}

describe('llmEnrich', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { tags, description, category } matching EnrichmentResult shape', async () => {
    const mockCreate = getMockCreate()
    mockCreate.mockResolvedValueOnce(validLLMResponse)

    const { llmEnrich } = await import('@/lib/enrichment/llm-enrich')
    const result = await llmEnrich(sampleInput, 'sk-ant-test-key')

    expect(result).not.toBeNull()
    expect(result).toHaveProperty('tags')
    expect(result).toHaveProperty('description')
    expect(result).toHaveProperty('category')
    expect(typeof result!.description).toBe('string')
    expect(typeof result!.category).toBe('string')
  })

  it('returns tags array with 4-6 items', async () => {
    const mockCreate = getMockCreate()
    mockCreate.mockResolvedValueOnce(validLLMResponse)

    const { llmEnrich } = await import('@/lib/enrichment/llm-enrich')
    const result = await llmEnrich(sampleInput, 'sk-ant-test-key')

    expect(result).not.toBeNull()
    expect(Array.isArray(result!.tags)).toBe(true)
    expect(result!.tags.length).toBeGreaterThanOrEqual(4)
    expect(result!.tags.length).toBeLessThanOrEqual(6)
  })

  it('returns null when SDK throws AuthenticationError', async () => {
    const mockCreate = getMockCreate()
    mockCreate.mockRejectedValueOnce(new MockAuthenticationError('Bad key'))

    const { llmEnrich } = await import('@/lib/enrichment/llm-enrich')
    const result = await llmEnrich(sampleInput, 'sk-ant-bad-key')
    expect(result).toBeNull()
  })

  it('returns null when SDK throws RateLimitError', async () => {
    const mockCreate = getMockCreate()
    mockCreate.mockRejectedValueOnce(new MockRateLimitError('Rate limited'))

    const { llmEnrich } = await import('@/lib/enrichment/llm-enrich')
    const result = await llmEnrich(sampleInput, 'sk-ant-test-key')
    expect(result).toBeNull()
  })

  it('returns null when SDK throws generic Error', async () => {
    const mockCreate = getMockCreate()
    mockCreate.mockRejectedValueOnce(new Error('Network failure'))

    const { llmEnrich } = await import('@/lib/enrichment/llm-enrich')
    const result = await llmEnrich(sampleInput, 'sk-ant-test-key')
    expect(result).toBeNull()
  })
})

describe('llmEnrich prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function callAndGetRequest(input: Record<string, unknown>) {
    const mockCreate = getMockCreate()
    mockCreate.mockResolvedValueOnce(validLLMResponse)
    const { llmEnrich } = await import('@/lib/enrichment/llm-enrich')
    await llmEnrich({ ...sampleInput, ...input } as never, 'sk-ant-test-key')
    return mockCreate.mock.calls[0][0] as { system: string; messages: { content: string }[] }
  }

  it('includes the URL and existing description in the user message', async () => {
    const req = await callAndGetRequest({
      url: 'https://www.youtube.com/watch?v=abc',
      existingDescription: 'Official music video',
    })
    const msg = req.messages[0].content
    expect(msg).toContain('URL: https://www.youtube.com/watch?v=abc')
    expect(msg).toContain('Description: Official music video')
  })

  it('lists known tags and tells the model to prefer them', async () => {
    const req = await callAndGetRequest({ knownTags: new Set(['music', 'rust']) })
    const msg = req.messages[0].content
    expect(msg).toMatch(/Existing tags:.*music/)
    expect(msg).toContain('rust')
    expect(req.system).toMatch(/prefer.*existing tags/i)
  })

  it('omits the existing tags line when there are none', async () => {
    const req = await callAndGetRequest({ knownTags: new Set() })
    expect(req.messages[0].content).not.toContain('Existing tags')
  })

  it('strips boilerplate from the body excerpt', async () => {
    const footer = 'About Press Copyright Contact us Creators Advertise Developers Terms Privacy Policy & Safety How YouTube works Test new features'
    const req = await callAndGetRequest({ bodyText: `Great song lyrics ${footer}` })
    expect(req.messages[0].content).toContain('Great song lyrics')
    expect(req.messages[0].content).not.toContain('Press Copyright')
  })

  it('tells the model to pick the category by what the content is', async () => {
    const req = await callAndGetRequest({})
    expect(req.system).toMatch(/music video/i)
    expect(req.system).toContain('Entertainment')
  })
})

describe('validateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when SDK call succeeds', async () => {
    const mockCreate = getMockCreate()
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'Hi' }] })

    const { validateApiKey } = await import('@/lib/enrichment/llm-enrich')
    const result = await validateApiKey('sk-ant-valid-key')
    expect(result).toBe(true)
  })

  it('returns false when SDK throws AuthenticationError', async () => {
    const mockCreate = getMockCreate()
    mockCreate.mockRejectedValueOnce(new MockAuthenticationError('Bad key'))

    const { validateApiKey } = await import('@/lib/enrichment/llm-enrich')
    const result = await validateApiKey('sk-ant-invalid-key')
    expect(result).toBe(false)
  })
})

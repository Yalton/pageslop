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

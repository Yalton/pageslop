import { vi } from 'vitest'

// Set test environment variables
process.env.ENCRYPTION_KEY = '0'.repeat(64) // valid 64-char hex for tests
process.env.BETTER_AUTH_SECRET = 'test-secret-'.padEnd(40, 'x') // >= 32 chars, not a placeholder
process.env.BETTER_AUTH_URL = 'http://localhost:3000'

// Mock Neon serverless driver
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}))

// Mock Anthropic SDK — tests configure mockCreate per test
const mockCreate = vi.fn()
export function getMockCreate() { return mockCreate }

// Error classes exposed so tests can throw typed errors
export class MockAuthenticationError extends Error {
  status = 401
  constructor(msg = 'Authentication error') { super(msg); this.name = 'AuthenticationError' }
}
export class MockRateLimitError extends Error {
  status = 429
  constructor(msg = 'Rate limit error') { super(msg); this.name = 'RateLimitError' }
}

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: (...args: unknown[]) => mockCreate(...args),
    }
    constructor(_opts?: unknown) {}
    static AuthenticationError = MockAuthenticationError
    static RateLimitError = MockRateLimitError
  }
  return {
    default: MockAnthropic,
    AuthenticationError: MockAuthenticationError,
    RateLimitError: MockRateLimitError,
  }
})

// Mock pg Pool
vi.mock('pg', () => ({
  Pool: vi.fn(() => ({
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
  })),
}))

// Mock pg-boss (v12 uses named export {PgBoss})
vi.mock('pg-boss', () => {
  const MockPgBoss = vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    send: vi.fn(),
    work: vi.fn(),
    on: vi.fn(),
    schedule: vi.fn(),
    insert: vi.fn(),
    createQueue: vi.fn(),
  }))
  return {
    default: MockPgBoss,
    PgBoss: MockPgBoss,
  }
})

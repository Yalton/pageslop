import { vi } from 'vitest'

// Mock Neon serverless driver
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}))

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

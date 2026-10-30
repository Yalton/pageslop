// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }))

import OnboardingPage from '@/app/(dashboard)/onboarding/page'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

async function submit(url: string) {
  const user = userEvent.setup()
  render(<OnboardingPage />)
  await user.type(screen.getByPlaceholderText('Paste a link...'), url)
  await user.click(screen.getByRole('button', { name: 'Save Link' }))
}

describe('onboarding save', () => {
  it('shows an error and stays on the page when the save fails', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"bad"}', { status: 500 }))
    await submit('https://example.com')
    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save Link' })).toBeTruthy()
  })

  it('shows an error when the request itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'))
    await submit('https://example.com')
    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(push).not.toHaveBeenCalled()
  })

  it('skips straight to the dashboard', async () => {
    const user = userEvent.setup()
    render(<OnboardingPage />)
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(push).toHaveBeenCalledWith('/dashboard')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('goes to the dashboard when the save succeeds', async () => {
    fetchMock.mockResolvedValue(new Response('{"saved":[]}', { status: 201 }))
    await submit('https://example.com')
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'))
    expect(toastError).not.toHaveBeenCalled()
  })
})

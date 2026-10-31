// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const saveLinks = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/hooks/useLinks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/hooks/useLinks')>()),
  useLinks: () => ({ saveLinks }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function submit(url: string) {
  const { SaveURLInput } = await import('@/components/links/SaveURLInput')
  render(<SaveURLInput />)
  const input = screen.getByPlaceholderText(/paste a link/i)
  fireEvent.change(input, { target: { value: url } })
  fireEvent.submit(input.closest('form')!)
}

describe('SaveURLInput', () => {
  it("shows the server's reason when it refuses the save, such as a full queue", async () => {
    const { SaveLinksError } = await import('@/lib/hooks/useLinks')
    const message = 'You have 1,000 links waiting to be fetched; try again once some finish'
    saveLinks.mockRejectedValue(new SaveLinksError(message))
    await submit('https://example.com')
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(message, expect.anything()))
  })

  it('falls back to a generic message for other failures', async () => {
    saveLinks.mockRejectedValue(new TypeError('Failed to fetch'))
    await submit('https://example.com')
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/couldn't save/i), expect.anything()))
  })
})

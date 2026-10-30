// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import useSWR from 'swr'
import { DataProvider } from '@/components/providers/DataProvider'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

function Tags() {
  const { data } = useSWR<string[]>('/api/tags')
  return <p>{data ? data.join(',') : 'loading'}</p>
}

describe('DataProvider', () => {
  it('shows saved data and preloads under StrictMode without SWR errors', async () => {
    localStorage.setItem('pageslop-swr:user-1', JSON.stringify({ '/api/tags': ['saved'] }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => Response.json(url === '/api/tags' ? ['fresh'] : [])),
    )
    const errors: unknown[] = []
    const onError = (e: ErrorEvent) => errors.push(e.error)
    window.addEventListener('error', onError)

    await act(async () => {
      render(
        <StrictMode>
          <DataProvider userId="user-1">
            <Tags />
          </DataProvider>
        </StrictMode>,
      )
    })

    window.removeEventListener('error', onError)
    expect(errors).toEqual([])
    expect(await screen.findByText('fresh')).toBeTruthy()
  })
})

'use client'
import useSWR from 'swr'
import type { Link, LinkWithDuplicate, SaveLinksRequest } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useLinks() {
  const { data, error, isLoading, mutate } = useSWR<Link[]>('/api/links', fetcher, {
    revalidateOnFocus: true,
  })

  const hasPending = data?.some(l => l.status === 'pending') ?? false

  // Poll every 2s while any link is pending
  const { data: polledData } = useSWR<Link[]>(
    hasPending ? '/api/links' : null,
    fetcher,
    { refreshInterval: 2000 }
  )

  // Use polled data if available, otherwise main data
  const links = (hasPending ? polledData : data) ?? data ?? []

  async function saveLinks(urls: string, force = false): Promise<LinkWithDuplicate[]> {
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, force } satisfies SaveLinksRequest),
    })
    const { saved } = await res.json()

    // Optimistic update: prepend new links to current data
    mutate((current) => [...saved.filter((s: LinkWithDuplicate) => !s.duplicate), ...(current ?? [])], false)

    return saved
  }

  async function deleteLink(id: string): Promise<void> {
    // Optimistic removal
    mutate((current) => current?.filter(l => l.id !== id) ?? [], false)

    await fetch(`/api/links/${id}`, { method: 'DELETE' })
    mutate() // revalidate
  }

  async function undoDelete(link: Link): Promise<void> {
    // Re-add optimistically, then revalidate
    mutate((current) => [link, ...(current ?? [])], false)
    mutate() // server revalidate
  }

  return { links, isLoading, error, hasPending, saveLinks, deleteLink, undoDelete, mutate }
}

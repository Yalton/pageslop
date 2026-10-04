'use client'
import useSWR from 'swr'
import type { Link, LinkWithDuplicate, LinkWithTags, SaveLinksRequest, StashState } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useLinks() {
  const { data, error, isLoading, mutate } = useSWR<LinkWithTags[]>('/api/links', fetcher, {
    revalidateOnFocus: true,
  })

  const hasPending = data?.some(l => l.status === 'pending') ?? false

  // Poll every 2s while any link is pending
  const { data: polledData } = useSWR<LinkWithTags[]>(
    hasPending ? '/api/links' : null,
    fetcher,
    { refreshInterval: 2000 }
  )

  // Use polled data if available, otherwise main data
  const links: LinkWithTags[] = (hasPending ? polledData : data) ?? data ?? []

  async function saveLinks(urls: string, force = false): Promise<LinkWithDuplicate[]> {
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, force } satisfies SaveLinksRequest),
    })
    const { saved } = await res.json()

    // Optimistic update: prepend new links to current data
    mutate(
      (current) => [
        ...saved
          .filter((s: LinkWithDuplicate) => !s.duplicate)
          .map((s: LinkWithDuplicate) => ({ ...s, tags: [] })),
        ...(current ?? []),
      ],
      false
    )

    return saved
  }

  async function deleteLink(id: string): Promise<void> {
    // Optimistic removal
    mutate((current) => current?.filter(l => l.id !== id) ?? [], false)

    await fetch(`/api/links/${id}`, { method: 'DELETE' })
    mutate() // revalidate
  }

  async function undoDelete(link: Link): Promise<void> {
    // Re-add optimistically (cast Link to LinkWithTags with empty tags), then revalidate
    const linkWithTags: LinkWithTags = { ...link, tags: [] }
    mutate((current) => [linkWithTags, ...(current ?? [])], false)
    mutate() // server revalidate
  }

  async function addTag(linkId: string, name: string): Promise<void> {
    // Optimistic: add a temporary tag
    const tempTag = { id: `temp-${Date.now()}`, userId: '', name, source: 'user' as const }
    mutate(
      (current) =>
        current?.map(l =>
          l.id === linkId ? { ...l, tags: [...l.tags, tempTag] } : l
        ) ?? [],
      false
    )

    await fetch(`/api/links/${linkId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    mutate()
  }

  async function removeTag(linkId: string, tagId: string): Promise<void> {
    // Optimistic: remove the tag
    mutate(
      (current) =>
        current?.map(l =>
          l.id === linkId ? { ...l, tags: l.tags.filter(t => t.id !== tagId) } : l
        ) ?? [],
      false
    )

    await fetch(`/api/links/${linkId}/tags/${tagId}`, { method: 'DELETE' })
    mutate()
  }

  async function updateLink(
    linkId: string,
    data: { description?: string; category?: string; stashState?: StashState },
  ): Promise<void> {
    // Optimistic: merge new fields
    mutate(
      (current) =>
        current?.map(l => (l.id === linkId ? { ...l, ...data } : l)) ?? [],
      false
    )

    await fetch(`/api/links/${linkId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    mutate()
  }

  async function setStashState(ids: string[], stashState: StashState): Promise<void> {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const now = new Date()

    // Optimistic: restoring to the inbox restarts the expiry clock
    mutate(
      (current) =>
        current?.map((l) =>
          idSet.has(l.id)
            ? { ...l, stashState, ...(stashState === 'inbox' ? { stashedAt: now } : {}) }
            : l,
        ) ?? [],
      false,
    )

    const res = await fetch('/api/links/bulk-stash-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, stashState }),
    })
    await mutate()
    if (!res.ok) {
      throw new Error(`Failed to update ${ids.length} link(s) to ${stashState}`)
    }
  }

  async function checkLink(linkId: string): Promise<void> {
    await fetch(`/api/links/${linkId}/check`, { method: 'POST' })
    mutate()
  }

  return { links, isLoading, error, hasPending, saveLinks, deleteLink, undoDelete, addTag, removeTag, updateLink, setStashState, checkLink, mutate }
}

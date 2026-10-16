'use client'
import { useMemo, useSyncExternalStore } from 'react'
import useSWR, { type KeyedMutator } from 'swr'
import { toast } from 'sonner'
import type { Link, LinkWithDuplicate, LinkWithTags, SaveLinksRequest, StashState } from '@/types'
import { createPendingDeletes } from '@/lib/links/pending-deletes'
import { jsonFetcher as fetcher } from '@/lib/swr/fetcher'

// The dashboard's SWR cache is a custom provider (DataProvider), which the
// global `mutate` from 'swr' cannot reach, so deletes revalidate through the
// mutate of the most recently rendered useLinks.
let revalidateLinks: KeyedMutator<LinkWithTags[]> | null = null

// Shared by every useLinks caller, so a delete started in one view stays
// hidden in the others until it runs or is undone.
const BULK_MAX_IDS = 500

/** Splits ids into chunks the bulk routes accept. */
function chunks(ids: string[]): string[][] {
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += BULK_MAX_IDS) out.push(ids.slice(i, i + BULK_MAX_IDS))
  return out
}

const pendingDeletes = createPendingDeletes((ids) => {
  const failed = () =>
    toast.error(ids.length === 1 ? 'Could not delete link. Please try again.' : 'Could not delete links. Please try again.')
  // keepalive lets a delete flushed on pagehide outlive the page.
  Promise.all(
    chunks(ids).map((chunk) =>
      fetch('/api/links/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: chunk }),
        keepalive: true,
      }),
    ),
  )
    .then((responses) => { if (responses.some((res) => !res.ok)) failed() }, failed)
    .finally(() => void revalidateLinks?.())
})

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => pendingDeletes.flush())
}

export function useLinks() {
  const { data, error, isLoading, mutate } = useSWR<LinkWithTags[]>('/api/links', fetcher, {
    revalidateOnFocus: true,
  })
  revalidateLinks = mutate

  const hasPending = data?.some(l => l.status === 'pending') ?? false

  // Poll every 2s while any link is pending
  const { data: polledData } = useSWR<LinkWithTags[]>(
    hasPending ? '/api/links' : null,
    fetcher,
    { refreshInterval: 2000 }
  )

  // Use polled data if available, otherwise main data. Revalidation would
  // otherwise bring back links whose delete is still pending. Memoized so the
  // array keeps its identity across renders; the graph rebuilds and restarts
  // its simulation whenever it changes.
  const pendingVersion = useSyncExternalStore(
    pendingDeletes.subscribe,
    pendingDeletes.getVersion,
    pendingDeletes.getVersion,
  )
  const source = (hasPending ? polledData : data) ?? data
  const links: LinkWithTags[] = useMemo(
    () => (source ?? []).filter(l => !pendingDeletes.has(l.id)),
    // pendingVersion: recompute when a delete is scheduled, undone or run
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, pendingVersion],
  )

  async function saveLinks(urls: string): Promise<LinkWithDuplicate[]> {
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls } satisfies SaveLinksRequest),
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
    // Optimistic removal; the server delete waits out the undo window.
    mutate((current) => current?.filter(l => l.id !== id) ?? [], false)
    pendingDeletes.schedule(id)
  }

  async function undoDelete(link: Link): Promise<void> {
    if (!pendingDeletes.cancel(link.id)) {
      toast.error('Too late to undo, the link is already deleted.')
      return
    }
    mutate() // the row was never deleted, so revalidating brings it back with its tags
  }

  /** Deletes many links as one batch, after the same undo window as deleteLink. */
  function deleteLinks(ids: string[]): void {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    mutate((current) => current?.filter(l => !idSet.has(l.id)) ?? [], false)
    pendingDeletes.schedule(ids)
  }

  function undoDeletes(ids: string[]): void {
    const restored = ids.filter((id) => pendingDeletes.cancel(id))
    if (restored.length < ids.length) toast.error('Too late to undo, some links are already deleted.')
    if (restored.length > 0) mutate()
  }

  /** Adds one user tag to many links. Throws when the server refuses. */
  async function addTagToLinks(ids: string[], name: string): Promise<void> {
    const tagName = name.toLowerCase().trim()
    if (ids.length === 0 || !tagName) return
    const idSet = new Set(ids)
    const tempTag = { id: `temp-${Date.now()}`, userId: '', name: tagName, source: 'user' as const }
    mutate(
      (current) =>
        current?.map(l =>
          idSet.has(l.id) && !l.tags.some(t => t.name === tagName) ? { ...l, tags: [...l.tags, tempTag] } : l
        ) ?? [],
      false
    )
    const responses = await Promise.all(
      chunks(ids).map((chunk) =>
        fetch('/api/links/bulk-tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: chunk, name: tagName }),
        }),
      ),
    )
    await mutate()
    if (responses.some((res) => !res.ok)) throw new Error(`Failed to tag ${ids.length} link(s)`)
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

  /** null makes links ordinary saved links again (shown in All Links). */
  async function setStashState(ids: string[], stashState: StashState | null): Promise<void> {
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

    const responses = await Promise.all(
      chunks(ids).map((chunk) =>
        fetch('/api/links/bulk-stash-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: chunk, stashState }),
        }),
      ),
    )
    await mutate()
    if (responses.some((res) => !res.ok)) {
      throw new Error(`Failed to update ${ids.length} link(s) to ${stashState}`)
    }
  }

  async function checkLink(linkId: string): Promise<void> {
    await fetch(`/api/links/${linkId}/check`, { method: 'POST' })
    mutate()
  }

  return {
    // SWR reports isLoading while it revalidates data restored from the saved
    // cache; pages only need to wait when there is nothing to show.
    links, isLoading: isLoading && !data, error, hasPending, saveLinks, deleteLink, undoDelete, deleteLinks, undoDeletes,
    addTag, addTagToLinks, removeTag, updateLink, setStashState, checkLink, mutate,
  }
}

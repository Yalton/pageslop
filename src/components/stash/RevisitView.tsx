'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Archive, Bookmark, ExternalLink, Inbox } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { SearchInput } from '@/components/links/SearchInput'
import { useLinks } from '@/lib/hooks/useLinks'
import { groupByDomain, groupLinks } from '@/lib/utils/group-links'
import { filterLinks } from '@/lib/utils/search'
import { cn } from '@/lib/utils'
import {
  needsDismissConfirm,
  openAllUrls,
  rowMeta,
  selectRevisitLinks,
} from '@/lib/stash/revisit'
import type { LinkWithTags, StashState } from '@/types'

type GroupMode = 'domain' | 'topic'

/**
 * Opens a URL in a new tab and returns the window handle, or null when the
 * browser blocked the pop-up. `noopener` is deliberately NOT passed as a
 * window feature: with it, window.open always returns null and blocked tabs
 * become indistinguishable from opened ones. The opener is cut manually instead.
 */
function openTab(url: string): Window | null {
  const handle = window.open(url, '_blank')
  if (handle) handle.opener = null
  return handle
}

export function RevisitView() {
  const { links, isLoading, error, setStashState } = useLinks()
  const [mode, setMode] = useState<GroupMode>('domain')
  const [query, setQuery] = useState('')

  const revisitLinks = useMemo(() => selectRevisitLinks(links), [links])
  const visible = useMemo(() => filterLinks(revisitLinks, query, null), [revisitLinks, query])
  const groups = useMemo(
    () => (mode === 'domain' ? groupByDomain(visible) : groupLinks(visible)),
    [mode, visible],
  )

  async function applyState(ids: string[], state: StashState, successMessage?: string) {
    try {
      await setStashState(ids, state)
      if (successMessage) toast.success(successMessage)
    } catch {
      toast.error('Could not update links. Please try again.')
    }
  }

  function handleOpenAll(groupLinksList: LinkWithTags[]) {
    const { openedIds, blockedCount } = openAllUrls(
      groupLinksList.map((l) => ({ id: l.id, url: l.url })),
      openTab,
    )
    const toMark = openedIds.filter((id) => groupLinksList.find((l) => l.id === id)?.stashState === 'inbox')
    if (toMark.length > 0) void applyState(toMark, 'read')
    if (blockedCount > 0) {
      toast.error(
        `Your browser blocked ${blockedCount} tab${blockedCount === 1 ? '' : 's'}. Allow pop-ups for this site, then try Open all again.`,
        { duration: 8000 },
      )
    }
  }

  function handleDismissAll(name: string, groupLinksList: LinkWithTags[]) {
    if (
      needsDismissConfirm(groupLinksList.length) &&
      !window.confirm(`Dismiss all ${groupLinksList.length} links in ${name}? They will be archived.`)
    ) {
      return
    }
    void applyState(
      groupLinksList.map((l) => l.id),
      'archived',
      `Dismissed ${groupLinksList.length} link${groupLinksList.length === 1 ? '' : 's'}`,
    )
  }

  if (isLoading) {
    return <PageSpinner label="Loading links" />
  }

  if (error && revisitLinks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-24 text-center" role="alert">
        <AlertCircle className="size-10 text-destructive mb-4" />
        <h2 className="text-[20px] font-semibold leading-[1.2] mb-2">Could not load your links</h2>
        <p className="text-sm text-muted-foreground max-w-sm">Check your connection and reload the page.</p>
      </div>
    )
  }

  if (revisitLinks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-24 text-center">
        <div className="empty-icon"><Inbox className="size-7" /></div>
        <h2 className="text-[20px] font-semibold leading-[1.2] mb-2">Nothing to revisit</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Tabs saved by the browser extension show up here. Set it up from the{' '}
          <Link href="/dashboard/settings#browser-extension" className="underline underline-offset-4 hover:text-foreground">
            Browser extension settings
          </Link>
          .
        </p>
      </div>
    )
  }

  const now = new Date()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <SearchInput value={query} onChange={setQuery} />
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Group by">
          <Toggle
            size="sm"
            pressed={mode === 'domain'}
            onPressedChange={() => setMode('domain')}
            aria-label="Group by domain"
          >
            Domain
          </Toggle>
          <Toggle
            size="sm"
            pressed={mode === 'topic'}
            onPressedChange={() => setMode('topic')}
            aria-label="Group by topic"
          >
            Topic
          </Toggle>
        </div>
      </div>

      {visible.length === 0 && query && (
        <p className="text-sm text-muted-foreground">No links match &ldquo;{query}&rdquo;.</p>
      )}

      {[...groups.entries()].map(([name, groupItems]) => (
        <section key={name} className="flex flex-col gap-2">
          <header className="flex flex-wrap items-center gap-2">
            {mode === 'domain' && (
              <Avatar className="size-5 shrink-0">
                <AvatarImage src={groupItems.find((l) => l.favicon)?.favicon || undefined} alt="" />
                <AvatarFallback className="text-[9px]">{name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            )}
            <h2 className="text-sm font-semibold">
              {name}{' '}
              <span className="text-muted-foreground font-normal">({groupItems.length})</span>
            </h2>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => handleOpenAll(groupItems)}>
                <ExternalLink className="size-4" />
                Open all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void applyState(
                    groupItems.map((l) => l.id),
                    'kept',
                    `Kept ${groupItems.length} link${groupItems.length === 1 ? '' : 's'}`,
                  )
                }
              >
                <Bookmark className="size-4" />
                Keep all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDismissAll(name, groupItems)}>
                <Archive className="size-4" />
                Dismiss all
              </Button>
            </div>
          </header>

          <ul className="flex flex-col border rounded-lg overflow-hidden">
            {groupItems.map((link) => (
              <RevisitRow
                key={link.id}
                link={link}
                now={now}
                onOpen={() => {
                  if (link.stashState === 'inbox') void applyState([link.id], 'read')
                }}
                onKeep={() => void applyState([link.id], 'kept')}
                onDismiss={() => void applyState([link.id], 'archived')}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function RevisitRow({
  link,
  now,
  onOpen,
  onKeep,
  onDismiss,
}: {
  link: LinkWithTags
  now: Date
  onOpen: () => void
  onKeep: () => void
  onDismiss: () => void
}) {
  const meta = rowMeta(link.stashedAt, now)
  const tags = link.tags?.slice(0, 3) ?? []

  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 border-b last:border-b-0',
        link.stashState === 'read' && 'opacity-60',
      )}
    >
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onOpen}
        className="text-sm font-medium truncate min-w-0 flex-1 hover:underline underline-offset-4"
        title={link.url}
      >
        {link.title || link.url}
      </a>

      {link.category && link.category !== 'Other' && (
        <Badge variant="outline" className="text-xs shrink-0">
          {link.category}
        </Badge>
      )}

      {tags.map((tag) => (
        <Badge key={tag.id} variant="secondary" className="text-xs shrink-0">
          {tag.name}
        </Badge>
      ))}

      {meta.stashedLabel && (
        <span className="text-xs text-muted-foreground shrink-0">{meta.stashedLabel}</span>
      )}
      {meta.expiryLabel && (
        <span className="text-xs font-medium text-destructive shrink-0">{meta.expiryLabel}</span>
      )}

      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" onClick={onKeep} aria-label={`Keep ${link.title || link.url}`}>
          Keep
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss} aria-label={`Dismiss ${link.title || link.url}`}>
          Dismiss
        </Button>
      </div>
    </li>
  )
}

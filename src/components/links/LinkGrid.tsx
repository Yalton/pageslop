'use client'

import { useState, useEffect, useMemo } from 'react'
import { LayoutGrid, List, Layers } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Toggle } from '@/components/ui/toggle'
import { Button } from '@/components/ui/button'
import { LinkCard } from '@/components/links/LinkCard'
import { LinkCardList } from '@/components/links/LinkCardList'
import { LinkDetail } from '@/components/links/LinkDetail'
import { SaveURLInput } from '@/components/links/SaveURLInput'
import { SearchInput } from '@/components/links/SearchInput'
import { TagFilterChip } from '@/components/links/TagFilterChip'
import { GroupedView } from '@/components/links/GroupedView'
import { filterLinks } from '@/lib/utils/search'
import { allLinksEmptyState, filterAllLinksView, filterArchivedView } from '@/lib/utils/all-links-filter'
import { toast } from 'sonner'
import { useLinks } from '@/lib/hooks/useLinks'
import type { LinkWithTags } from '@/types'

type ViewMode = 'grid' | 'list' | 'grouped'
const STORAGE_KEY = 'pageslop-view-mode'

/** 'all' is All Links; 'archived' lists dismissed or expired stash links so they can be restored. */
export type LinkGridView = 'all' | 'archived'

const BASE_PATH: Record<LinkGridView, string> = {
  all: '/dashboard',
  archived: '/dashboard/archived',
}

export function LinkGrid({ view = 'all' }: { view?: LinkGridView }) {
  const { links, isLoading, deleteLink, undoDelete, setStashState, mutate } = useLinks()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const searchParams = useSearchParams()
  const router = useRouter()
  const tagFilter = searchParams.get('tag')

  // Derive selectedLink from SWR data so it stays in sync after mutations
  const selectedLink = selectedLinkId ? links.find(l => l.id === selectedLinkId) ?? null : null

  // inbox/read links live on /dashboard/revisit; hide them here
  const visibleLinks = useMemo(
    () => (view === 'archived' ? filterArchivedView(links) : filterAllLinksView(links)),
    [links, view]
  )
  const emptyState = view === 'archived' ? null : allLinksEmptyState(links)

  // Filter links client-side using search query and tag filter
  const filteredLinks = useMemo(
    () => filterLinks(visibleLinks, searchQuery, tagFilter),
    [visibleLinks, searchQuery, tagFilter]
  )

  async function handleRestore(id: string) {
    try {
      await setStashState([id], 'inbox')
      toast.success('Restored to inbox')
    } catch {
      toast.error('Could not restore link. Please try again.')
    }
  }

  // Load view mode from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'grid' || stored === 'list' || stored === 'grouped') {
      setViewMode(stored)
    }
  }, [])

  function handleViewMode(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem(STORAGE_KEY, mode)
  }

  function handleOpenDetail(link: LinkWithTags) {
    setSelectedLinkId(link.id)
    setDetailOpen(true)
  }

  function handleCloseDetail() {
    setDetailOpen(false)
    setSelectedLinkId(null)
  }

  function handleTagClick(tagName: string) {
    router.push(`${BASE_PATH[view]}?tag=${encodeURIComponent(tagName)}`)
  }

  function handleClearTagFilter() {
    router.push(BASE_PATH[view])
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar: URL input + search + view toggle */}
      <div className="flex items-start gap-2 flex-wrap">
        {view === 'all' && (
          <div className="flex-1 min-w-[200px]">
            <SaveURLInput />
          </div>
        )}
        <div className="flex-1 min-w-[160px] max-w-sm">
          <SearchInput value={searchQuery} onChange={setSearchQuery} />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Toggle
            pressed={viewMode === 'grid'}
            onPressedChange={(pressed) => pressed && handleViewMode('grid')}
            aria-label="Grid view"
            size="sm"
          >
            <LayoutGrid className="size-4" />
          </Toggle>
          <Toggle
            pressed={viewMode === 'list'}
            onPressedChange={(pressed) => pressed && handleViewMode('list')}
            aria-label="List view"
            size="sm"
          >
            <List className="size-4" />
          </Toggle>
          <Toggle
            pressed={viewMode === 'grouped'}
            onPressedChange={(pressed) => pressed && handleViewMode('grouped')}
            aria-label="Grouped view"
            size="sm"
          >
            <Layers className="size-4" />
          </Toggle>
        </div>
      </div>

      {/* Active tag filter chip */}
      {tagFilter && (
        <TagFilterChip tag={tagFilter} onClear={handleClearTagFilter} />
      )}

      {/* Empty state */}
      {emptyState === 'all-in-revisit' && !isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 py-24 text-center">
          <h2 className="text-[20px] font-semibold leading-[1.2] mb-2">Everything is in To Revisit</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            All your links are tabs the extension saved.{' '}
            <Link href="/dashboard/revisit" className="underline underline-offset-4 hover:text-foreground">
              Go to To Revisit
            </Link>{' '}
            to read or keep them, or paste a URL above to save a link here.
          </p>
        </div>
      )}

      {view === 'archived' && visibleLinks.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 py-24 text-center">
          <h2 className="text-[20px] font-semibold leading-[1.2] mb-2">No archived links</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Tabs you dismiss in To Revisit, or that sit there unread too long, end up here. Restore one to send it back to
            your inbox.
          </p>
        </div>
      )}

      {emptyState === 'no-links' && !isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 py-24 text-center">
          <h2 className="text-[20px] font-semibold leading-[1.2] mb-2">No links yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Paste a URL above to save your first link. We&apos;ll grab the title, image, and details automatically.
          </p>
        </div>
      )}

      {/* No results state */}
      {visibleLinks.length > 0 && filteredLinks.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-16 text-center gap-3">
          {searchQuery ? (
            <>
              <p className="text-sm text-muted-foreground">
                No links match &quot;{searchQuery}&quot;
              </p>
              <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                Clear search
              </Button>
            </>
          ) : tagFilter ? (
            <>
              <p className="text-sm text-muted-foreground">
                No links with tag &quot;{tagFilter}&quot;
              </p>
              <Button variant="ghost" size="sm" onClick={handleClearTagFilter}>
                Clear filter
              </Button>
            </>
          ) : null}
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && filteredLinks.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}
        >
          {filteredLinks.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              onDelete={deleteLink}
              onUndoDelete={undoDelete}
              onOpenDetail={handleOpenDetail}
              onTagClick={handleTagClick}
              onRestore={handleRestore}
            />
          ))}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && filteredLinks.length > 0 && (
        <div className="flex flex-col border rounded-lg overflow-hidden">
          {filteredLinks.map((link) => (
            <LinkCardList
              key={link.id}
              link={link}
              onDelete={deleteLink}
              onUndoDelete={undoDelete}
              onOpenDetail={handleOpenDetail}
              onTagClick={handleTagClick}
              onRestore={handleRestore}
            />
          ))}
        </div>
      )}

      {/* Grouped view */}
      {viewMode === 'grouped' && filteredLinks.length > 0 && (
        <GroupedView
          links={filteredLinks}
          subMode="grid"
          onDelete={deleteLink}
          onUndoDelete={undoDelete}
          onOpenDetail={handleOpenDetail}
          onTagClick={handleTagClick}
          onRestore={handleRestore}
        />
      )}

      {/* Link detail dialog/sheet */}
      <LinkDetail
        link={selectedLink}
        open={detailOpen}
        onClose={handleCloseDetail}
        onDelete={deleteLink}
        onUndoDelete={undoDelete}
        onMutate={() => mutate()}
      />
    </div>
  )
}

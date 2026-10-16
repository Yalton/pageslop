'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { LayoutGrid, List, Layers, ListChecks, Trash2 } from 'lucide-react'
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
import { BulkActionBar } from '@/components/links/BulkActionBar'
import { LinkViewToolbar } from '@/components/links/LinkViewToolbar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UNDO_WINDOW_MS } from '@/lib/links/pending-deletes'
import { PageSpinner } from '@/components/ui/spinner'
import { groupLinks } from '@/lib/utils/group-links'
import { groupIdsByState, restoreTarget, toggleSelection } from '@/lib/utils/selection'
import { filterLinks } from '@/lib/utils/search'
import {
  applyLinkView,
  categoryOptions,
  domainOptions,
  hasActiveLinkFilters,
  linkViewQuery,
  parseLinkView,
  type LinkViewPatch,
} from '@/lib/utils/link-view'
import { allLinksEmptyState, filterAllLinksView, filterArchivedView } from '@/lib/utils/all-links-filter'
import { toast } from 'sonner'
import { useLinks } from '@/lib/hooks/useLinks'
import type { LinkWithTags, StashState } from '@/types'

type ViewMode = 'grid' | 'list' | 'grouped'
const STORAGE_KEY = 'pageslop-view-mode'

/** 'all' is All Links; 'archived' lists dismissed or expired stash links so they can be restored. */
export type LinkGridView = 'all' | 'archived'

const BASE_PATH: Record<LinkGridView, string> = {
  all: '/dashboard',
  archived: '/dashboard/archived',
}

export function LinkGrid({ view = 'all' }: { view?: LinkGridView }) {
  const { links, isLoading, deleteLink, undoDelete, deleteLinks, undoDeletes, addTagToLinks, setStashState, mutate } =
    useLinks()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const selectAnchor = useRef<string | null>(null)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)

  const searchParams = useSearchParams()
  const router = useRouter()
  const tagFilter = searchParams.get('tag')
  const linkView = useMemo(() => parseLinkView(searchParams), [searchParams])

  // Derive selectedLink from SWR data so it stays in sync after mutations
  const selectedLink = selectedLinkId ? links.find(l => l.id === selectedLinkId) ?? null : null

  // inbox/read links live on /dashboard/revisit; hide them here
  const visibleLinks = useMemo(
    () => (view === 'archived' ? filterArchivedView(links) : filterAllLinksView(links)),
    [links, view]
  )
  const emptyState = view === 'archived' ? null : allLinksEmptyState(links)

  // Filter and sort client-side: tag and search, then the toolbar's filters and sort
  const filteredLinks = useMemo(
    () => applyLinkView(filterLinks(visibleLinks, searchQuery, tagFilter), linkView),
    [visibleLinks, searchQuery, tagFilter, linkView]
  )
  const domains = useMemo(() => domainOptions(visibleLinks), [visibleLinks])
  const categories = useMemo(() => categoryOptions(visibleLinks), [visibleLinks])
  const filtersActive = hasActiveLinkFilters(linkView)

  // Order the links appear on screen, for shift-click ranges.
  const displayOrder = useMemo(
    () => (viewMode === 'grouped' ? [...groupLinks(filteredLinks).values()].flat() : filteredLinks).map((l) => l.id),
    [viewMode, filteredLinks]
  )
  // Selected links still on screen; a search or filter can hide some.
  const selectedLinks = useMemo(() => filteredLinks.filter((l) => selectedIds.has(l.id)), [filteredLinks, selectedIds])
  const selecting = selectMode || selectedIds.size > 0
  const tagSuggestions = useMemo(
    () => [...new Set(links.flatMap((l) => l.tags.map((t) => t.name)))].sort(),
    [links]
  )

  function handleToggleSelect(id: string, shiftKey: boolean) {
    setSelectedIds((current) => toggleSelection(current, displayOrder, id, shiftKey, selectAnchor.current))
    if (!shiftKey) selectAnchor.current = id
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setSelectMode(false)
    selectAnchor.current = null
  }

  useEffect(() => {
    if (!selecting) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selecting])

  /** Sets each link back to the state it had, one bulk call per state. */
  async function restoreStates(previous: Map<string, StashState | null>) {
    for (const [state, ids] of groupIdsByState(previous)) await setStashState(ids, state)
  }

  async function restoreLinks(targets: LinkWithTags[]) {
    try {
      await restoreStates(new Map(targets.map((l) => [l.id, restoreTarget(l)])))
      toast.success(targets.length === 1 ? 'Link restored' : `${targets.length} links restored`)
    } catch {
      toast.error('Could not restore. Please try again.')
    }
  }

  async function archiveLinks(targets: LinkWithTags[]) {
    const previous = new Map(targets.map((l) => [l.id, l.stashState]))
    try {
      await setStashState([...previous.keys()], 'archived')
      toast(targets.length === 1 ? 'Link archived' : `${targets.length} links archived`, {
        duration: UNDO_WINDOW_MS,
        action: { label: 'Undo', onClick: () => void restoreStates(previous).catch(() => toast.error('Could not undo.')) },
      })
    } catch {
      toast.error('Could not archive. Please try again.')
    }
  }

  function removeLinks(targets: LinkWithTags[]) {
    const ids = targets.map((l) => l.id)
    deleteLinks(ids)
    toast(ids.length === 1 ? 'Link deleted' : `${ids.length} links deleted`, {
      duration: UNDO_WINDOW_MS,
      action: { label: 'Undo', onClick: () => undoDeletes(ids) },
    })
  }

  function handleRestore(id: string) {
    const link = links.find((l) => l.id === id)
    if (link) void restoreLinks([link])
  }

  function handleArchive(id: string) {
    const link = links.find((l) => l.id === id)
    if (link) void archiveLinks([link])
  }

  async function handleBulkTag(name: string) {
    const count = selectedLinks.length
    try {
      await addTagToLinks(selectedLinks.map((l) => l.id), name)
      toast.success(`Tagged ${count} ${count === 1 ? 'link' : 'links'} "${name.toLowerCase().trim()}"`)
      clearSelection()
    } catch {
      toast.error('Could not add the tag. Please try again.')
      throw new Error('bulk tag failed')
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

  function viewHref(patch: LinkViewPatch) {
    const query = linkViewQuery(new URLSearchParams(searchParams.toString()), patch)
    return query ? `${BASE_PATH[view]}?${query}` : BASE_PATH[view]
  }

  /** Toolbar changes replace the history entry so Back leaves the page instead of undoing each tweak. */
  function handleViewChange(patch: LinkViewPatch) {
    router.replace(viewHref(patch), { scroll: false })
  }

  function handleClearFilters() {
    handleViewChange({ domain: null, category: null, untagged: false, described: false })
  }

  function handleTagClick(tagName: string) {
    router.push(viewHref({ tag: tagName }))
  }

  function handleClearTagFilter() {
    router.push(viewHref({ tag: null }))
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
            pressed={selecting}
            onPressedChange={(pressed) => (pressed ? setSelectMode(true) : clearSelection())}
            aria-label="Select links"
            size="sm"
          >
            <ListChecks className="size-4" />
          </Toggle>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
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

      {visibleLinks.length > 0 && (
        <LinkViewToolbar view={linkView} domains={domains} categories={categories} onChange={handleViewChange} />
      )}

      {view === 'archived' && visibleLinks.length > 0 && (
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {visibleLinks.length} archived {visibleLinks.length === 1 ? 'link' : 'links'}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDeleteAll(true)}
          >
            <Trash2 className="size-4" />
            Delete all
          </Button>
        </div>
      )}

      {/* Active tag filter chip */}
      {tagFilter && (
        <TagFilterChip tag={tagFilter} onClear={handleClearTagFilter} />
      )}

      {isLoading && links.length === 0 && <PageSpinner label="Loading links" />}

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
          ) : filtersActive ? (
            <>
              <p className="text-sm text-muted-foreground">No links match these filters</p>
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear filters
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
              onArchive={handleArchive}
              selecting={selecting}
              selected={selectedIds.has(link.id)}
              onToggleSelect={handleToggleSelect}
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
              onArchive={handleArchive}
              selecting={selecting}
              selected={selectedIds.has(link.id)}
              onToggleSelect={handleToggleSelect}
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
          onArchive={handleArchive}
          selecting={selecting}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
        />
      )}

      {selecting && (
        <BulkActionBar
          count={selectedLinks.length}
          total={filteredLinks.length}
          onSelectAll={() => setSelectedIds(new Set(filteredLinks.map((l) => l.id)))}
          onClear={clearSelection}
          onDelete={() => {
            removeLinks(selectedLinks)
            clearSelection()
          }}
          onAddTag={handleBulkTag}
          onArchive={view === 'all' ? () => { void archiveLinks(selectedLinks); clearSelection() } : undefined}
          onRestore={view === 'archived' ? () => { void restoreLinks(selectedLinks); clearSelection() } : undefined}
          tagSuggestions={tagSuggestions}
        />
      )}

      <Dialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete all {visibleLinks.length} archived {visibleLinks.length === 1 ? 'link' : 'links'}?
            </DialogTitle>
            <DialogDescription>
              They are removed for good once the undo window passes ({UNDO_WINDOW_MS / 1000} seconds).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteAll(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                removeLinks(visibleLinks)
                clearSelection()
                setConfirmDeleteAll(false)
              }}
            >
              Delete all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link detail dialog/sheet */}
      <LinkDetail
        link={selectedLink}
        open={detailOpen}
        onClose={handleCloseDetail}
        onDelete={deleteLink}
        onUndoDelete={undoDelete}
        onMutate={() => mutate()}
        onTagClick={(tagName) => {
          handleCloseDetail()
          handleTagClick(tagName)
        }}
      />
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Archive, Globe, LayoutGrid, List, Layers, ListChecks, Trash2 } from 'lucide-react'
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
import { SiteTabs } from '@/components/links/SiteTabs'
import { ShortcutHelp } from '@/components/links/ShortcutHelp'
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
import { groupLinksBySite, siteFavicons } from '@/lib/utils/site-tabs'
import { groupIdsByState, restoreTarget, toggleSelection } from '@/lib/utils/selection'
import { filterLinks } from '@/lib/utils/search'
import {
  CLEAR_ALL_FILTERS,
  applyLinkView,
  categoryOptions,
  domainOptions,
  statusOptions,
  emptyFilterMessage,
  linkViewHref,
  parseLinkView,
  type LinkViewPatch,
} from '@/lib/utils/link-view'
import { allLinksEmptyState, filterAllLinksView, filterArchivedView } from '@/lib/utils/all-links-filter'
import { toast } from 'sonner'
import { useLinks } from '@/lib/hooks/useLinks'
import { useViewEnterAnimation } from '@/lib/hooks/useViewEnterAnimation'
import { useLinkShortcuts } from '@/lib/hooks/useLinkShortcuts'
import { viewTransitionKey } from '@/lib/utils/view-transition'
import type { LinkWithTags, StashState } from '@/types'

/** 'grouped' is sections per category, 'site' sections per website. */
type ViewMode = 'grid' | 'list' | 'grouped' | 'site'
const VIEW_MODES: readonly string[] = ['grid', 'list', 'grouped', 'site']
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
  const [websiteFilterOpen, setWebsiteFilterOpen] = useState(false)
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const saveRef = useRef<HTMLDivElement>(null)

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
  const statuses = useMemo(() => statusOptions(visibleLinks), [visibleLinks])
  const favicons = useMemo(() => siteFavicons(visibleLinks), [visibleLinks])
  const noMatchMessage = emptyFilterMessage(searchQuery, tagFilter, linkView)
  // Results fade in when the user changes the view, not when SWR refreshes the data.
  const resultsRef = useViewEnterAnimation<HTMLDivElement>(
    viewTransitionKey({ ...linkView, tag: tagFilter, mode: viewMode })
  )

  useLinkShortcuts({ search: searchRef, save: saveRef, results: resultsRef, onHelp: () => setShortcutHelpOpen(true) })

  // Order the links appear on screen, for shift-click ranges.
  const displayOrder = useMemo(() => {
    const ordered =
      viewMode === 'grouped'
        ? [...groupLinks(filteredLinks).values()].flat()
        : viewMode === 'site'
          ? [...groupLinksBySite(filteredLinks, linkView.sort).values()].flat()
          : filteredLinks
    return ordered.map((l) => l.id)
  }, [viewMode, filteredLinks, linkView.sort])
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
    if (stored && VIEW_MODES.includes(stored)) {
      setViewMode(stored as ViewMode)
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
    return linkViewHref(BASE_PATH[view], new URLSearchParams(searchParams.toString()), patch)
  }

  /** Toolbar changes replace the history entry so Back leaves the page instead of undoing each tweak. */
  function handleViewChange(patch: LinkViewPatch) {
    router.replace(viewHref(patch), { scroll: false })
  }

  /** Clears search, tag and facet filters together, so an empty result always has one way out. */
  function handleClearAllFilters() {
    setSearchQuery('')
    handleViewChange(CLEAR_ALL_FILTERS)
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
          <div ref={saveRef} className="flex-1 min-w-[200px]">
            <SaveURLInput />
          </div>
        )}
        <div ref={searchRef} className="flex-1 min-w-[160px] max-w-sm">
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
            aria-label="Group by category"
            title="Group by category"
            size="sm"
          >
            <Layers className="size-4" />
            <span className="hidden sm:inline">Category</span>
          </Toggle>
          <Toggle
            pressed={viewMode === 'site'}
            onPressedChange={(pressed) => pressed && handleViewMode('site')}
            aria-label="Group by site"
            title="Group by site"
            size="sm"
          >
            <Globe className="size-4" />
            <span className="hidden sm:inline">Site</span>
          </Toggle>
        </div>
      </div>

      {visibleLinks.length > 0 && (
        <LinkViewToolbar
          view={linkView}
          domains={domains}
          categories={categories}
          statuses={statuses}
          onChange={handleViewChange}
          websiteOpen={websiteFilterOpen}
          onWebsiteOpenChange={setWebsiteFilterOpen}
        />
      )}

      {visibleLinks.length > 0 && (domains.length > 1 || linkView.domain) && (
        <SiteTabs
          domains={domains}
          selected={linkView.domain}
          favicons={favicons}
          total={visibleLinks.length}
          onSelect={(domain) => handleViewChange({ domain })}
          onMore={() => setWebsiteFilterOpen(true)}
        />
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
          <div className="empty-icon"><Archive className="size-7" /></div>
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

      {/* Results: one animated region so view changes fade in instead of snapping */}
      <div ref={resultsRef} className="flex flex-1 flex-col empty:hidden">
      {/* No results state */}
      {visibleLinks.length > 0 && filteredLinks.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-16 text-center gap-3">
          {noMatchMessage && (
            <>
              <p className="text-sm text-muted-foreground">{noMatchMessage}</p>
              <Button variant="ghost" size="sm" onClick={handleClearAllFilters}>
                Clear all filters
              </Button>
            </>
          )}
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && filteredLinks.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '26px 16px',
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
      {(viewMode === 'grouped' || viewMode === 'site') && filteredLinks.length > 0 && (
        <GroupedView
          key={viewMode}
          links={filteredLinks}
          subMode="grid"
          groupBy={viewMode === 'site' ? 'site' : 'category'}
          sort={linkView.sort}
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
      </div>

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

      <ShortcutHelp open={shortcutHelpOpen} onOpenChange={setShortcutHelpOpen} />

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

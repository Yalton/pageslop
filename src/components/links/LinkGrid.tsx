'use client'

import { useState, useEffect } from 'react'
import { LayoutGrid, List } from 'lucide-react'
import { Toggle } from '@/components/ui/toggle'
import { LinkCard } from '@/components/links/LinkCard'
import { LinkCardList } from '@/components/links/LinkCardList'
import { LinkDetail } from '@/components/links/LinkDetail'
import { SaveURLInput } from '@/components/links/SaveURLInput'
import { useLinks } from '@/lib/hooks/useLinks'
import type { Link } from '@/types'

type ViewMode = 'grid' | 'list'
const STORAGE_KEY = 'pageslop-view-mode'

export function LinkGrid() {
  const { links, isLoading, deleteLink, undoDelete } = useLinks()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedLink, setSelectedLink] = useState<Link | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Load view mode from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'grid' || stored === 'list') {
      setViewMode(stored)
    }
  }, [])

  function handleViewMode(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem(STORAGE_KEY, mode)
  }

  function handleOpenDetail(link: Link) {
    setSelectedLink(link)
    setDetailOpen(true)
  }

  function handleCloseDetail() {
    setDetailOpen(false)
    setSelectedLink(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar: URL input + view toggle */}
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <SaveURLInput />
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
        </div>
      </div>

      {/* Empty state */}
      {links.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 py-24 text-center">
          <h2 className="text-[20px] font-semibold leading-[1.2] mb-2">No links yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Paste a URL above to save your first link. We&apos;ll grab the title, image, and details automatically.
          </p>
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && links.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}
        >
          {links.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              onDelete={deleteLink}
              onUndoDelete={undoDelete}
              onOpenDetail={handleOpenDetail}
            />
          ))}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && links.length > 0 && (
        <div className="flex flex-col border rounded-lg overflow-hidden">
          {links.map((link) => (
            <LinkCardList
              key={link.id}
              link={link}
              onDelete={deleteLink}
              onUndoDelete={undoDelete}
              onOpenDetail={handleOpenDetail}
            />
          ))}
        </div>
      )}

      {/* Link detail dialog/sheet */}
      <LinkDetail
        link={selectedLink}
        open={detailOpen}
        onClose={handleCloseDetail}
        onDelete={deleteLink}
        onUndoDelete={undoDelete}
      />
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CategorySelect } from '@/components/links/CategorySelect'
import { InlineEdit } from '@/components/links/InlineEdit'
import { TagEditor } from '@/components/links/TagEditor'
import { UptimeDot } from '@/components/links/UptimeDot'
import { domainToHue } from '@/lib/utils/domain-color'
import type { Link, LinkWithTags } from '@/types'

interface LinkDetailProps {
  link: LinkWithTags | null
  open: boolean
  onClose: () => void
  onDelete: (id: string) => void
  onUndoDelete: (link: Link) => void
  onMutate: () => void
}

function LinkDetailContent({
  link,
  onClose,
  onDelete,
  onUndoDelete,
  onMutate,
}: {
  link: LinkWithTags
  onClose: () => void
  onDelete: (id: string) => void
  onUndoDelete: (link: Link) => void
  onMutate: () => void
}) {
  const hue = domainToHue(link.domain || '')
  const domainInitial = (link.domain || link.url).charAt(0).toUpperCase()
  const [checking, setChecking] = useState(false)

  async function handleCheckNow() {
    setChecking(true)
    await fetch(`/api/links/${link.id}/check`, { method: 'POST' })
    onMutate()
    setTimeout(() => setChecking(false), 3000)
  }

  function handleVisit() {
    window.open(link.url, '_blank', 'noopener,noreferrer')
  }

  function handleDelete() {
    onClose()
    onDelete(link.id)
    toast('Link deleted', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => onUndoDelete(link),
      },
    })
  }

  async function handleCategoryChange(category: string) {
    await fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    })
    onMutate()
  }

  async function handleDescriptionSave(description: string) {
    await fetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    })
    onMutate()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Hero image */}
      <div className="w-full h-[200px] overflow-hidden rounded-md">
        {link.ogImage ? (
          <img
            src={link.ogImage}
            alt={link.title || ''}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: `hsl(${hue}, 65%, 55%)` }}
          >
            {link.favicon ? (
              <img src={link.favicon} alt="" className="size-16 object-contain" />
            ) : (
              <span className="text-5xl font-semibold text-white">{domainInitial}</span>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      {link.title && (
        <h2 className="text-[20px] font-semibold leading-[1.2]">{link.title}</h2>
      )}

      {/* Domain row */}
      <div className="flex items-center gap-2">
        <Avatar className="size-4">
          <AvatarImage src={link.favicon || undefined} alt="" />
          <AvatarFallback className="text-[8px]">{domainInitial}</AvatarFallback>
        </Avatar>
        <span className="text-sm text-muted-foreground">{link.domain || ''}</span>
      </div>

      {/* Uptime status */}
      <div className="flex items-center gap-2">
        <UptimeDot status={link.uptimeStatus} lastCheckedAt={link.lastCheckedAt} lastStatusCode={link.lastStatusCode} />
        <span className="text-sm text-muted-foreground">
          {link.lastCheckedAt
            ? `Checked ${formatDistanceToNow(new Date(link.lastCheckedAt), { addSuffix: true })}`
            : 'Not yet checked'}
        </span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={handleCheckNow} disabled={checking}>
          <RefreshCw className={`size-3 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking...' : 'Check now'}
        </Button>
      </div>

      {/* URL display */}
      <button
        onClick={handleVisit}
        className="flex items-center gap-1 text-sm text-muted-foreground truncate hover:text-foreground transition-colors text-left"
      >
        <ExternalLink className="size-3 shrink-0" />
        <span className="truncate">{link.url}</span>
      </button>

      {/* Visit link button */}
      <Button variant="outline" onClick={handleVisit} className="w-full">
        <ExternalLink className="size-4" />
        Visit Link
      </Button>

      {/* Description (inline editable) */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1 px-3">Description</p>
        <InlineEdit
          value={link.description ?? ''}
          onSave={handleDescriptionSave}
        />
      </div>

      {/* Category */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">Category</p>
        <CategorySelect value={link.category} onChange={handleCategoryChange} />
      </div>

      {/* Tags */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">Tags</p>
        <TagEditor
          linkId={link.id}
          tags={link.tags}
          onTagAdded={onMutate}
          onTagRemoved={onMutate}
        />
      </div>

      {/* Saved date */}
      <p className="text-sm text-muted-foreground">
        Saved {format(new Date(link.createdAt), 'PPP')}
      </p>

      <Separator />

      {/* Delete button */}
      <Button
        variant="ghost"
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={handleDelete}
      >
        <Trash2 className="size-4" />
        Delete
      </Button>
    </div>
  )
}

export function LinkDetail({ link, open, onClose, onDelete, onUndoDelete, onMutate }: LinkDetailProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const mql = window.matchMedia('(max-width: 767px)')
    setIsMobile(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  if (!link || !mounted) return null

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="sr-only">Link Detail</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <LinkDetailContent
              link={link}
              onClose={onClose}
              onDelete={onDelete}
              onUndoDelete={onUndoDelete}
              onMutate={onMutate}
            />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[600px] overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="sr-only">Link Detail</DialogTitle>
        </DialogHeader>
        <LinkDetailContent
          link={link}
          onClose={onClose}
          onDelete={onDelete}
          onUndoDelete={onUndoDelete}
          onMutate={onMutate}
        />
      </DialogContent>
    </Dialog>
  )
}

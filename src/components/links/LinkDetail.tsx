'use client'

import { format } from 'date-fns'
import { ExternalLink, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { domainToHue } from '@/lib/utils/domain-color'
import type { Link } from '@/types'

interface LinkDetailProps {
  link: Link | null
  open: boolean
  onClose: () => void
  onDelete: (id: string) => void
  onUndoDelete: (link: Link) => void
}

function LinkDetailContent({
  link,
  onClose,
  onDelete,
  onUndoDelete,
}: {
  link: Link
  onClose: () => void
  onDelete: (id: string) => void
  onUndoDelete: (link: Link) => void
}) {
  const hue = domainToHue(link.domain || '')
  const domainInitial = (link.domain || link.url).charAt(0).toUpperCase()

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

      {/* Description */}
      {link.description && (
        <p className="text-sm text-muted-foreground">{link.description}</p>
      )}

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

export function LinkDetail({ link, open, onClose, onDelete, onUndoDelete }: LinkDetailProps) {
  if (!link) return null

  return (
    <>
      {/* Desktop: Dialog */}
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="hidden md:grid max-w-[600px] overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="sr-only">Link Detail</DialogTitle>
          </DialogHeader>
          <LinkDetailContent
            link={link}
            onClose={onClose}
            onDelete={onDelete}
            onUndoDelete={onUndoDelete}
          />
        </DialogContent>
      </Dialog>

      {/* Mobile: Sheet */}
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="bottom" className="md:hidden max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="sr-only">Link Detail</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <LinkDetailContent
              link={link}
              onClose={onClose}
              onDelete={onDelete}
              onUndoDelete={onUndoDelete}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

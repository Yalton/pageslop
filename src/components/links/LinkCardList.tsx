'use client'

import { formatDistanceToNow } from 'date-fns'
import { ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LinkSkeleton } from '@/components/links/LinkSkeleton'
import type { Link } from '@/types'

interface LinkCardListProps {
  link: Link
  onDelete: (id: string) => void
  onUndoDelete: (link: Link) => void
  onOpenDetail: (link: Link) => void
}

export function LinkCardList({ link, onDelete, onUndoDelete, onOpenDetail }: LinkCardListProps) {
  if (link.status === 'pending') {
    return <LinkSkeleton variant="list" />
  }

  const domainInitial = (link.domain || link.url).charAt(0).toUpperCase()
  const relativeTime = formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })

  function handleDelete() {
    onDelete(link.id)
    toast('Link deleted', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => onUndoDelete(link),
      },
    })
  }

  function handleVisit() {
    window.open(link.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="h-16 px-4 flex items-center gap-3 cursor-pointer hover:bg-muted transition-colors border-b"
      onClick={() => onOpenDetail(link)}
    >
      {/* Favicon */}
      <Avatar className="size-5 shrink-0">
        <AvatarImage src={link.favicon || undefined} alt="" />
        <AvatarFallback className="text-[8px]">{domainInitial}</AvatarFallback>
      </Avatar>

      {/* Title */}
      <span className="text-sm font-semibold truncate flex-1">{link.title || link.url}</span>

      {/* Domain */}
      <span className="text-sm text-muted-foreground shrink-0 hidden sm:block">
        {link.domain || ''}
      </span>

      {/* Timestamp */}
      <span className="text-sm text-muted-foreground shrink-0 ml-auto">{relativeTime}</span>

      {/* Actions */}
      <div onClick={e => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label="Link actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={handleVisit}>
              <ExternalLink className="size-4" />
              Visit Link
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

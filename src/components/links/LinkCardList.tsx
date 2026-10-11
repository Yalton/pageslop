'use client'

import { formatDistanceToNow } from 'date-fns'
import { Archive, ArchiveRestore, ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { UNDO_WINDOW_MS } from '@/lib/links/pending-deletes'
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
import { UptimeDot } from '@/components/links/UptimeDot'
import { EnrichmentBadge } from '@/components/links/EnrichmentBadge'
import { SelectCheckbox, type SelectionProps } from '@/components/links/SelectCheckbox'
import { isArchived } from '@/lib/utils/all-links-filter'
import { cn } from '@/lib/utils'
import type { LinkWithTags } from '@/types'

interface LinkCardListProps extends SelectionProps {
  link: LinkWithTags
  onDelete: (id: string) => void
  onUndoDelete: (link: LinkWithTags) => void
  onOpenDetail: (link: LinkWithTags) => void
  onTagClick?: (tagName: string) => void
  onRestore?: (id: string) => void
  onArchive?: (id: string) => void
}

export function LinkCardList({
  link,
  onDelete,
  onUndoDelete,
  onOpenDetail,
  onTagClick,
  onRestore,
  onArchive,
  selecting = false,
  selected = false,
  onToggleSelect,
}: LinkCardListProps) {
  if (link.status === 'pending') {
    return <LinkSkeleton variant="list" />
  }

  const domainInitial = (link.domain || link.url).charAt(0).toUpperCase()
  const relativeTime = formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })
  const visibleTags = link.tags?.slice(0, 2) ?? []

  function handleDelete() {
    onDelete(link.id)
    toast('Link deleted', {
      duration: UNDO_WINDOW_MS,
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
      className={cn(
        'group h-16 px-4 flex items-center gap-3 cursor-pointer hover:bg-muted transition-colors border-b',
        selected && 'bg-primary/10',
      )}
      onClick={(e) => (selecting && onToggleSelect ? onToggleSelect(link.id, e.shiftKey) : onOpenDetail(link))}
    >
      {onToggleSelect && (
        <SelectCheckbox
          checked={selected}
          onToggle={(shiftKey) => onToggleSelect(link.id, shiftKey)}
          label={`Select ${link.title || link.url}`}
          className={cn(!selecting && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}
        />
      )}
      {/* Favicon */}
      <Avatar className="size-5 shrink-0">
        <AvatarImage src={link.favicon || undefined} alt="" />
        <AvatarFallback className="text-[8px]">{domainInitial}</AvatarFallback>
      </Avatar>

      {/* Uptime dot */}
      <UptimeDot status={link.uptimeStatus} lastCheckedAt={link.lastCheckedAt} lastStatusCode={link.lastStatusCode} />

      {/* Enrichment badge */}
      <EnrichmentBadge source={link.enrichmentSource} error={link.enrichmentError} />

      {/* Title */}
      <span className="text-sm font-semibold truncate flex-1">{link.title || link.url}</span>

      {/* Tag pills (max 2, hidden on small screens) */}
      {visibleTags.length > 0 && (
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {visibleTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-secondary/80"
              onClick={(e) => { e.stopPropagation(); onTagClick?.(tag.name) }}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Archived badge */}
      {isArchived(link) && (
        <Badge variant="secondary" className="text-xs shrink-0">
          Archived
        </Badge>
      )}

      {/* Category badge (hidden on small screens) */}
      {link.category && link.category !== 'Other' && (
        <Badge variant="outline" className="text-xs shrink-0 hidden sm:flex">
          {link.category}
        </Badge>
      )}

      {/* Domain */}
      <span className="text-sm text-muted-foreground shrink-0 hidden md:block">
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
            {onRestore && isArchived(link) && (
              <DropdownMenuItem onSelect={() => onRestore(link.id)}>
                <ArchiveRestore className="size-4" />
                Restore
              </DropdownMenuItem>
            )}
            {onArchive && !isArchived(link) && (
              <DropdownMenuItem onSelect={() => onArchive(link.id)}>
                <Archive className="size-4" />
                Archive
              </DropdownMenuItem>
            )}
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

'use client'

import { useState } from 'react'
import { Archive, ArchiveRestore, ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { UNDO_WINDOW_MS } from '@/lib/links/pending-deletes'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { tagPillClass } from '@/components/links/tag-pill'
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
import { domainToHue } from '@/lib/utils/domain-color'
import { SelectCheckbox, type SelectionProps } from '@/components/links/SelectCheckbox'
import { isArchived } from '@/lib/utils/all-links-filter'
import { cn } from '@/lib/utils'
import { CATEGORY_COLORS } from '@/components/graph/graphUtils'
import type { LinkWithTags } from '@/types'

interface LinkCardProps extends SelectionProps {
  link: LinkWithTags
  onDelete: (id: string) => void
  onUndoDelete: (link: LinkWithTags) => void
  onOpenDetail: (link: LinkWithTags) => void
  onTagClick?: (tagName: string) => void
  onRestore?: (id: string) => void
  onArchive?: (id: string) => void
}

export function LinkCard({
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
}: LinkCardProps) {
  const [imgError, setImgError] = useState(false)
  const [faviconError, setFaviconError] = useState(false)

  if (link.status === 'pending') {
    return <LinkSkeleton variant="grid" />
  }

  const hue = domainToHue(link.domain || '')
  const domainInitial = (link.domain || link.url).charAt(0).toUpperCase()
  const visibleTags = link.tags?.slice(0, 3) ?? []
  const extraTagCount = (link.tags?.length ?? 0) - 3
  const categoryColor = CATEGORY_COLORS[link.category ?? 'Other'] ?? CATEGORY_COLORS.Other

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
        'group relative overflow-hidden rounded-xl border border-border/60 bg-card/80 text-card-foreground cursor-pointer backdrop-blur-sm',
        'transition-[transform,box-shadow,border-color] duration-300 ease-out',
        'hover:border-primary/50 hover:shadow-[0_14px_40px_-14px_hsl(var(--primary)/0.55)] motion-safe:hover:-translate-y-1',
        selected && 'border-primary ring-2 ring-primary',
      )}
      onClick={(e) => (selecting && onToggleSelect ? onToggleSelect(link.id, e.shiftKey) : onOpenDetail(link))}
    >
      {onToggleSelect && (
        <SelectCheckbox
          checked={selected}
          onToggle={(shiftKey) => onToggleSelect(link.id, shiftKey)}
          label={`Select ${link.title || link.url}`}
          className={cn(
            'absolute top-2 left-2 z-10 size-6',
            !selecting && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          )}
        />
      )}
      {/* Hero image */}
      <div className="relative h-[160px] w-full overflow-hidden">
        {link.ogImage && !imgError ? (
          <img
            src={link.ogImage}
            alt={link.title || ''}
            className="w-full h-[160px] object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out motion-safe:group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
            style={{ backgroundImage: `linear-gradient(135deg, hsl(${hue}, 70%, 58%), hsl(${(hue + 40) % 360}, 65%, 38%))` }}
          >
            {link.favicon && !faviconError ? (
              <img
                src={link.favicon}
                alt=""
                className="size-12 object-contain"
                onError={() => setFaviconError(true)}
              />
            ) : (
              <span className="text-4xl font-semibold text-white drop-shadow">{domainInitial}</span>
            )}
          </div>
        )}
        {/* Category colour edge between image and body */}
        <div className="absolute inset-x-0 bottom-0 h-0.5" style={{ backgroundColor: categoryColor }} aria-hidden="true" />
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col gap-2">
        {/* Favicon + domain + category badge */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Avatar className="size-4 shrink-0">
            <AvatarImage src={link.favicon || undefined} alt="" />
            <AvatarFallback className="text-[8px]">{domainInitial}</AvatarFallback>
          </Avatar>
          <UptimeDot status={link.uptimeStatus} lastCheckedAt={link.lastCheckedAt} lastStatusCode={link.lastStatusCode} />
          <span className="text-sm text-muted-foreground truncate">{link.domain || ''}</span>
          <EnrichmentBadge source={link.enrichmentSource} error={link.enrichmentError} />
          {isArchived(link) && (
            <Badge variant="secondary" className="text-xs ml-auto shrink-0">
              Archived
            </Badge>
          )}
          {link.category && link.category !== 'Other' && (
            <Badge
              variant="outline"
              className={`text-xs shrink-0 gap-1.5${isArchived(link) ? '' : ' ml-auto'}`}
              style={{ borderColor: `${categoryColor}66`, backgroundColor: `${categoryColor}1a` }}
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: categoryColor }} aria-hidden="true" />
              {link.category}
            </Badge>
          )}
        </div>

        {/* Title */}
        {link.title && (
          <p className="text-[15px] font-semibold leading-snug tracking-tight line-clamp-2 transition-colors group-hover:text-primary">{link.title}</p>
        )}

        {/* Description */}
        {link.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{link.description}</p>
        )}

        {/* Tag pills */}
        {visibleTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleTags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className={cn('text-xs', tagPillClass)} asChild>
                <button
                  type="button"
                  aria-label={`Show links tagged ${tag.name}`}
                  onClick={(e) => { e.stopPropagation(); onTagClick?.(tag.name) }}
                >
                  {tag.name}
                </button>
              </Badge>
            ))}
            {extraTagCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                +{extraTagCount}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Open link + actions menu */}
      <div className="absolute top-2 right-2 flex gap-1" onClick={e => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 hover:text-white"
          asChild
        >
          <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label="Open link in new tab" title="Open link in new tab">
            <ExternalLink className="size-4" />
          </a>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 hover:text-white"
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

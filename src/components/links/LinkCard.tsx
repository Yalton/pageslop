'use client'

import { useState, type MouseEvent } from 'react'
import { Archive, ArchiveRestore, ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { UNDO_WINDOW_MS } from '@/lib/links/pending-deletes'
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
import { CategoryLabel, categoryColor, categoryTabSlot } from '@/components/links/CategoryLabel'
import { openExternal } from '@/lib/links/open-external'
import type { LinkWithTags } from '@/types'
import { publicImageUrl } from '@/lib/utils/private-host'

/**
 * Covers the whole card with the button's ::after, so any click on the card lands on it.
 * Focus shows on the card body and tab (see `focusedBody`), not on this box.
 */
const stretchedButtonClass = 'text-left outline-none after:absolute after:inset-0'

/** Card body and tab take the focus ring while the open button inside has keyboard focus. */
const focusedBody = 'group-has-[[data-link-open]:focus-visible]:border-ring group-has-[[data-link-open]:focus-visible]:ring-2 group-has-[[data-link-open]:focus-visible]:ring-ring'

/** Index-card tabs sit at three offsets, picked by category, like staggered drawer dividers. */
const TAB_OFFSETS = ['left-0', 'left-[16%]', 'left-[30%]'] as const

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
  const initial = (link.title || link.domain || link.url).charAt(0).toUpperCase()
  const visibleTags = link.tags?.slice(0, 3) ?? []
  const extraTagCount = (link.tags?.length ?? 0) - 3
  const tabSlot = categoryTabSlot(link.category)
  const favicon = publicImageUrl(link.favicon)
  const ogImage = publicImageUrl(link.ogImage)
  const showFavicon = Boolean(favicon) && !faviconError

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
    openExternal(link.url)
  }

  function handleOpen(e: MouseEvent) {
    if (selecting && onToggleSelect) onToggleSelect(link.id, e.shiftKey)
    else onOpenDetail(link)
  }

  return (
    <div
      className={cn(
        'group relative pt-[26px] cursor-pointer',
        'motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-0.5',
      )}
    >
      {/* Tab: favicon, status and domain, topped with the category colour */}
      <div
        className={cn(
          'absolute top-0 z-[1] flex h-[27px] max-w-[70%] items-center gap-1.5 rounded-t-md border border-b-0 border-t-[3px] bg-card px-2.5',
          'pointer-events-none text-xs font-semibold text-muted-foreground transition-colors group-hover:text-foreground',
          TAB_OFFSETS[tabSlot],
          focusedBody,
          'group-has-[[data-link-open]:focus-visible]:ring-0',
        )}
        style={{ borderTopColor: categoryColor(link.category) }}
      >
        {showFavicon ? (
          <img src={favicon} alt="" className="size-3.5 shrink-0 rounded-[3px] object-contain" onError={() => setFaviconError(true)} />
        ) : (
          <span className="grid size-3.5 shrink-0 place-items-center rounded-[3px] bg-border text-[9px] font-bold text-foreground" aria-hidden="true">{initial}</span>
        )}
        <span className="pointer-events-auto relative z-10 flex">
          <UptimeDot status={link.uptimeStatus} lastCheckedAt={link.lastCheckedAt} lastStatusCode={link.lastStatusCode} />
        </span>
        <span className="truncate">{link.domain || ''}</span>
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-md border bg-card text-card-foreground shadow-card transition-colors group-hover:border-line-strong',
          tabSlot === 0 && 'rounded-tl-none',
          focusedBody,
          selected && 'border-primary ring-2 ring-primary',
        )}
      >
        {onToggleSelect && (
          <SelectCheckbox
            checked={selected}
            onToggle={(shiftKey) => onToggleSelect(link.id, shiftKey)}
            label={`Select ${link.title || link.url}`}
            className={cn(
              'absolute top-[34px] left-2 z-10 size-6',
              !selecting && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
            )}
          />
        )}
        {/* Preview image, or a flat panel tinted by the site */}
        <div className="aspect-[16/9.5] w-full overflow-hidden border-b bg-muted">
          {ogImage && !imgError ? (
            <img
              src={ogImage}
              alt={link.title || ''}
              className="size-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-safe:group-hover:scale-[1.03]"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="grid size-full place-items-center" style={{ backgroundColor: `hsl(${hue} var(--blank-panel))` }}>
              <span className="grid size-14 place-items-center rounded-xl border bg-card font-display text-[26px] font-bold">
                {showFavicon ? (
                  <img src={favicon} alt="" className="size-8 object-contain" onError={() => setFaviconError(true)} />
                ) : (
                  initial
                )}
              </span>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="flex flex-col gap-1.5 px-3 pt-2.5 pb-3">
          {/* Title: a button stretched over the whole card, so the card opens from the keyboard */}
          {link.title && (
            <button
              type="button"
              data-link-open=""
              className={cn(stretchedButtonClass, 'font-display text-[17px] font-semibold leading-tight line-clamp-2')}
              onClick={handleOpen}
            >
              {link.title}
            </button>
          )}

          {link.description && (
            <p className="text-[13.5px] leading-snug text-muted-foreground line-clamp-2">{link.description}</p>
          )}

          {/* Category, state and tags */}
          <div className="relative z-10 flex flex-wrap items-center gap-1 self-start empty:hidden">
            {link.category && link.category !== 'Other' && (
              <CategoryLabel category={link.category} className="mr-1" />
            )}
            {isArchived(link) && (
              <Badge variant="secondary" className="text-xs">
                Archived
              </Badge>
            )}
            <span className="flex empty:hidden">
              <EnrichmentBadge source={link.enrichmentSource} error={link.enrichmentError} />
            </span>
            {visibleTags.map((tag) => (
              <Badge key={tag.id} variant="outline" className={cn('rounded-sm text-xs font-semibold text-muted-foreground', tagPillClass)} asChild>
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
              <Badge variant="outline" className="rounded-sm text-xs text-muted-foreground">
                +{extraTagCount}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Untitled links still get a stretched button, labelled for screen readers only */}
      {!link.title && (
        <button type="button" data-link-open="" className={stretchedButtonClass} onClick={handleOpen}>
          <span className="sr-only">{link.url}</span>
        </button>
      )}

      {/* Open link + actions menu */}
      {/* Hidden until hover or focus where the device can hover; always shown on touch */}
      <div
        className="absolute top-[34px] right-2 z-10 flex gap-1 transition-opacity [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 has-[[data-state=open]]:opacity-100"
        onClick={e => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-7 bg-black/70 text-white hover:bg-black/85 hover:text-white"
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
              className="size-7 bg-black/70 text-white hover:bg-black/85 hover:text-white"
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

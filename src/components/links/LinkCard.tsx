'use client'

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
import { domainToHue } from '@/lib/utils/domain-color'
import type { LinkWithTags } from '@/types'

interface LinkCardProps {
  link: LinkWithTags
  onDelete: (id: string) => void
  onUndoDelete: (link: LinkWithTags) => void
  onOpenDetail: (link: LinkWithTags) => void
  onTagClick?: (tagName: string) => void
}

export function LinkCard({ link, onDelete, onUndoDelete, onOpenDetail, onTagClick }: LinkCardProps) {
  if (link.status === 'pending') {
    return <LinkSkeleton variant="grid" />
  }

  const hue = domainToHue(link.domain || '')
  const domainInitial = (link.domain || link.url).charAt(0).toUpperCase()
  const visibleTags = link.tags?.slice(0, 3) ?? []
  const extraTagCount = (link.tags?.length ?? 0) - 3

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
      className="overflow-hidden rounded-lg border bg-card text-card-foreground cursor-pointer hover:border-primary transition-colors relative"
      onClick={() => onOpenDetail(link)}
    >
      {/* Hero image */}
      <div className="h-[160px] w-full overflow-hidden">
        {link.ogImage ? (
          <img
            src={link.ogImage}
            alt={link.title || ''}
            className="w-full h-[160px] object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: `hsl(${hue}, 65%, 55%)` }}
          >
            {link.favicon ? (
              <img
                src={link.favicon}
                alt=""
                className="size-12 object-contain"
              />
            ) : (
              <span className="text-4xl font-semibold text-white">{domainInitial}</span>
            )}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col gap-2">
        {/* Favicon + domain + category badge */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Avatar className="size-4 shrink-0">
            <AvatarImage src={link.favicon || undefined} alt="" />
            <AvatarFallback className="text-[8px]">{domainInitial}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground truncate">{link.domain || ''}</span>
          {link.category && link.category !== 'Other' && (
            <Badge variant="outline" className="text-xs ml-auto shrink-0">
              {link.category}
            </Badge>
          )}
        </div>

        {/* Title */}
        {link.title && (
          <p className="text-sm font-semibold leading-snug line-clamp-2">{link.title}</p>
        )}

        {/* Description */}
        {link.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{link.description}</p>
        )}

        {/* Tag pills */}
        {visibleTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
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
            {extraTagCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                +{extraTagCount}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Actions menu */}
      <div className="absolute top-2 right-2" onClick={e => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 bg-background/80 hover:bg-background"
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

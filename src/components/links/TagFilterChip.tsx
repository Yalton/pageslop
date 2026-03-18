'use client'

import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface TagFilterChipProps {
  tag: string
  onClear: () => void
}

export function TagFilterChip({ tag, onClear }: TagFilterChipProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Filtered by tag:</span>
      <Badge variant="default" className="flex items-center gap-1 text-xs">
        {tag}
        <button
          type="button"
          onClick={onClear}
          className="ml-0.5 rounded-sm hover:opacity-70"
          aria-label={`Remove tag filter: ${tag}`}
        >
          <X className="size-3" />
        </button>
      </Badge>
    </div>
  )
}

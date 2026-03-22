'use client'

import { CATEGORIES } from '@/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CATEGORY_COLORS } from './graphUtils'

interface GraphControlsProps {
  visibleCategories: Set<string>
  onToggleCategory: (cat: string) => void
  totalNodes: number
  totalEdges: number
}

export function GraphControls({
  visibleCategories,
  onToggleCategory,
  totalNodes,
  totalEdges,
}: GraphControlsProps) {
  // Empty set = show all; some categories = filter active
  const isFiltered = visibleCategories.size > 0

  function handleShowAll() {
    // Clear all active filters by toggling each selected category off
    for (const cat of visibleCategories) {
      onToggleCategory(cat)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b bg-background">
      {/* Category filter pills */}
      <div className="flex flex-wrap items-center gap-1.5 flex-1">
        {CATEGORIES.map((cat) => {
          const isActive =
            visibleCategories.size === 0 || visibleCategories.has(cat)
          const color = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['Other']

          return (
            <Button
              key={cat}
              variant="outline"
              size="sm"
              onClick={() => onToggleCategory(cat)}
              className={cn(
                'gap-1.5 transition-colors',
                isActive && visibleCategories.size > 0
                  ? 'bg-primary/10 border-primary/30 text-foreground'
                  : !isActive
                    ? 'opacity-50 text-muted-foreground'
                    : '',
              )}
              aria-pressed={visibleCategories.has(cat)}
            >
              <span
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              {cat}
            </Button>
          )
        })}

        {/* Show All button when a filter is active */}
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShowAll}
            className="text-muted-foreground hover:text-foreground"
          >
            Show All
          </Button>
        )}
      </div>

      {/* Stats display */}
      <p className="text-sm text-muted-foreground shrink-0 tabular-nums">
        {totalNodes} nodes,{' '}
        {totalEdges} connections
      </p>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { groupLinks } from '@/lib/utils/group-links'
import { LinkCard } from '@/components/links/LinkCard'
import { LinkCardList } from '@/components/links/LinkCardList'
import type { LinkWithTags } from '@/types'

interface GroupedViewProps {
  links: LinkWithTags[]
  subMode: 'grid' | 'list'
  onDelete: (id: string) => void
  onUndoDelete: (link: LinkWithTags) => void
  onOpenDetail: (link: LinkWithTags) => void
  onTagClick?: (tagName: string) => void
}

export function GroupedView({
  links,
  subMode,
  onDelete,
  onUndoDelete,
  onOpenDetail,
  onTagClick,
}: GroupedViewProps) {
  const grouped = groupLinks(links)

  // Track open/closed state for each category, default all open
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const key of grouped.keys()) {
      initial[key] = true
    }
    return initial
  })

  if (grouped.size === 0) {
    return null
  }

  function toggleCategory(category: string) {
    setOpenCategories((prev) => ({ ...prev, [category]: !prev[category] }))
  }

  return (
    <div className="flex flex-col gap-6">
      {[...grouped.entries()].map(([category, categoryLinks]) => {
        const isOpen = openCategories[category] !== false

        return (
          <Collapsible.Root
            key={category}
            open={isOpen}
            onOpenChange={() => toggleCategory(category)}
          >
            {/* Category header */}
            <Collapsible.Trigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 w-full text-left mb-3 group"
              >
                <ChevronRight
                  className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90"
                />
                <span className="text-sm font-semibold">
                  {category}{' '}
                  <span className="text-muted-foreground font-normal">
                    ({categoryLinks.length})
                  </span>
                </span>
              </button>
            </Collapsible.Trigger>

            <Collapsible.Content>
              {subMode === 'grid' ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {categoryLinks.map((link) => (
                    <LinkCard
                      key={link.id}
                      link={link}
                      onDelete={onDelete}
                      onUndoDelete={onUndoDelete}
                      onOpenDetail={onOpenDetail}
                      onTagClick={onTagClick}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col border rounded-lg overflow-hidden">
                  {categoryLinks.map((link) => (
                    <LinkCardList
                      key={link.id}
                      link={link}
                      onDelete={onDelete}
                      onUndoDelete={onUndoDelete}
                      onOpenDetail={onOpenDetail}
                      onTagClick={onTagClick}
                    />
                  ))}
                </div>
              )}
            </Collapsible.Content>
          </Collapsible.Root>
        )
      })}
    </div>
  )
}

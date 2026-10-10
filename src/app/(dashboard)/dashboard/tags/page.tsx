'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/links/SearchInput'
import { selectTagsToShow, type TagWithCount } from '@/lib/utils/tags-view'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function TagsPage() {
  const router = useRouter()
  const { data: tags, isLoading } = useSWR<TagWithCount[]>('/api/tags', fetcher)
  const [filterQuery, setFilterQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  const { shown: filteredTags, hiddenCount } = selectTagsToShow(tags ?? [], filterQuery, showAll)
  const hasSingleUse = (tags ?? []).some((t) => t.count <= 1)

  function handleTagClick(tagName: string) {
    router.push(`/dashboard?tag=${encodeURIComponent(tagName)}`)
  }

  return (
    <div className="flex flex-col min-h-screen p-6">
      <h1 className="text-[20px] font-semibold leading-[1.2] mb-6">Tags</h1>

      <div className="mb-4 max-w-sm">
        <SearchInput value={filterQuery} onChange={setFilterQuery} />
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading tags...</p>
      )}

      {!isLoading && filteredTags.length === 0 && hiddenCount === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-24 text-center">
          <h2 className="text-[20px] font-semibold leading-[1.2] mb-2">No tags yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Tags are added automatically when you save links. You can also add them manually from a link&apos;s detail view.
          </p>
        </div>
      )}

      {!isLoading && filteredTags.length > 0 && (
        <div className="flex flex-col gap-1 max-w-lg">
          {filteredTags.map((tag) => (
            <button
              key={tag.name}
              type="button"
              onClick={() => handleTagClick(tag.name)}
              className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted transition-colors text-left"
            >
              <span className="text-sm font-medium">{tag.name}</span>
              <Badge variant="secondary" className="text-xs shrink-0">
                {tag.count}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {!isLoading && !filterQuery.trim() && hasSingleUse && (
        <div className="mt-3 max-w-lg">
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Hide single-use tags' : `Show ${hiddenCount} single-use tag${hiddenCount === 1 ? '' : 's'}`}
          </Button>
        </div>
      )}
    </div>
  )
}

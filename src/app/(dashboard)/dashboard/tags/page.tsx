'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/links/SearchInput'
import { PageSpinner } from '@/components/ui/spinner'
import { jsonFetcher } from '@/lib/swr/fetcher'
import { selectTagsToShow, type TagWithCount } from '@/lib/utils/tags-view'

export default function TagsPage() {
  const router = useRouter()
  const { data, error, mutate } = useSWR<TagWithCount[]>('/api/tags', jsonFetcher)
  // Guard against anything but a list reaching the view (an old cache entry, a proxy page).
  const tags = Array.isArray(data) ? data : undefined
  // Wait only while there is nothing to show: saved tags render at once and
  // SWR refreshes them in the background.
  const isLoading = !tags && !error
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
        <SearchInput value={filterQuery} onChange={setFilterQuery} placeholder="Search tags..." />
      </div>

      {isLoading && <PageSpinner label="Loading tags" className="max-w-lg" />}

      {error && !tags && (
        <div role="alert" className="flex flex-col items-center gap-3 py-24 text-center max-w-lg">
          <p className="text-sm text-muted-foreground">Could not load your tags.</p>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            Try again
          </Button>
        </div>
      )}

      {!isLoading && tags && filteredTags.length === 0 && hiddenCount === 0 && (
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

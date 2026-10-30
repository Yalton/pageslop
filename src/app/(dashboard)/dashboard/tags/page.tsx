'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/links/SearchInput'
import { PageSpinner } from '@/components/ui/spinner'
import { jsonFetcher } from '@/lib/swr/fetcher'
import { selectTagsToShow, tagWeight, type TagWithCount } from '@/lib/utils/tags-view'

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
  const maxCount = (tags ?? []).reduce((m, t) => Math.max(m, t.count), 0)
  const hasSingleUse = (tags ?? []).some((t) => t.count <= 1)

  function handleTagClick(tagName: string) {
    router.push(`/dashboard?tag=${encodeURIComponent(tagName)}`)
  }

  return (
    <div className="flex flex-col min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6">Tags</h1>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
          {filteredTags.map((tag) => (
            <button
              key={tag.name}
              type="button"
              onClick={() => handleTagClick(tag.name)}
              className="group flex flex-col gap-3 rounded-md border bg-card p-4 text-left shadow-card transition-[transform,border-color] duration-200 ease-out hover:border-line-strong motion-safe:hover:-translate-y-0.5"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate font-display text-[17px] font-semibold">{tag.name}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{tag.count}</span>
              </span>
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${Math.round(tagWeight(tag.count, maxCount) * 100)}%` }}
                />
              </span>
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

'use client'

import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ANY_FACET,
  CLEAR_FACETS,
  LINK_SORTS,
  facetFromSelect,
  facetItems,
  facetToSelect,
  LINK_SORT_LABELS,
  LINK_STATUS_LABELS,
  type LinkStatusFilter,
  activeFilterCount,
  hasActiveLinkFilters,
  type FacetOption,
  type LinkSort,
  type LinkViewPatch,
  type LinkViewState,
} from '@/lib/utils/link-view'

interface LinkViewToolbarProps {
  view: LinkViewState
  domains: FacetOption[]
  categories: FacetOption[]
  statuses: FacetOption[]
  onChange: (patch: LinkViewPatch) => void
  /** Open state of the website filter, so the site tabs' "more" button can open it. */
  websiteOpen?: boolean
  onWebsiteOpenChange?: (open: boolean) => void
}

function FacetSelect({
  label,
  anyLabel,
  value,
  options,
  onChange,
  open,
  onOpenChange,
}: {
  label: string
  anyLabel: string
  value: string | null
  options: FacetOption[]
  onChange: (value: string | null) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <Select
      value={facetToSelect(value)}
      onValueChange={(v) => onChange(facetFromSelect(v))}
      open={open}
      onOpenChange={onOpenChange}
    >
      <SelectTrigger size="sm" aria-label={label} className="max-w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY_FACET}>{anyLabel}</SelectItem>
        {facetItems(options, value).map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.value} <span className="text-muted-foreground">({o.count})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Sort and filter controls for All Links and Archived. State lives in the URL; see link-view.ts. */
export function LinkViewToolbar({
  view,
  domains,
  categories,
  statuses,
  onChange,
  websiteOpen,
  onWebsiteOpenChange,
}: LinkViewToolbarProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const count = activeFilterCount(view)

  const controls = (open?: boolean, onOpen?: (o: boolean) => void) => (
    <>
      <Select value={view.sort} onValueChange={(v) => onChange({ sort: v as LinkSort })}>
        <SelectTrigger size="sm" aria-label="Sort links">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LINK_SORTS.map((s) => (
            <SelectItem key={s} value={s}>
              {LINK_SORT_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FacetSelect
        label="Filter by website"
        anyLabel="All websites"
        value={view.domain}
        options={domains}
        onChange={(domain) => onChange({ domain })}
        open={open}
        onOpenChange={onOpen}
      />
      {(categories.length > 0 || view.category) && (
        <FacetSelect
          label="Filter by category"
          anyLabel="All categories"
          value={view.category}
          options={categories}
          onChange={(category) => onChange({ category })}
        />
      )}
      <Select
        value={facetToSelect(view.status)}
        onValueChange={(v) => onChange({ status: facetFromSelect(v) as LinkStatusFilter | null })}
      >
        <SelectTrigger size="sm" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY_FACET}>All statuses</SelectItem>
          {statuses.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {LINK_STATUS_LABELS[o.value as LinkStatusFilter]}{' '}
              <span className="text-muted-foreground">({o.count})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Toggle
        variant="outline"
        size="sm"
        pressed={view.untagged}
        onPressedChange={(untagged) => onChange({ untagged })}
      >
        Untagged
      </Toggle>
      <Toggle
        variant="outline"
        size="sm"
        pressed={view.described}
        onPressedChange={(described) => onChange({ described })}
      >
        Has description
      </Toggle>
    </>
  )

  return (
    <>
      <div className="hidden md:flex items-center gap-2 flex-wrap">
        {controls(websiteOpen, onWebsiteOpenChange)}
        {hasActiveLinkFilters(view) && (
          <Button variant="ghost" size="sm" onClick={() => onChange(CLEAR_FACETS)}>
            <X className="size-4" />
            Clear filters
          </Button>
        )}
      </div>
      <div className="md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" aria-label={count ? `Filters, ${count} active` : 'Filters'}>
              <SlidersHorizontal className="size-4" />
              Filters
              {count > 0 && (
                <span className="ml-1 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                  {count}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-xl bg-background">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription className="sr-only">Sort and filter your links</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col items-stretch gap-3 px-4 [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:max-w-none [&_button[aria-pressed]]:justify-start">
              {controls()}
            </div>
            <SheetFooter className="flex-row gap-2">
              {hasActiveLinkFilters(view) && (
                <Button variant="ghost" className="flex-1" onClick={() => onChange(CLEAR_FACETS)}>
                  <X className="size-4" />
                  Clear filters
                </Button>
              )}
              <Button
                className="flex-1"
                onClick={() => setSheetOpen(false)}
              >
                Done
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}

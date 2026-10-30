'use client'

import { useState, type ReactNode } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  activeFilterChips,
  activeFilterCount,
  hasActiveLinkFilters,
  type FacetOption,
  type LinkSort,
  type LinkViewPatch,
  type LinkViewState,
} from '@/lib/utils/link-view'

interface LinkViewToolbarProps {
  view: LinkViewState
  /** The ?tag= filter, shown as a chip beside the others. */
  tag: string | null
  domains: FacetOption[]
  categories: FacetOption[]
  statuses: FacetOption[]
  onChange: (patch: LinkViewPatch) => void
  /** Clears every filter including the tag and the search. */
  onClearAll: () => void
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  )
}

function FacetSelect({
  id,
  anyLabel,
  value,
  options,
  onChange,
}: {
  id: string
  anyLabel: string
  value: string | null
  options: FacetOption[]
  onChange: (value: string | null) => void
}) {
  return (
    <Select value={facetToSelect(value)} onValueChange={(v) => onChange(facetFromSelect(v))}>
      <SelectTrigger id={id} className="w-full">
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

function Check({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        className="size-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

/**
 * The Filters button (popover on desktop, bottom sheet on phones) and a chip per active filter.
 * State lives in the URL; see link-view.ts.
 */
export function LinkViewToolbar({
  view,
  tag,
  domains,
  categories,
  statuses,
  onChange,
  onClearAll,
}: LinkViewToolbarProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const count = activeFilterCount(view)
  const chips = activeFilterChips(view, tag)

  // id prefix keeps the popover's and the sheet's controls distinct; only one is mounted at a time
  const fields = (p: string) => (
    <>
      <Field id={`${p}-sort`} label="Sort">
        <Select value={view.sort} onValueChange={(v) => onChange({ sort: v as LinkSort })}>
          <SelectTrigger id={`${p}-sort`} className="w-full">
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
      </Field>
      <Field id={`${p}-website`} label="Website">
        <FacetSelect
          id={`${p}-website`}
          anyLabel="All websites"
          value={view.domain}
          options={domains}
          onChange={(domain) => onChange({ domain })}
        />
      </Field>
      {(categories.length > 0 || view.category) && (
        <Field id={`${p}-category`} label="Category">
          <FacetSelect
            id={`${p}-category`}
            anyLabel="All categories"
            value={view.category}
            options={categories}
            onChange={(category) => onChange({ category })}
          />
        </Field>
      )}
      <Field id={`${p}-status`} label="Status">
        <Select
          value={facetToSelect(view.status)}
          onValueChange={(v) => onChange({ status: facetFromSelect(v) as LinkStatusFilter | null })}
        >
          <SelectTrigger id={`${p}-status`} className="w-full">
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
      </Field>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Check
          id={`${p}-untagged`}
          label="Untagged"
          checked={view.untagged}
          onChange={(untagged) => onChange({ untagged })}
        />
        <Check
          id={`${p}-described`}
          label="Has description"
          checked={view.described}
          onChange={(described) => onChange({ described })}
        />
      </div>
    </>
  )

  const footer = (close: () => void) => (
    <>
      {hasActiveLinkFilters(view) && (
        <Button variant="outline" className="flex-1" onClick={() => onChange(CLEAR_FACETS)}>
          Clear filters
        </Button>
      )}
      <Button className="flex-1" onClick={close}>
        Done
      </Button>
    </>
  )

  const trigger = (
    <Button variant="outline" aria-label={count ? `Filters, ${count} active` : 'Filters'}>
      <SlidersHorizontal className="size-4" />
      Filters
      {count > 0 && (
        <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
          {count}
        </span>
      )}
    </Button>
  )

  return (
    // contents: the button and the chip row join the parent's flex row, so on phones the chips can wrap below it
    <div className="contents">
      <div className="hidden md:block">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent className="flex w-80 flex-col gap-3.5" aria-label="Sort and filter links">
            {fields('pop')}
            <div className="flex gap-2 border-t pt-3.5">{footer(() => setPopoverOpen(false))}</div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-xl bg-background">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription className="sr-only">Sort and filter your links</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3.5 px-4">{fields('sheet')}</div>
            <SheetFooter className="flex-row gap-2">{footer(() => setSheetOpen(false))}</SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
      <div className="order-last flex w-full flex-wrap items-center gap-2 empty:hidden md:order-none md:w-auto md:min-w-0 md:flex-1">
        {chips.map((chip) => (
          <span
            key={chip.key}
            className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-md border bg-card pl-2.5 pr-1 text-sm"
          >
            <span className="truncate">
              {chip.label && <span className="text-muted-foreground">{chip.label} </span>}
              <span className="font-semibold">{chip.value}</span>
            </span>
            <button
              type="button"
              onClick={() => onChange(chip.remove)}
              className="grid size-6 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Remove filter: ${chip.label ? `${chip.label} ${chip.value}` : chip.value}`}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {chips.length > 1 && (
          <Button variant="link" size="sm" className="px-1" onClick={onClearAll}>
            Clear all
          </Button>
        )}
      </div>
    </div>
  )
}

'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  LINK_SORTS,
  LINK_SORT_LABELS,
  hasActiveLinkFilters,
  type FacetOption,
  type LinkSort,
  type LinkViewPatch,
  type LinkViewState,
} from '@/lib/utils/link-view'

// Radix Select reserves the empty string, so "no filter" needs its own value.
const ANY = '__any'

interface LinkViewToolbarProps {
  view: LinkViewState
  domains: FacetOption[]
  categories: FacetOption[]
  onChange: (patch: LinkViewPatch) => void
}

function FacetSelect({
  label,
  anyLabel,
  value,
  options,
  onChange,
}: {
  label: string
  anyLabel: string
  value: string | null
  options: FacetOption[]
  onChange: (value: string | null) => void
}) {
  return (
    <Select value={value ?? ANY} onValueChange={(v) => onChange(v === ANY ? null : v)}>
      <SelectTrigger size="sm" aria-label={label} className="max-w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{anyLabel}</SelectItem>
        {/* Keep a value from the URL selectable even when no visible link has it. */}
        {value && !options.some((o) => o.value === value) && <SelectItem value={value}>{value}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.value} <span className="text-muted-foreground">({o.count})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Sort and filter controls for All Links and Archived. State lives in the URL; see link-view.ts. */
export function LinkViewToolbar({ view, domains, categories, onChange }: LinkViewToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
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
      {hasActiveLinkFilters(view) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ domain: null, category: null, untagged: false, described: false })}
        >
          <X className="size-4" />
          Clear filters
        </Button>
      )}
    </div>
  )
}

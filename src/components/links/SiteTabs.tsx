'use client'

import { ChevronDown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { siteTabs } from '@/lib/utils/site-tabs'
import type { FacetOption } from '@/lib/utils/link-view'

interface SiteTabsProps {
  /** Sites with link counts, most links first (domainOptions). */
  domains: FacetOption[]
  /** The ?domain= filter. */
  selected: string | null
  favicons: Map<string, string>
  /** Total links across all sites, for the "All" tab. */
  total: number
  onSelect: (domain: string | null) => void
  /** Opens the toolbar's website filter, which lists every site. */
  onMore: () => void
}

const TAB =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 h-8 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
const IDLE = 'border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
const ACTIVE = 'border-transparent bg-accent text-accent-foreground font-medium'

function Count({ value }: { value: number }) {
  return <span className="tabular-nums opacity-70">{value}</span>
}

/**
 * A scrollable row of website tabs above the links: All plus the sites with
 * the most links. Picking one sets the same ?domain= filter as the toolbar.
 */
export function SiteTabs({ domains, selected, favicons, total, onSelect, onMore }: SiteTabsProps) {
  const { tabs, overflow } = siteTabs(domains, selected)

  return (
    <div
      role="toolbar"
      aria-label="Websites"
      className="flex min-w-0 items-center gap-2 overflow-x-auto p-0.5 pr-8 [scrollbar-width:thin] [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)]"
    >
      <button
        type="button"
        aria-pressed={!selected}
        className={cn(TAB, !selected ? ACTIVE : IDLE)}
        onClick={() => onSelect(null)}
      >
        All sites <Count value={total} />
      </button>
      {tabs.map((site) => {
        const active = site.value === selected
        return (
          <button
            key={site.value}
            type="button"
            aria-pressed={active}
            title={site.value}
            className={cn(TAB, active ? ACTIVE : IDLE)}
            onClick={() => onSelect(active ? null : site.value)}
          >
            <Avatar className="size-4">
              <AvatarImage src={favicons.get(site.value)} alt="" />
              <AvatarFallback className="text-[9px]">{site.value.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="max-w-[160px] truncate">{site.value}</span>
            <Count value={site.count} />
          </button>
        )
      })}
      {overflow.length > 0 && (
        <button type="button" className={cn(TAB, IDLE)} onClick={onMore}>
          {overflow.length} more
          <ChevronDown className="size-3.5" />
        </button>
      )}
    </div>
  )
}

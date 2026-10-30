'use client'

import { useLinks } from '@/lib/hooks/useLinks'
import { filterAllLinksView } from '@/lib/utils/all-links-filter'

/** "N links · N down" beside the All Links heading. */
export function LinkCountSummary() {
  const { links } = useLinks()
  const visible = filterAllLinksView(links)
  if (visible.length === 0) return null
  const down = visible.filter((l) => l.uptimeStatus === 'down').length
  return (
    <span className="tabular-nums text-muted-foreground">
      {visible.length} {visible.length === 1 ? 'link' : 'links'}
      {down > 0 && ` · ${down} down`}
    </span>
  )
}

import { CategoryLabel, categoryColor, categoryTabSlot } from '@/components/links/CategoryLabel'
import { cn } from '@/lib/utils'

const TAB_OFFSETS = ['left-0', 'left-[16%]', 'left-[30%]'] as const

export interface ExampleLink {
  title: string
  domain: string
  category: string
  image: string
  favicon?: string
  description?: string
  tags: string[]
}

/** A static link card for the landing page: same tab, edge and body as LinkCard, with nothing to click. */
export function ExampleCard({ link, className }: { link: ExampleLink; className?: string }) {
  const slot = categoryTabSlot(link.category)
  return (
    <div className={cn('relative pt-[26px]', className)}>
      <div
        className={cn(
          'absolute top-0 flex h-[27px] max-w-[70%] items-center gap-1.5 rounded-t-md border border-b-0 border-t-[3px] bg-card px-2.5 text-xs font-semibold text-muted-foreground',
          TAB_OFFSETS[slot],
        )}
        style={{ borderTopColor: categoryColor(link.category) }}
      >
        {link.favicon ? (
          <img src={link.favicon} alt="" className="size-3.5 shrink-0 rounded-[3px] object-contain" />
        ) : (
          <span className="grid size-3.5 shrink-0 place-items-center rounded-[3px] bg-border text-[9px] font-bold text-foreground" aria-hidden="true">
            {link.domain.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="size-2 shrink-0 rounded-full bg-green-500" aria-hidden="true" />
        <span className="truncate">{link.domain}</span>
      </div>
      <div className={cn('overflow-hidden rounded-md border bg-card text-card-foreground shadow-card', slot === 0 && 'rounded-tl-none')}>
        <div className="aspect-[16/9.5] w-full overflow-hidden border-b bg-muted">
          <img src={link.image} alt="" className="size-full object-cover" />
        </div>
        <div className="flex flex-col gap-1.5 px-3 pt-2.5 pb-3">
          <p className="font-display text-[17px] font-semibold leading-tight line-clamp-2">{link.title}</p>
          {link.description && <p className="text-[13.5px] leading-snug text-muted-foreground line-clamp-2">{link.description}</p>}
          <div className="flex flex-wrap items-center gap-1">
            <CategoryLabel category={link.category} className="mr-1" />
            {link.tags.map((tag) => (
              <span key={tag} className="rounded-sm border px-1.5 py-px text-xs font-semibold text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

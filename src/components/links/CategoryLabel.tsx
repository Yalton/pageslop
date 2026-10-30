import type { CSSProperties } from 'react'

/** Index-card tab offset per category, so neighbouring tabs stagger like drawer dividers. */
const TAB_SLOTS: Record<string, 0 | 1 | 2> = {
  Technology: 0,
  News: 1,
  Reference: 2,
  Entertainment: 1,
  Shopping: 2,
  Social: 2,
  Education: 0,
  Finance: 1,
  Health: 0,
  Creative: 2,
  Other: 1,
}

/** Tab offset slot (0, 1 or 2) for a category. */
export function categoryTabSlot(category: string | null | undefined): 0 | 1 | 2 {
  return TAB_SLOTS[category ?? 'Other'] ?? 1
}

/** Theme-tuned colour for a category (the --cat-* tokens in globals.css). */
export function categoryColor(category: string | null | undefined): string {
  const key = category && category in TAB_SLOTS ? category.toLowerCase() : 'other'
  return `var(--cat-${key})`
}

/** Category name in its colour, behind a small square marker. */
export function CategoryLabel({ category, className }: { category: string; className?: string }) {
  const style = { color: categoryColor(category) } satisfies CSSProperties
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold ${className ?? ''}`} style={style}>
      <span className="size-[7px] rounded-[2px] bg-current" aria-hidden="true" />
      {category}
    </span>
  )
}

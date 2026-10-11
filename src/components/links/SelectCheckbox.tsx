'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Selection props a link card or row takes from the grid. */
export interface SelectionProps {
  /** Selection mode: a click on the card toggles it instead of opening it. */
  selecting?: boolean
  selected?: boolean
  onToggleSelect?: (id: string, shiftKey: boolean) => void
}

interface SelectCheckboxProps {
  checked: boolean
  onToggle: (shiftKey: boolean) => void
  label: string
  className?: string
}

export function SelectCheckbox({ checked, onToggle, label, className }: SelectCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onToggle(e.shiftKey)
      }}
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded border-2 transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-muted-foreground/70 bg-background/80 hover:border-primary',
        className,
      )}
    >
      {checked && <Check className="size-3.5" strokeWidth={3} />}
    </button>
  )
}

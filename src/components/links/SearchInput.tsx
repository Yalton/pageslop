'use client'

import { Search, X } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Key that focuses the field, shown as a hint while it is empty. */
  shortcut?: string
}

export function SearchInput({ value, onChange, placeholder = 'Search links...', shortcut }: SearchInputProps) {
  return (
    <div className="relative flex items-center">
      <Search className="absolute left-3 size-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border bg-card pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {!value && shortcut && (
        <kbd className="pointer-events-none absolute right-2.5 hidden rounded border px-1.5 font-sans text-xs text-muted-foreground [@media(hover:hover)]:block" aria-hidden>
          {shortcut}
        </kbd>
      )}
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 flex items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

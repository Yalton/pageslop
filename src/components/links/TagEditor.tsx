'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Tag } from '@/types'

interface TagEditorProps {
  linkId: string
  tags: Tag[]
  onTagAdded: () => void
  onTagRemoved: () => void
}

export function TagEditor({ linkId, tags, onTagAdded, onTagRemoved }: TagEditorProps) {
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleRemoveTag(tag: Tag) {
    try {
      await fetch(`/api/links/${linkId}/tags/${tag.id}`, { method: 'DELETE' })
      onTagRemoved()
    } catch {
      // silently fail — SWR revalidation will restore correct state
    }
  }

  async function handleAddTag() {
    const name = inputValue.trim()
    if (!name || isSubmitting) return

    setIsSubmitting(true)
    try {
      await fetch(`/api/links/${linkId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      setInputValue('')
      onTagAdded()
    } catch {
      // silently fail
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge
            key={tag.id}
            variant={tag.source === 'user' ? 'outline' : 'secondary'}
            className="gap-1 pr-1"
          >
            {tag.name}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag)}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20 transition-colors"
              aria-label={`Remove tag ${tag.name}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add tag..."
        disabled={isSubmitting}
        className="h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  )
}

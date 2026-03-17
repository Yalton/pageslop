'use client'

import { useState, useRef, useEffect } from 'react'

interface InlineEditProps {
  value: string
  onSave: (newValue: string) => void
  placeholder?: string
}

export function InlineEdit({ value, onSave, placeholder = 'Click to add description...' }: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync draft when value changes externally
  useEffect(() => {
    if (!isEditing) {
      setDraft(value)
    }
  }, [value, isEditing])

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      // Move cursor to end
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
    }
  }, [isEditing])

  function handleClick() {
    setDraft(value)
    setIsEditing(true)
  }

  function handleSave() {
    const trimmed = draft.trim()
    setIsEditing(false)
    onSave(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      setDraft(value)
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        rows={3}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
    )
  }

  return (
    <p
      onClick={handleClick}
      className="text-sm text-muted-foreground cursor-pointer rounded-md px-3 py-2 hover:bg-muted/50 transition-colors min-h-[2.5rem]"
    >
      {value || <span className="italic opacity-60">{placeholder}</span>}
    </p>
  )
}

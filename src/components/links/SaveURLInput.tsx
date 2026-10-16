'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useLinks } from '@/lib/hooks/useLinks'

export function SaveURLInput() {
  const [value, setValue] = useState('')
  const [isMultiLine, setIsMultiLine] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { saveLinks } = useLinks()

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const newValue = e.target.value
    setValue(newValue)
    if (newValue.includes('\n')) {
      setIsMultiLine(true)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      if (!isMultiLine) {
        setIsMultiLine(true)
      }
      setValue(prev => prev + '\n')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return

    setIsSubmitting(true)
    try {
      const saved = await saveLinks(trimmed)
      const duplicates = saved.filter(s => s.duplicate)
      const nonDuplicates = saved.filter(s => !s.duplicate)

      if (nonDuplicates.length > 0) {
        toast.success('Link saved', { duration: 3000 })
      }

      if (duplicates.length > 0) {
        toast.info(duplicates.length === 1 ? 'Already saved' : `${duplicates.length} links were already saved`, {
          duration: 3000,
        })
      }

      setValue('')
      setIsMultiLine(false)
    } catch {
      toast.error("Couldn't save that link. Check the URL and try again.", { duration: 5000 })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="hidden md:flex items-center gap-2 w-full"
    >
      {isMultiLine ? (
        <Textarea
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Paste a link..."
          className="flex-1 text-sm min-h-[48px] resize-none"
          disabled={isSubmitting}
        />
      ) : (
        <Input
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Paste a link..."
          className="flex-1 text-sm h-12"
          disabled={isSubmitting}
        />
      )}
      <Button
        type="submit"
        className="h-12 px-4"
        aria-label="Save link"
        disabled={isSubmitting || !value.trim()}
      >
        {isSubmitting ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Plus className="size-5" />
        )}
      </Button>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { Link2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { SaveLinksError, useLinks } from '@/lib/hooks/useLinks'

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
    } catch (err) {
      const reason = err instanceof SaveLinksError ? err.serverMessage : null
      toast.error(reason ?? "Couldn't save that link. Check the URL and try again.", { duration: 5000 })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="hidden md:flex items-start gap-1.5 w-full rounded-lg border bg-card p-1 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40"
    >
      <Link2 className="ml-2 mt-3 size-4 shrink-0 text-muted-foreground" aria-hidden />
      {isMultiLine ? (
        <Textarea
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Paste a link..."
          className="flex-1 min-h-9 resize-none border-0 bg-transparent text-[15px] shadow-none focus-visible:ring-0 dark:bg-transparent"
          disabled={isSubmitting}
        />
      ) : (
        <Input
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Paste a link..."
          className="flex-1 h-9 border-0 bg-transparent px-1 text-[15px] shadow-none focus-visible:ring-0 dark:bg-transparent"
          disabled={isSubmitting}
        />
      )}
      <Button
        type="submit"
        className="h-9 px-5"
        aria-label="Save link"
        disabled={isSubmitting || !value.trim()}
      >
        {isSubmitting ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          'Save'
        )}
      </Button>
    </form>
  )
}

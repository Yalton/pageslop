'use client'

import { useState } from 'react'
import { Archive, ArchiveRestore, Tag, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface BulkActionBarProps {
  count: number
  /** How many links "Select all" would select. */
  total: number
  onSelectAll: () => void
  onClear: () => void
  onDelete: () => void
  onAddTag: (name: string) => Promise<void>
  /** Shown in All Links. */
  onArchive?: () => void
  /** Shown in Archived. */
  onRestore?: () => void
  /** Existing tag names, offered while typing. */
  tagSuggestions: string[]
}

/** Floating bar with actions for the selected links. */
export function BulkActionBar({
  count,
  total,
  onSelectAll,
  onClear,
  onDelete,
  onAddTag,
  onArchive,
  onRestore,
  tagSuggestions,
}: BulkActionBarProps) {
  const [tagOpen, setTagOpen] = useState(false)
  const [tagName, setTagName] = useState('')
  const [saving, setSaving] = useState(false)

  async function submitTag(e: React.FormEvent) {
    e.preventDefault()
    if (!tagName.trim() || saving) return
    setSaving(true)
    try {
      await onAddTag(tagName)
      setTagOpen(false)
      setTagName('')
    } catch {
      // onAddTag reports the failure; keep the dialog open to retry.
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label="Selected links"
        className="sticky bottom-20 md:bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg border bg-popover px-2 py-1.5 text-popover-foreground shadow-lg"
      >
        <span className="px-2 text-sm font-semibold">{count} selected</span>
        {count < total && (
          <Button variant="ghost" size="sm" onClick={onSelectAll}>
            Select all {total}
          </Button>
        )}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {onArchive && (
          <Button variant="ghost" size="sm" onClick={onArchive} disabled={count === 0}>
            <Archive className="size-4" />
            Archive
          </Button>
        )}
        {onRestore && (
          <Button variant="ghost" size="sm" onClick={onRestore} disabled={count === 0}>
            <ArchiveRestore className="size-4" />
            Restore
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setTagOpen(true)} disabled={count === 0}>
          <Tag className="size-4" />
          Add tag
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={count === 0}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClear} aria-label="Clear selection">
          <X className="size-4" />
        </Button>
      </div>

      <Dialog open={tagOpen} onOpenChange={setTagOpen}>
        <DialogContent>
          <form onSubmit={submitTag} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Add a tag to {count} {count === 1 ? 'link' : 'links'}</DialogTitle>
              <DialogDescription>Pick one of your tags or type a new one.</DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              list="bulk-tag-suggestions"
              placeholder="Tag name"
              maxLength={50}
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
            />
            <datalist id="bulk-tag-suggestions">
              {tagSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTagOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!tagName.trim() || saving}>
                Add tag
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

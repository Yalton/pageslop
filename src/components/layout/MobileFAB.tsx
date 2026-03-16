"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export function MobileFAB() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    const trimmed = url.trim()
    if (!trimmed) return

    setLoading(true)
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: trimmed }),
      })

      if (!res.ok) {
        throw new Error("Save failed")
      }

      toast.success("Link saved")
      setUrl("")
      setOpen(false)
    } catch {
      toast.error("Couldn't save that link. Check the URL and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* FAB: 56px, violet, bottom-right, mobile only */}
      <button
        type="button"
        aria-label="Save link"
        onClick={() => setOpen(true)}
        className="md:hidden fixed bottom-6 right-6 size-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Plus className="size-6" />
      </button>

      {/* Save link dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save a link</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Textarea
              placeholder="Paste a link..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="min-h-[100px]"
              autoFocus
            />
            <Button
              onClick={handleSave}
              disabled={loading || !url.trim()}
              className="w-full"
            >
              {loading ? "Saving..." : "Save Link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

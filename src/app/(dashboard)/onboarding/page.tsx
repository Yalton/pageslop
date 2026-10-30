'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OnboardingPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: url }),
      })
      if (!res.ok) throw new Error(`Save failed with ${res.status}`)
      router.push('/dashboard')
    } catch {
      toast.error("Couldn't save that link. Check the URL and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-lg px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-[20px] font-semibold">Welcome to Pageslop</h1>
          <p className="text-muted-foreground text-sm">
            Paste a URL below to save your first link
          </p>

          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
            <textarea
              className="border-input bg-input/30 placeholder:text-muted-foreground focus-visible:ring-ring/50 min-h-[120px] w-full rounded-md border px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px]"
              placeholder="Paste a link..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />

            <Button type="submit" className="w-full" disabled={isLoading || !url.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Link'
              )}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Zap, Sparkles, Cloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { auth } from "@/lib/auth/server"

export default async function MarketingPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center justify-end px-6 py-4">
        <ThemeToggle />
      </header>

      {/* Hero section */}
      <section className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-[36px] font-semibold leading-[1.1] tracking-tight">
          Save links. Skip the busywork.
        </h1>
        <p className="mt-4 max-w-md text-sm text-muted-foreground">
          Pageslop automatically organizes your bookmarks — no folders, no tags, no effort.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button asChild variant="default" size="lg">
            <Link href="/signup">Start Saving Links</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Log In</Link>
          </Button>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-4xl px-6 pb-12 pt-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="flex flex-col items-center text-center">
            <Zap className="mb-4 size-8 text-primary" />
            <h2 className="text-[20px] font-semibold leading-[1.2]">Instant save</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Paste a link and it&apos;s saved. Title, image, and details fetched automatically.
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <Sparkles className="mb-4 size-8 text-primary" />
            <h2 className="text-[20px] font-semibold leading-[1.2]">Zero management</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No folders to create. No tags to type. Everything is organized for you.
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <Cloud className="mb-4 size-8 text-primary" />
            <h2 className="text-[20px] font-semibold leading-[1.2]">Always available</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your links are saved in the cloud. Access them from any device, anytime.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-6">
        <div className="mx-auto max-w-4xl flex items-center justify-between text-xs text-muted-foreground">
          <span>Pageslop</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

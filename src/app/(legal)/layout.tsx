import Link from "next/link"
import { LegalNav } from "@/components/legal/LegalNav"

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="shrink-0 text-[20px] font-semibold leading-[1.2] hover:text-primary"
          >
            Pageslop
          </Link>
          <LegalNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        {children}
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <span>&copy; Pageslop</span>
          <Link href="/" className="hover:text-foreground">Back to Pageslop</Link>
        </div>
      </footer>
    </div>
  )
}

import Link from "next/link"

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <Link href="/" className="text-[20px] font-semibold">Pageslop</Link>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-12">
        {children}
      </main>
    </div>
  )
}

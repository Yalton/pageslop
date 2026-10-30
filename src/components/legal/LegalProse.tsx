import { cn } from "@/lib/utils"

// Typography primitives for the static legal pages. The app has no
// @tailwindcss/typography plugin and preflight strips default element styles,
// so these components carry the hierarchy explicitly.

export function LegalArticle({ children }: { children: React.ReactNode }) {
  return (
    <article className="text-[15px] leading-7 text-foreground/90 break-words">
      {children}
    </article>
  )
}

export function LegalTitle({
  children,
  updated,
}: {
  children: React.ReactNode
  updated: string
}) {
  return (
    <header className="mb-8 border-b pb-6">
      <h1 className="text-[28px] font-semibold leading-[1.2] tracking-tight text-foreground sm:text-[32px]">
        {children}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{updated}</p>
    </header>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mt-10 first-of-type:mt-0 [&>p+p]:mt-4 [&>p+ul]:mt-3">
      <h2 className="mb-3 text-[20px] font-semibold leading-[1.3] text-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
      {children}
    </ul>
  )
}

export function LegalCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm text-foreground">
      {children}
    </code>
  )
}

export function LegalLink({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <a
      href={href}
      className={cn(
        "font-medium text-ink underline underline-offset-4 decoration-primary/40 hover:decoration-primary",
        className
      )}
    >
      {children}
    </a>
  )
}

// Contact line for the legal pages. CONTACT_EMAIL is read per request, so each
// self-hosted instance names its own operator without a rebuild.
export function LegalContact({ prompt }: { prompt: string }) {
  const email = process.env.CONTACT_EMAIL
  if (!email) {
    return <p>{prompt} Contact the operator of this Pageslop instance.</p>
  }
  return (
    <p>
      {prompt} Email <LegalLink href={`mailto:${email}`}>{email}</LegalLink>.
    </p>
  )
}

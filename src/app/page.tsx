import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowRight, Inbox, Link2, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { ExampleCard, type ExampleLink } from "@/components/marketing/ExampleCard"
import { categoryColor } from "@/components/links/CategoryLabel"
import { auth } from "@/lib/auth/server"
import { signupAllowed } from "@/lib/auth/signup"

const REPO_URL = "https://github.com/Yalton/pageslop"

/** GitHub's mark (lucide's brand icons are deprecated). */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.27 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

const PASTED: ExampleLink = {
  title: "Blender Tutorial - Turn Any 2D Image to 3D Model - Quick & Easy",
  domain: "youtube.com",
  category: "Entertainment",
  image: "/landing/blender-2d-to-3d.webp",
  favicon: "/landing/youtube.png",
  tags: ["video", "design", "learning"],
}

const FOUND: ExampleLink[] = [
  PASTED,
  {
    title: "Spells",
    domain: "noita.wiki.gg",
    category: "Reference",
    image: "/landing/noita-spells.webp",
    description: "Spells, and choosing how to use them, is a core part of Noita.",
    tags: ["gaming", "learning"],
  },
  {
    title: "Blow Up Any Object in Blender (Fast Cell Fracture Trick)",
    domain: "youtube.com",
    category: "Education",
    image: "/landing/blender-cell-fracture.webp",
    favicon: "/landing/youtube.png",
    tags: ["video", "design"],
  },
]

const WAYS_IN = [
  {
    tab: "Paste",
    icon: Link2,
    category: "Technology",
    offset: "left-0",
    title: "Paste a link. That's it.",
    body: "Pageslop fetches the title, image and description, then adds tags and a category. You don't file anything.",
  },
  {
    tab: "Idle tabs",
    icon: Inbox,
    category: "News",
    offset: "left-[16%]",
    title: "Tabs you stopped using close themselves.",
    body: "The Firefox extension moves idle tabs into To Revisit. Go through them later: keep the good ones, archive the rest.",
  },
  {
    tab: "API & MCP",
    icon: Terminal,
    category: "Social",
    offset: "left-[30%]",
    title: "Scripts and agents can use it too.",
    body: "Save and search through the REST API, or connect an AI agent to your links through the MCP server.",
  },
]

function Section({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className="border-t">
      <div className={`mx-auto max-w-6xl px-4 py-12 sm:px-8 md:py-18 [&>*]:min-w-0 ${className ?? ""}`}>{children}</div>
    </section>
  )
}

export default async function MarketingPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (session) {
    redirect("/dashboard")
  }

  const canSignUp = signupAllowed(process.env.ALLOW_SIGNUP)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex h-18 max-w-6xl items-center gap-5 px-4 sm:px-8">
        <span className="brand-text text-2xl font-bold">Pageslop</span>
        <nav className="ml-auto flex items-center gap-2 sm:gap-4">
          <a href={REPO_URL} className="hidden items-center gap-1.5 font-semibold text-muted-foreground hover:text-foreground sm:flex">
            <GithubMark className="size-4" />
            Source on GitHub
          </a>
          <Link href="/login" className="px-1 font-semibold text-muted-foreground hover:text-foreground">
            Log in
          </Link>
          {canSignUp && (
            <Button asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          )}
          <ThemeToggle />
        </nav>
      </header>

      <main>
        {/* Hero: the paste is the demonstration */}
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-8 pb-14 sm:px-8 md:pt-12 md:pb-18">
          <h1 className="max-w-[13em] text-[40px] leading-[1.02] font-bold tracking-[-0.02em] text-balance sm:text-[56px] lg:text-[64px]">
            Paste a link. Pageslop files it.
          </h1>
          <p className="max-w-[34em] text-lg text-muted-foreground sm:text-[19px]">
            Title, image, tags and a category are filled in for you. Idle tabs close themselves into an inbox. It all
            runs on your own server.
          </p>
          <div className="flex flex-wrap gap-2.5">
            {canSignUp && (
              <Button asChild size="lg" className="h-12 px-5 text-base">
                <Link href="/signup">Sign up</Link>
              </Button>
            )}
            <Button asChild size="lg" variant="outline" className="h-12 px-5 text-base">
              <Link href="/login">Log in</Link>
            </Button>
          </div>

          <div className="mt-7 grid items-center gap-5 rounded-lg border border-dashed border-line-strong bg-sidebar-background p-5 sm:p-7 [&>*]:min-w-0 md:grid-cols-[minmax(0,1fr)_40px_minmax(0,300px)]">
            <div className="flex flex-col gap-2.5">
              <span className="text-sm font-bold text-ink">You paste</span>
              <div className="flex items-center gap-1.5 rounded-lg border bg-card p-1" aria-hidden="true">
                <Link2 className="ml-2 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate px-1 text-[15px]">https://youtube.com/watch?v=BcjPCjxsCZo</span>
                <span className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
                  Save
                </span>
              </div>
            </div>
            <ArrowRight className="hidden size-6 justify-self-center text-muted-foreground md:block" aria-hidden="true" />
            <div className="flex flex-col gap-2.5">
              <span className="text-sm font-bold text-ink">Pageslop files</span>
              <ExampleCard link={PASTED} />
            </div>
          </div>
        </div>

        {/* Three ways links arrive, as index cards */}
        <Section>
          <h2 className="sr-only">How links get in</h2>
          <div className="grid gap-x-5 gap-y-8 md:grid-cols-3">
            {WAYS_IN.map(({ tab, icon: Icon, category, offset, title, body }) => (
              <article key={tab} className="relative pt-[26px]">
                <div
                  className={`absolute top-0 ${offset} flex h-[27px] items-center gap-1.5 rounded-t-md border border-b-0 border-t-[3px] bg-card px-3 text-[13px] font-bold text-muted-foreground`}
                  style={{ borderTopColor: categoryColor(category) }}
                >
                  <Icon className="size-3.5" style={{ color: categoryColor(category) }} aria-hidden="true" />
                  {tab}
                </div>
                <div
                  className={`flex h-full flex-col gap-2 rounded-md border bg-card p-5 shadow-card ${offset === "left-0" ? "rounded-tl-none" : ""}`}
                >
                  <h3 className="text-[21px] leading-tight font-bold">{title}</h3>
                  <p className="text-muted-foreground">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </Section>

        <Section className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
          <div className="flex flex-col gap-3.5">
            <h2 className="text-[32px] leading-[1.1] font-bold">Everything you save can be found again.</h2>
            <p className="max-w-[34em] text-lg text-muted-foreground">
              Search titles, tags, descriptions and URLs. Browse by tag, by category or by site. A dot on every card
              shows whether the page is still up, so dead links don&apos;t hide in the pile.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3" aria-hidden="true">
            {FOUND.map((link, i) => (
              <ExampleCard key={link.title} link={link} className={i === 2 ? "hidden sm:block" : undefined} />
            ))}
          </div>
        </Section>

        <Section className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col gap-3.5">
            <h2 className="text-[32px] leading-[1.1] font-bold">Runs on your server.</h2>
            <p className="max-w-[34em] text-lg text-muted-foreground">
              Pageslop is a Docker Compose stack: the app, a worker that takes screenshots, and PostgreSQL. Your links
              stay on your machine. The code is open source under AGPL-3.0.
            </p>
            <div>
              <Button asChild variant="outline" size="lg" className="h-12 px-5 text-base">
                <a href={REPO_URL}>
                  <GithubMark className="size-4" />
                  Source on GitHub
                </a>
              </Button>
            </div>
          </div>
          <pre className="overflow-x-auto rounded-lg border bg-sidebar-background px-5 py-4 font-mono text-[14px] leading-[1.75]">
            <code>
              <span className="text-ink select-none">$ </span>git clone {REPO_URL}.git{"\n"}
              <span className="text-ink select-none">$ </span>cd pageslop{"\n"}
              <span className="text-ink select-none">$ </span>./scripts/setup.sh{"   "}
              <span className="text-muted-foreground"># writes .env with fresh secrets</span>
              {"\n"}
              <span className="text-ink select-none">$ </span>docker compose up -d --build
            </code>
          </pre>
        </Section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-4 py-7 text-sm text-muted-foreground sm:px-8">
          <span className="brand-text text-lg font-bold">Pageslop</span>
          <span>AGPL-3.0</span>
          <div className="ml-auto flex gap-5">
            <a href={REPO_URL} className="hover:text-foreground">GitHub</a>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

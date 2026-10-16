'use client'

import { useEffect, useState } from 'react'
import { Bot, Database, Key, Lock, Puzzle, Trash2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SETTINGS_SECTIONS,
  getActiveSectionId,
  type SettingsSectionId,
} from '@/lib/utils/settings-sections'

/** Glass panel used by every settings card. */
export const settingsPanelClass =
  'rounded-xl border border-border/60 bg-card/60 backdrop-blur p-6 shadow-sm transition-shadow hover:shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.35)]'

const ICONS: Record<SettingsSectionId, LucideIcon> = {
  'browser-extension': Puzzle,
  mcp: Bot,
  llm: Key,
  account: Lock,
  data: Database,
  'danger-zone': Trash2,
}

/** Pixels from the viewport top at which a section counts as "current". */
const ACTIVE_OFFSET = 160

function sectionMeta(id: SettingsSectionId) {
  return SETTINGS_SECTIONS.find((s) => s.id === id)!
}

export function SettingsSection({ id, children }: { id: SettingsSectionId; children: React.ReactNode }) {
  const { label, description } = sectionMeta(id)
  const Icon = ICONS[id]
  const danger = id === 'danger-zone'
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-32 md:scroll-mt-20 lg:scroll-mt-8">
      <header className="mb-4 flex items-center gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1',
            danger
              ? 'bg-destructive/10 text-destructive ring-destructive/25'
              : 'bg-primary/10 text-primary ring-primary/25 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.7)]',
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        <div>
          <h2 id={`${id}-heading`} className={cn('text-lg font-semibold leading-tight', danger && 'text-destructive')}>
            {label}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function useActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(SETTINGS_SECTIONS[0].id)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const positions = SETTINGS_SECTIONS.flatMap((s) => {
        const el = document.getElementById(s.id)
        return el ? [{ id: s.id, top: el.getBoundingClientRect().top }] : []
      })
      const doc = document.documentElement
      const atBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 2
      setActive(getActiveSectionId(positions, ACTIVE_OFFSET, atBottom))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return active
}

/**
 * In-page navigation: a sticky vertical list on lg+, a sticky horizontally
 * scrollable pill bar below that. Plain anchor links, so deep links and
 * the browser's own hash scrolling keep working.
 */
export function SettingsNav() {
  const active = useActiveSection()

  useEffect(() => {
    // Keep the active pill visible in the mobile scroller.
    if (!active) return
    document
      .querySelector<HTMLElement>(`[data-settings-pill="${active}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [active])

  return (
    <>
      {/* Mobile / tablet: horizontal pill bar */}
      <nav aria-label="Settings sections" className="sticky top-14 md:top-0 z-20 -mx-6 mb-6 border-b border-border/60 bg-background/70 px-6 py-2 backdrop-blur-xl lg:hidden">
        <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SETTINGS_SECTIONS.map((s) => {
            const Icon = ICONS[s.id]
            const isActive = active === s.id
            return (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  data-settings-pill={s.id}
                  aria-current={isActive ? 'location' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'border-primary/40 bg-primary/15 text-foreground shadow-[0_0_18px_-6px_hsl(var(--primary)/0.7)]'
                      : 'border-border/60 bg-card/60 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-3.5" />
                  {s.label}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Desktop: sticky vertical list */}
      <nav aria-label="Settings sections" className="hidden lg:block">
        <ul className="sticky top-8 flex flex-col gap-1 rounded-xl border border-border/60 bg-card/60 p-2 backdrop-blur">
          {SETTINGS_SECTIONS.map((s) => {
            const Icon = ICONS[s.id]
            const isActive = active === s.id
            const danger = s.id === 'danger-zone'
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={isActive ? 'location' : undefined}
                  className={cn(
                    'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/15 text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    danger && !isActive && 'hover:text-destructive',
                  )}
                >
                  <Icon className={cn('size-4', isActive && !danger && 'text-primary', danger && 'text-destructive')} />
                  {s.label}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}

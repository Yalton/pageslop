"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSWRConfig } from "swr"
import {
  Link2,
  Inbox,
  Archive,
  Tags,
  Network,
  Settings,
  LogOut,
  Menu,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { authClient } from "@/lib/auth/client"
import { cn } from "@/lib/utils"
import { useLinks } from "@/lib/hooks/useLinks"
import { countInbox } from "@/lib/stash/revisit"
import { filterAllLinksView, filterArchivedView } from "@/lib/utils/all-links-filter"
import { isNavActive } from "@/lib/nav/active"
import { browserStorage, clearPersisted } from "@/lib/swr/persistent-cache"

const REVISIT_HREF = "/dashboard/revisit"

const navItems = [
  { label: "All Links", icon: Link2, href: "/dashboard", disabled: false },
  { label: "To Revisit", icon: Inbox, href: REVISIT_HREF, disabled: false },
  { label: "Archived", icon: Archive, href: "/dashboard/archived", disabled: false },
  { label: "Tags", icon: Tags, href: "/dashboard/tags", disabled: false },
  { label: "Graph", icon: Network, href: "/dashboard/graph", disabled: false },
  { label: "Settings", icon: Settings, href: "/dashboard/settings", disabled: false },
]

function NavItem({
  item,
  isActive,
  collapsed = false,
  badge,
  count,
}: {
  item: (typeof navItems)[number]
  isActive: boolean
  collapsed?: boolean
  /** Unread count, shown as an accent pill (To Revisit). */
  badge?: number
  /** Plain item count, shown muted. */
  count?: number
}) {
  const showBadge = typeof badge === "number" && badge > 0
  const badgeText = showBadge && badge > 99 ? "99+" : String(badge ?? "")

  const content = (
    <Button
      variant="ghost"
      className={cn(
        "relative w-full justify-start gap-3 text-sm font-semibold",
        collapsed && "justify-center px-0",
        isActive && "bg-sidebar-accent text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] hover:bg-sidebar-accent [&_svg]:text-ink",
        item.disabled && "cursor-not-allowed opacity-50"
      )}
      disabled={item.disabled}
      asChild={!item.disabled}
    >
      {item.disabled ? (
        <span>
          <item.icon className="size-5 shrink-0" />
          {!collapsed && <span>{item.label}</span>}
        </span>
      ) : (
        // Full prefetch: dashboard pages are dynamic, so by default Next fetches
        // them only on click. Their payload is small (data loads client-side),
        // so prefetching the whole page makes navigation instant.
        <Link href={item.href} prefetch>
          <item.icon className="size-5 shrink-0" />
          {!collapsed && <span>{item.label}</span>}
          {showBadge && !collapsed && (
            <span
              className="ml-auto rounded-full bg-ink/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink"
              aria-label={`${badge} unread`}
            >
              {badgeText}
            </span>
          )}
          {!showBadge && !collapsed && typeof count === "number" && (
            <span className="ml-auto text-xs font-normal tabular-nums text-muted-foreground">{count}</span>
          )}
          {showBadge && collapsed && (
            <span
              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary"
              aria-label={`${badge} unread`}
            />
          )}
        </Link>
      )}
    </Button>
  )

  if (collapsed && !item.disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{content}</div>
        </TooltipTrigger>
        <TooltipContent side="right">
          {showBadge ? `${item.label} (${badgeText})` : item.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return content
}

function SidebarContent({
  pathname,
  onNavigate,
  collapsed = false,
}: {
  pathname: string
  onNavigate?: () => void
  collapsed?: boolean
}) {
  const router = useRouter()
  const { cache } = useSWRConfig()
  const { links } = useLinks()
  const inboxCount = countInbox(links)
  const counts: Record<string, number> = {
    "/dashboard": filterAllLinksView(links).length,
    "/dashboard/archived": filterArchivedView(links).length,
    "/dashboard/tags": new Set(links.flatMap((l) => l.tags?.map((t) => t.name) ?? [])).size,
  }

  async function handleLogOut() {
    await authClient.signOut()
    // Empty the in-memory cache too, or the save on pagehide writes it back.
    for (const key of [...cache.keys()]) cache.delete(key)
    clearPersisted(browserStorage())
    router.push("/login")
  }

  return (
    <div className="flex h-full flex-col">
      {/* App name */}
      {!collapsed && (
        <div className="px-4 py-5">
          <span className="brand-text text-2xl font-bold leading-none">Pageslop</span>
        </div>
      )}
      {collapsed && <div className="py-5" />}

      {/* Nav items */}
      <TooltipProvider>
        <nav className="flex flex-col gap-1 px-2">
          {navItems.map((item) => (
            <NavItem
              key={item.label}
              item={item}
              isActive={isNavActive(pathname, item.href)}
              collapsed={collapsed}
              badge={item.href === REVISIT_HREF ? inboxCount : undefined}
              count={counts[item.href]}
            />
          ))}
        </nav>
      </TooltipProvider>

      <div className="flex-1" />

      {/* Bottom section */}
      <div className="px-2 pb-4">
        <Separator className="mb-4" />
        <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
          <ThemeToggle />
          <Button
            variant="ghost"
            className={cn(
              "justify-start gap-3 text-sm font-semibold",
              collapsed ? "w-full justify-center px-0" : "min-w-0 flex-1 shrink"
            )}
            onClick={handleLogOut}
          >
            <LogOut className="size-5 shrink-0" />
            {!collapsed && <span>Log Out</span>}
          </Button>
        </div>
        {!collapsed && (
          <div className="flex gap-3 px-2 pt-3 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        )}
      </div>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar: always visible at 240px */}
      <aside className="hidden lg:flex lg:w-[240px] lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 bg-sidebar-background border-r">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Tablet sidebar: collapsed to 64px, icons only with tooltips */}
      <aside className="hidden md:flex lg:hidden md:w-16 md:flex-col md:fixed md:inset-y-0 md:left-0 bg-sidebar-background border-r">
        <SidebarContent pathname={pathname} collapsed />
      </aside>

      {/* Mobile: hamburger + Sheet */}
      <div className="flex items-center md:hidden px-4 py-3 bg-sidebar-background border-b sticky top-0 z-30">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[240px] p-0 bg-sidebar-background" showCloseButton={false}>
            <SidebarContent
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <span className="brand-text ml-3 text-[21px] font-bold">Pageslop</span>
      </div>
    </>
  )
}

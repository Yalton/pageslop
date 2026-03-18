"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Link2,
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

const navItems = [
  { label: "All Links", icon: Link2, href: "/dashboard", disabled: false },
  { label: "Tags", icon: Tags, href: "/dashboard/tags", disabled: false },
  { label: "Graph", icon: Network, href: "#", disabled: true },
  { label: "Settings", icon: Settings, href: "/dashboard/settings", disabled: false },
]

function NavItem({
  item,
  isActive,
  collapsed = false,
}: {
  item: (typeof navItems)[number]
  isActive: boolean
  collapsed?: boolean
}) {
  const content = (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-start gap-3 text-sm font-semibold",
        collapsed && "justify-center px-0",
        isActive && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
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
        <Link href={item.href}>
          <item.icon className="size-5 shrink-0" />
          {!collapsed && <span>{item.label}</span>}
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
        <TooltipContent side="right">{item.label}</TooltipContent>
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

  async function handleLogOut() {
    await authClient.signOut()
    router.push("/login")
  }

  return (
    <div className="flex h-full flex-col">
      {/* App name */}
      {!collapsed && (
        <div className="px-4 py-5">
          <span className="text-[20px] font-semibold leading-[1.2]">Pageslop</span>
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
              isActive={pathname === item.href || (item.href !== "#" && pathname.startsWith(item.href))}
              collapsed={collapsed}
              // onClick handler for mobile sheet close
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
              "w-full justify-start gap-3 text-sm font-semibold",
              collapsed && "justify-center px-0"
            )}
            onClick={handleLogOut}
          >
            <LogOut className="size-5 shrink-0" />
            {!collapsed && <span>Log Out</span>}
          </Button>
        </div>
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
      <aside className="hidden lg:flex lg:w-[240px] lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 bg-card border-r border-border">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Tablet sidebar: collapsed to 64px, icons only with tooltips */}
      <aside className="hidden md:flex lg:hidden md:w-16 md:flex-col md:fixed md:inset-y-0 md:left-0 bg-card border-r border-border">
        <SidebarContent pathname={pathname} collapsed />
      </aside>

      {/* Mobile: hamburger + Sheet */}
      <div className="flex items-center md:hidden px-4 py-3 bg-card border-b border-border">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[240px] p-0 bg-card" showCloseButton={false}>
            <SidebarContent
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <span className="ml-3 text-[20px] font-semibold">Pageslop</span>
      </div>
    </>
  )
}

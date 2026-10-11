"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const items = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
]

export function LegalNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Legal" className="-mr-3 flex items-center gap-1 text-sm">
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 font-semibold text-muted-foreground transition-colors hover:text-foreground",
              active && "bg-primary/10 text-primary hover:text-primary"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  function handleToggle() {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      aria-label="Toggle theme"
      className="text-primary"
    >
      {!mounted ? (
        <span className="size-5" />
      ) : theme === "dark" ? (
        <Sun className="size-5 text-primary" />
      ) : (
        <Moon className="size-5 text-primary" />
      )}
    </Button>
  )
}

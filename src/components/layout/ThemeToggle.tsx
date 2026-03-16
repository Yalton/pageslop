"use client"

import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

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
      {theme === "dark" ? (
        <Sun className="size-5 text-primary" />
      ) : (
        <Moon className="size-5 text-primary" />
      )}
    </Button>
  )
}

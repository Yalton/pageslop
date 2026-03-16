import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-screen p-6">
      {/* URL input bar — desktop only */}
      <div className="hidden md:flex items-center gap-3 mb-8">
        <Input
          placeholder="Paste a link..."
          className="h-12 flex-1"
        />
        <Button className="h-12 px-4" aria-label="Save link">
          <Plus className="size-5" />
        </Button>
      </div>

      {/* Page heading */}
      <h1 className="text-[20px] font-semibold leading-[1.2] mb-6">All Links</h1>

      {/* Placeholder content — replaced in Plan 05 with link grid */}
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        No links yet
      </div>
    </div>
  )
}

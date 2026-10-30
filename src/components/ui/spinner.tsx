import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Spinning loader icon. Pair with a label for screen readers, or use PageSpinner. */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn('size-5 animate-spin text-ink', className)} />
}

/** Centered spinner for a page or panel that is still loading its data. */
export function PageSpinner({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn('flex flex-col items-center justify-center gap-3 py-24', className)}>
      <Spinner className="size-8" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

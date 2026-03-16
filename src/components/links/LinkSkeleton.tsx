import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface LinkSkeletonProps {
  variant?: 'grid' | 'list'
  className?: string
}

export function LinkSkeleton({ variant = 'grid', className }: LinkSkeletonProps) {
  if (variant === 'list') {
    return (
      <div
        className={cn('h-16 px-4 flex items-center gap-3', className)}
        aria-busy="true"
        aria-label="Loading link"
      >
        <Skeleton className="size-5 rounded-full shrink-0" />
        <Skeleton className="h-4 w-[200px]" />
        <Skeleton className="h-4 w-[100px]" />
      </div>
    )
  }

  return (
    <div
      className={cn('overflow-hidden rounded-lg border bg-card', className)}
      aria-busy="true"
      aria-label="Loading link"
    >
      {/* Hero image area */}
      <div className="relative h-[160px] w-full overflow-hidden">
        <Skeleton className="h-full w-full rounded-none animate-shimmer" />
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col gap-2">
        {/* Favicon + domain */}
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-4 rounded-full shrink-0" />
          <Skeleton className="h-3 w-[100px]" />
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4 w-[80%]" />
          <Skeleton className="h-4 w-[60%]" />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-[90%]" />
          <Skeleton className="h-3 w-[70%]" />
        </div>

        {/* Tag pills */}
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-[60px] rounded-full" />
          <Skeleton className="h-5 w-[60px] rounded-full" />
          <Skeleton className="h-5 w-[60px] rounded-full" />
        </div>
      </div>
    </div>
  )
}

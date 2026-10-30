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
    <div className={cn('relative pt-[26px]', className)} aria-busy="true" aria-label="Loading link">
      {/* Tab: favicon + domain */}
      <div className="absolute top-0 left-0 flex h-[27px] w-[55%] items-center gap-1.5 rounded-t-md border border-b-0 border-t-[3px] bg-card px-2.5">
        <Skeleton className="size-3.5 rounded-[3px] shrink-0" />
        <Skeleton className="h-3 flex-1" />
      </div>
      <div className="overflow-hidden rounded-md rounded-tl-none border bg-card shadow-card">
        {/* Hero image area */}
        <div className="relative aspect-[16/9.5] w-full overflow-hidden border-b">
          <Skeleton className="h-full w-full rounded-none animate-shimmer" />
        </div>

        {/* Card body */}
        <div className="px-3 pt-2.5 pb-3 flex flex-col gap-2">

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
            <Skeleton className="h-5 w-[60px] rounded-sm" />
            <Skeleton className="h-5 w-[60px] rounded-sm" />
            <Skeleton className="h-5 w-[60px] rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  )
}

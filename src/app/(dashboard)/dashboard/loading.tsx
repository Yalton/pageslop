import { Skeleton } from '@/components/ui/skeleton'

/** Shown the moment a dashboard page is clicked, until it arrives. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col min-h-screen p-6" aria-busy="true">
      <Skeleton className="h-6 w-32 mb-6" />
      <Skeleton className="h-9 w-full max-w-sm mb-4" />
      <div className="flex flex-col gap-2 max-w-lg">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}

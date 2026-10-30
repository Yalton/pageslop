import { Suspense } from 'react'
import { LinkGrid } from '@/components/links/LinkGrid'
import { LinkCountSummary } from '@/components/links/LinkCountSummary'
import { PageSpinner } from '@/components/ui/spinner'

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-screen p-6">
      <div className="mb-6 flex items-baseline gap-3.5">
        <h1 className="text-3xl font-bold">All Links</h1>
        <LinkCountSummary />
      </div>
      <Suspense fallback={<PageSpinner label="Loading links" />}>
        <LinkGrid />
      </Suspense>
    </div>
  )
}

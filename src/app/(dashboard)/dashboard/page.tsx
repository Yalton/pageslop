import { Suspense } from 'react'
import { LinkGrid } from '@/components/links/LinkGrid'
import { PageSpinner } from '@/components/ui/spinner'

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-screen p-6">
      <h1 className="text-[20px] font-semibold leading-[1.2] mb-6">All Links</h1>
      <Suspense fallback={<PageSpinner label="Loading links" />}>
        <LinkGrid />
      </Suspense>
    </div>
  )
}

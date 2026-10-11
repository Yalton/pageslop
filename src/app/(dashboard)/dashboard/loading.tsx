import { PageSpinner } from '@/components/ui/spinner'

/** Shown the moment a dashboard page is clicked, until it arrives. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col min-h-screen p-6">
      <PageSpinner />
    </div>
  )
}

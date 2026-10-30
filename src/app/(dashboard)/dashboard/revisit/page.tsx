import { RevisitView } from '@/components/stash/RevisitView'

export default function RevisitPage() {
  return (
    <div className="flex flex-col min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6">To Revisit</h1>
      <RevisitView />
    </div>
  )
}

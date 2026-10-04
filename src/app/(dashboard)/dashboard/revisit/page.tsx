import { RevisitView } from '@/components/stash/RevisitView'

export default function RevisitPage() {
  return (
    <div className="flex flex-col min-h-screen p-6">
      <h1 className="text-[20px] font-semibold leading-[1.2] mb-6">To Revisit</h1>
      <RevisitView />
    </div>
  )
}

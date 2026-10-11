import { Suspense } from 'react'
import { LinkGrid } from '@/components/links/LinkGrid'

export default function ArchivedPage() {
  return (
    <div className="flex flex-col min-h-screen p-6">
      <h1 className="text-[20px] font-semibold leading-[1.2] mb-6">Archived</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <LinkGrid view="archived" />
      </Suspense>
    </div>
  )
}

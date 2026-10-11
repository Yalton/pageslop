'use client'

import dynamic from 'next/dynamic'
import { PageSpinner } from '@/components/ui/spinner'

const ForceGraph = dynamic(() => import('./ForceGraph'), {
  ssr: false,
  loading: () => <PageSpinner label="Loading graph" className="h-full" />,
})

export function GraphView() {
  return (
    <div className="h-[calc(100vh-0px)] w-full">
      <ForceGraph />
    </div>
  )
}

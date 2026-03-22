'use client'

import dynamic from 'next/dynamic'

const ForceGraph = dynamic(() => import('./ForceGraph'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      Loading graph...
    </div>
  ),
})

export function GraphView() {
  return (
    <div className="h-[calc(100vh-0px)] w-full">
      <ForceGraph />
    </div>
  )
}

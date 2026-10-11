'use client'

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { PageSpinner } from "@/components/ui/spinner"
import { isStaleBuildError, reloadForStaleBuild } from "@/lib/utils/stale-build"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // After a deploy, a tab still running the old build asks for files that are
  // gone. Reloading picks up the new build instead of showing an error.
  const [reloading, setReloading] = useState(() => isStaleBuildError(error))

  useEffect(() => {
    console.error(error)
    if (isStaleBuildError(error) && !reloadForStaleBuild()) setReloading(false)
  }, [error])

  if (reloading) {
    return <PageSpinner label="Updating to the latest version" className="min-h-screen" />
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">An unexpected error occurred.</p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </div>
  )
}

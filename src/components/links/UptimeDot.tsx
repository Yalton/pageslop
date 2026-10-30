'use client'

import { formatDistanceToNow } from 'date-fns'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { UptimeStatus } from '@/types'

const colorMap: Record<UptimeStatus, string> = {
  unchecked: 'bg-muted-foreground/40',
  up: 'bg-status-up',
  down: 'bg-status-down ring-[3px] ring-status-down/25',
}

const statusCodeLabels: Record<number, string> = {
  200: 'OK',
  301: 'Moved',
  302: 'Found',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Server Error',
  502: 'Bad Gateway',
  503: 'Unavailable',
}

interface UptimeDotProps {
  status: UptimeStatus
  lastCheckedAt: Date | null
  lastStatusCode: number | null
}

export function UptimeDot({ status, lastCheckedAt, lastStatusCode }: UptimeDotProps) {
  const colorClass = colorMap[status]

  let tooltipText: string
  if (lastCheckedAt) {
    tooltipText = `Last checked ${formatDistanceToNow(new Date(lastCheckedAt), { addSuffix: true })}`
  } else {
    tooltipText = 'Not yet checked'
  }

  if (lastStatusCode) {
    const label = statusCodeLabels[lastStatusCode]
    tooltipText += ` — ${lastStatusCode}${label ? ` ${label}` : ''}`
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-block size-2 rounded-full shrink-0 ${colorClass}`}
            aria-label={`Link status: ${status}`}
          />
        </TooltipTrigger>
        <TooltipContent>
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

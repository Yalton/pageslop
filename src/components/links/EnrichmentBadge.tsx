'use client'

import { Sparkles, AlertTriangle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { EnrichmentSource } from '@/types'

interface EnrichmentBadgeProps {
  source: EnrichmentSource
  error?: string | null
}

export function EnrichmentBadge({ source, error }: EnrichmentBadgeProps) {
  if (!source || source === 'rule') return null

  if (source === 'llm') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-0.5 text-xs text-violet-500">
              <Sparkles className="size-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Enhanced by Claude</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (source === 'llm_failed') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-0.5 text-xs text-amber-500">
              <AlertTriangle className="size-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">LLM enrichment failed — used rule-based</p>
            {error && <p className="text-xs text-muted-foreground">{error}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return null
}

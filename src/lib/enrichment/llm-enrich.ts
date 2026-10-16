/**
 * LLM-powered enrichment using the Anthropic SDK.
 * Returns the same EnrichmentResult shape as the rule-based enrich() function.
 * Falls back to null on any API error — caller handles fallback to rule-based.
 */

import Anthropic from '@anthropic-ai/sdk'
import { stripBoilerplate, type EnrichmentResult, type EnrichInput } from './classify'
import { CATEGORIES } from '@/types/index'

const MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `You are a precise content classifier for a bookmark manager.
Given a web page's URL, title, domain, existing description, body text excerpt, and (optionally) the user's existing tags, produce a JSON object with:
- "tags": an array of 4-6 specific, lowercase, single-word-or-hyphenated tags describing the page content (prefer specific terms over generic ones). Prefer the user's existing tags, using their exact names, when they fit the page; only invent a new tag when none of them fit
- "description": a concise 2-3 sentence summary of the page content (150-200 chars)
- "category": the single best-matching category from this list: ${CATEGORIES.join(', ')}. Choose the category by what the content itself is, not by the site it is on (for example, a music video is Entertainment, not News)

Respond ONLY with a valid JSON object matching this exact structure:
{"tags":["tag1","tag2","tag3","tag4"],"description":"...","category":"Technology"}`

/**
 * Enriches a link using the Anthropic API.
 * Returns EnrichmentResult or null on any error (auth failure, rate limit, network, etc.).
 */
export async function llmEnrich(
  opts: EnrichInput,
  apiKey: string
): Promise<EnrichmentResult | null> {
  const client = new Anthropic({ apiKey })

  const knownTags = [...(opts.knownTags ?? [])]
  const body = stripBoilerplate(opts.bodyText ?? '').trim().slice(0, 3000)

  const userContent = [
    opts.url && `URL: ${opts.url}`,
    opts.title && `Title: ${opts.title}`,
    opts.domain && `Domain: ${opts.domain}`,
    opts.existingDescription && `Description: ${opts.existingDescription}`,
    knownTags.length > 0 && `Existing tags: ${knownTags.join(', ')}`,
    body && `Content excerpt: ${body}`,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null

    // Strip markdown code fences if present (```json ... ```)
    let jsonText = textBlock.text.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    const parsed = JSON.parse(jsonText) as EnrichmentResult
    return parsed
  } catch (err) {
    console.error('[llmEnrich] error:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Validates an Anthropic API key by making a minimal test call.
 * Returns true if the key is valid and the account has credits.
 * Returns false on any error.
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  const client = new Anthropic({ apiKey })
  try {
    await client.messages.create({
      model: MODEL,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    })
    return true
  } catch {
    return false
  }
}

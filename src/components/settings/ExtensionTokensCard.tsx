'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { AlertCircle, Check, Copy, Puzzle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  formatTokenDate,
  validateTokenName,
  TOKEN_NAME_MAX,
  type ApiTokenSummary,
  type CreatedApiToken,
} from '@/lib/settings/token-format'

const TOKENS_URL = '/api/settings/tokens'
// Self-hosters of a fork can point this at their own docs.
const README_EXTENSION_URL =
  process.env.NEXT_PUBLIC_EXTENSION_DOCS_URL || 'https://github.com/Citreum-LLC/pageslop#browser-extension'

async function fetchTokens(url: string): Promise<ApiTokenSummary[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to load tokens')
  const body = (await res.json()) as { tokens: ApiTokenSummary[] }
  return body.tokens
}

const inputClass =
  'flex-1 min-w-[240px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function ExtensionTokensCard() {
  const { data: tokens, error: loadError, isLoading, mutate } = useSWR<ApiTokenSummary[]>(TOKENS_URL, fetchTokens)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedApiToken | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  async function handleCreate(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const validation = validateTokenName(name)
    if (validation) {
      setFormError(validation)
      return
    }
    setFormError(null)
    setCreating(true)
    try {
      const res = await fetch(TOKENS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setFormError(body?.error ?? 'Could not create token')
        return
      }
      const token = (await res.json()) as CreatedApiToken
      setCreated(token)
      setCopied(false)
      setName('')
      await mutate()
    } catch {
      setFormError('Could not create token')
    } finally {
      setCreating(false)
    }
  }

  async function handleCopy() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.token)
      setCopied(true)
      toast.success('Token copied')
    } catch {
      toast.error('Copy failed. Select the token and copy it manually.')
    }
  }

  async function handleRevoke(token: ApiTokenSummary) {
    if (!window.confirm(`Revoke "${token.name}"? Extensions using it will stop syncing.`)) return
    setRevokingId(token.id)
    try {
      const res = await fetch(`${TOKENS_URL}/${token.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) throw new Error('revoke failed')
      if (created?.id === token.id) setCreated(null)
      toast.success(`Revoked "${token.name}"`)
      await mutate()
    } catch {
      toast.error('Could not revoke token')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <>
      <h2 id="browser-extension" className="text-lg font-semibold mt-8 mb-4 scroll-mt-6">
        <span className="inline-flex items-center gap-2">
          <Puzzle className="size-5" />
          Browser Extension
        </span>
      </h2>

      <div className="bg-card rounded-lg border p-6">
        <h3 className="font-semibold mb-1">Extension tokens</h3>
        <p className="text-sm text-muted-foreground mb-4">
          The Firefox extension uses a token to save idle tabs to your To Revisit list. Create one token per browser.
        </p>

        <form onSubmit={handleCreate} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Token name, e.g. Firefox laptop"
            maxLength={TOKEN_NAME_MAX}
            aria-label="Token name"
            className={inputClass}
          />
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create token'}
          </Button>
        </form>

        {formError && (
          <div role="alert" className="mt-3 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {formError}
          </div>
        )}

        {created && (
          <div className="mt-4 rounded-md border border-primary/40 bg-primary/5 p-4">
            <p className="text-sm font-medium mb-2">
              Token &ldquo;{created.name}&rdquo; created. Copy it now, you won&apos;t see this again.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                readOnly
                value={created.token}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="New token"
                className={`${inputClass} font-mono`}
              />
              <Button type="button" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreated(null)}>
                Done
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6">
          <h4 className="text-sm font-semibold mb-2">Active tokens</h4>
          {isLoading && (
            <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading tokens
            </div>
          )}
          {loadError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              Could not load tokens
            </div>
          )}
          {tokens && tokens.length === 0 && (
            <p className="text-sm text-muted-foreground">No tokens yet.</p>
          )}
          {tokens && tokens.length > 0 && (
            <ul className="flex flex-col divide-y border rounded-md">
              {tokens.map((token) => (
                <li key={token.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                  <span className="text-sm font-medium flex-1 min-w-[120px] truncate">{token.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Created {formatTokenDate(token.createdAt)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Last used {formatTokenDate(token.lastUsedAt)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={revokingId === token.id}
                    onClick={() => handleRevoke(token)}
                  >
                    <Trash2 className="size-4" />
                    {revokingId === token.id ? 'Revoking...' : 'Revoke'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <h4 className="text-sm font-semibold mb-2">Setup</h4>
          <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
            <li>
              Install the extension by following the{' '}
              <a
                href={README_EXTENSION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Browser extension section of the README
              </a>
              .
            </li>
            <li>Create a token above and copy it.</li>
            <li>
              Open the extension&apos;s settings. Enter this server&apos;s URL (the address in your browser bar, without{' '}
              <code className="font-mono">/dashboard</code>) and paste the token.
            </li>
            <li>Click Save. The extension checks the connection and shows whether it worked.</li>
          </ol>
        </div>
      </div>
    </>
  )
}

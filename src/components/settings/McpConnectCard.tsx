'use client'

import { useEffect, useState } from 'react'
import { Bot, Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const MCP_DOCS_URL =
  process.env.NEXT_PUBLIC_MCP_DOCS_URL || 'https://github.com/Citreum-LLC/pageslop/blob/master/docs/mcp.md'

const preClass = 'flex-1 min-w-[240px] overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs'

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Copy failed. Select the text and copy it manually.')
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      <pre title={label} className={preClass}>
        {text}
      </pre>
      <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

/** Connection instructions for the /api/mcp endpoint. Tokens come from the API tokens card above. */
export function McpConnectCard() {
  // The browser's origin is this server's public address; read it after mount
  // so server and client render the same markup.
  const [origin, setOrigin] = useState('https://<your-pageslop-host>')
  useEffect(() => setOrigin(window.location.origin), [])

  const endpoint = `${origin}/api/mcp`
  const claudeCode = `claude mcp add --transport http pageslop ${endpoint} --header "Authorization: Bearer ps_..."`
  const jsonConfig = JSON.stringify(
    {
      mcpServers: {
        pageslop: { type: 'http', url: endpoint, headers: { Authorization: 'Bearer ps_...' } },
      },
    },
    null,
    2,
  )

  return (
    <>
      <h2 id="mcp" className="text-lg font-semibold mt-8 mb-4 scroll-mt-6">
        <span className="inline-flex items-center gap-2">
          <Bot className="size-5" />
          Connect an AI agent (MCP)
        </span>
      </h2>

      <div className="bg-card rounded-lg border p-6">
        <p className="text-sm text-muted-foreground mb-4">
          AI agents such as Claude Code and Claude Desktop can search, read and save your links through
          Pageslop&apos;s Model Context Protocol server. Create an API token above with{' '}
          <code className="font-mono">Read links and tags</code> (and <code className="font-mono">Save links</code>{' '}
          if the agent should save links), then replace <code className="font-mono">ps_...</code> below with it.
        </p>

        <h3 className="text-sm font-semibold mb-2">Endpoint</h3>
        <CopyBlock label="MCP endpoint" text={endpoint} />

        <h3 className="text-sm font-semibold mt-4 mb-2">Claude Code</h3>
        <CopyBlock label="Claude Code command" text={claudeCode} />

        <h3 className="text-sm font-semibold mt-4 mb-2">Other clients (JSON config)</h3>
        <CopyBlock label="MCP config" text={jsonConfig} />

        <p className="mt-4 text-xs text-muted-foreground">
          Tools: <code className="font-mono">search_links</code>, <code className="font-mono">get_link</code>,{' '}
          <code className="font-mono">list_tags</code>, <code className="font-mono">save_link</code>. Treat the
          token like a password; revoke it above to disconnect the agent.{' '}
          <a
            href={MCP_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            MCP docs
          </a>
        </p>
      </div>
    </>
  )
}

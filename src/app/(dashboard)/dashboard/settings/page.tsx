'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Upload, FileDown, CheckCircle, AlertCircle, Key, Trash2, Lock } from 'lucide-react'
import { ExtensionTokensCard } from '@/components/settings/ExtensionTokensCard'
import { McpConnectCard } from '@/components/settings/McpConnectCard'

interface ImportState {
  jobId: string | null
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error'
  processedCount: number
  totalCount: number
  errorMessage: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting'>('idle')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [importState, setImportState] = useState<ImportState>({
    jobId: null,
    status: 'idle',
    processedCount: 0,
    totalCount: 0,
    errorMessage: null,
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // LLM Integration state
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [maskedKey, setMaskedKey] = useState<string | null>(null)
  const [hasKey, setHasKey] = useState(false)
  const [keyStatus, setKeyStatus] = useState<'idle' | 'saving' | 'removing' | 'error'>('idle')
  const [keyError, setKeyError] = useState<string | null>(null)
  const [keyLoaded, setKeyLoaded] = useState(false)

  // Fetch current key status on mount
  useEffect(() => {
    fetch('/api/settings/api-key')
      .then((res) => res.json())
      .then((data: { hasKey: boolean; maskedKey?: string }) => {
        if (data.hasKey) {
          setHasKey(true)
          setMaskedKey(data.maskedKey ?? null)
        } else {
          setHasKey(false)
          setMaskedKey(null)
        }
      })
      .catch(() => {
        // On error, assume no key — don't block the UI
        setHasKey(false)
        setMaskedKey(null)
      })
      .finally(() => {
        setKeyLoaded(true)
      })
  }, [])

  const handleSaveKey = useCallback(async () => {
    setKeyStatus('saving')
    setKeyError(null)
    try {
      const res = await fetch('/api/settings/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput }),
      })
      if (res.ok) {
        const data = await res.json() as { maskedKey: string }
        setHasKey(true)
        setMaskedKey(data.maskedKey)
        setApiKeyInput('')
        setKeyStatus('idle')
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to save key' })) as { error?: string }
        setKeyError(err.error ?? 'Failed to save key')
        setKeyStatus('error')
      }
    } catch {
      setKeyError('Network error. Please try again.')
      setKeyStatus('error')
    }
  }, [apiKeyInput])

  const handleRemoveKey = useCallback(async () => {
    setKeyStatus('removing')
    setKeyError(null)
    try {
      const res = await fetch('/api/settings/api-key', { method: 'DELETE' })
      if (res.ok) {
        setHasKey(false)
        setMaskedKey(null)
        setKeyStatus('idle')
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to remove key' })) as { error?: string }
        setKeyError(err.error ?? 'Failed to remove key')
        setKeyStatus('error')
      }
    } catch {
      setKeyError('Network error. Please try again.')
      setKeyStatus('error')
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  const startPolling = useCallback(
    (jobId: string, total: number) => {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/import/progress?jobId=${jobId}`)
          if (!res.ok) {
            stopPolling()
            return
          }
          const data = await res.json()

          setImportState((prev) => ({
            ...prev,
            processedCount: data.processedUrls,
            totalCount: data.totalUrls,
          }))

          if (data.status === 'complete') {
            stopPolling()
            setImportState((prev) => ({
              ...prev,
              status: 'complete',
              processedCount: data.totalUrls,
            }))
          }
        } catch {
          // ignore polling errors
        }
      }, 3000)
    },
    [stopPolling]
  )

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.html') && file.type !== 'text/html') {
        setImportState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: 'Please upload an HTML file exported from your browser.',
        }))
        return
      }

      setImportState({
        jobId: null,
        status: 'uploading',
        processedCount: 0,
        totalCount: 0,
        errorMessage: null,
      })

      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch('/api/import/bookmarks', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Upload failed' }))
          setImportState((prev) => ({
            ...prev,
            status: 'error',
            errorMessage: err.error || 'Upload failed',
          }))
          return
        }

        const data = await res.json()

        if (data.total === 0) {
          setImportState({
            jobId: null,
            status: 'complete',
            processedCount: 0,
            totalCount: 0,
            errorMessage: null,
          })
          return
        }

        setImportState({
          jobId: data.jobId,
          status: 'processing',
          processedCount: 0,
          totalCount: data.total,
          errorMessage: null,
        })

        startPolling(data.jobId, data.total)
      } catch {
        setImportState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: 'Network error. Please try again.',
        }))
      }
    },
    [startPolling]
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      // Reset input so the same file can be re-selected
      e.target.value = ''
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleZoneClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const isImporting = importState.status === 'uploading' || importState.status === 'processing'

  return (
    <div className="flex flex-col min-h-screen p-6">
      <h1 className="text-[20px] font-semibold leading-[1.2] mb-6">Settings</h1>

      <h2 className="text-lg font-semibold mt-2 mb-4">Data Management</h2>

      {/* Import section */}
      <div className="bg-card rounded-lg border p-6 mb-4">
        <h3 className="font-semibold mb-1">Import Bookmarks</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload a bookmarks HTML file exported from Chrome, Firefox, or Safari.
        </p>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".html"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isImporting}
        />

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={isImporting ? undefined : handleZoneClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleZoneClick()
          }}
          className={[
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors',
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50',
            isImporting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          ].join(' ')}
        >
          <Upload className="size-8 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Click to browse</span> or drag and drop
          </div>
          <p className="text-xs text-muted-foreground">HTML bookmarks file</p>
        </div>

        {/* Status messages */}
        {importState.status === 'uploading' && (
          <div className="mt-3 text-sm text-muted-foreground animate-pulse">
            Uploading and parsing bookmarks...
          </div>
        )}

        {importState.status === 'processing' && (
          <div className="mt-3 text-sm text-muted-foreground">
            Importing... {importState.processedCount} of {importState.totalCount}
          </div>
        )}

        {importState.status === 'complete' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="size-4" />
            {importState.totalCount === 0
              ? 'No new bookmarks to import.'
              : `Import complete! ${importState.totalCount} bookmarks imported.`}
          </div>
        )}

        {importState.status === 'error' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {importState.errorMessage}
          </div>
        )}
      </div>

      {/* Export section */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="font-semibold mb-1">Export Links</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Download your link collection for backup or migration.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = '/api/export/json'
            }}
          >
            <FileDown />
            Export JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = '/api/export/html'
            }}
          >
            <FileDown />
            Export HTML
          </Button>
        </div>
      </div>

      {/* LLM Integration section */}
      <h2 className="text-lg font-semibold mt-8 mb-4">
        <span className="inline-flex items-center gap-2">
          <Key className="size-5" />
          LLM Integration
        </span>
      </h2>

      {keyLoaded && (
        <div className="bg-card rounded-lg border p-6">
          <h3 className="font-semibold mb-1">Anthropic API Key</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add your Anthropic API key to enable AI-powered tags and descriptions for newly saved links.
          </p>

          {!hasKey ? (
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-ant-..."
                className="flex-1 min-w-[240px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                disabled={keyStatus === 'saving'}
              />
              <Button
                variant="default"
                onClick={handleSaveKey}
                disabled={keyStatus === 'saving' || !apiKeyInput.trim()}
              >
                {keyStatus === 'saving' ? 'Saving...' : 'Save Key'}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm bg-muted px-3 py-2 rounded-md text-muted-foreground">
                Current key: {maskedKey}
              </span>
              <Button
                variant="destructive"
                onClick={handleRemoveKey}
                disabled={keyStatus === 'removing'}
              >
                {keyStatus === 'removing' ? 'Removing...' : 'Remove Key'}
              </Button>
            </div>
          )}

          {keyStatus === 'error' && keyError && (
            <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {keyError}
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Your key is encrypted at rest and never stored in plain text. Only newly saved links will use LLM enrichment.
      </p>

      {/* Browser Extension */}
      <ExtensionTokensCard />

      {/* MCP server for AI agents */}
      <McpConnectCard />

      {/* Change Password */}
      <h2 className="text-lg font-semibold mt-8 mb-4">
        <span className="inline-flex items-center gap-2">
          <Lock className="size-5" />
          Account Security
        </span>
      </h2>

      <div className="bg-card rounded-lg border p-6">
        <h3 className="font-semibold mb-1">Change Password</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Update your account password.
        </p>
        <form
          className="flex flex-col gap-3 max-w-sm"
          onSubmit={async (e) => {
            e.preventDefault()
            setPasswordError(null)

            if (newPassword.length < 8) {
              setPasswordError('New password must be at least 8 characters.')
              setPasswordStatus('error')
              return
            }
            if (newPassword !== confirmNewPassword) {
              setPasswordError('Passwords do not match.')
              setPasswordStatus('error')
              return
            }

            setPasswordStatus('saving')
            try {
              const { error } = await (await import('@/lib/auth/client')).authClient.changePassword({
                currentPassword,
                newPassword,
                revokeOtherSessions: true,
              })

              if (error) {
                setPasswordError(error.message || 'Failed to change password.')
                setPasswordStatus('error')
                return
              }

              setPasswordStatus('success')
              setCurrentPassword('')
              setNewPassword('')
              setConfirmNewPassword('')
              setTimeout(() => setPasswordStatus('idle'), 5000)
            } catch {
              setPasswordError('Something went wrong. Please try again.')
              setPasswordStatus('error')
            }
          }}
        >
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={passwordStatus === 'saving'}
            required
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min. 8 characters)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={passwordStatus === 'saving'}
            required
          />
          <input
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder="Confirm new password"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={passwordStatus === 'saving'}
            required
          />
          <Button type="submit" disabled={passwordStatus === 'saving'} className="w-fit">
            {passwordStatus === 'saving' ? 'Updating...' : 'Update Password'}
          </Button>

          {passwordStatus === 'success' && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="size-4" />
              Password updated successfully.
            </div>
          )}
          {passwordStatus === 'error' && passwordError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {passwordError}
            </div>
          )}
        </form>
      </div>

      {/* Danger Zone */}
      <h2 className="text-lg font-semibold mt-8 mb-4 text-destructive">
        <span className="inline-flex items-center gap-2">
          <Trash2 className="size-5" />
          Danger Zone
        </span>
      </h2>

      <div className="bg-card rounded-lg border border-destructive/30 p-6">
        <h3 className="font-semibold mb-1">Delete Account</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Permanently delete your account and all your data. This includes all saved links, tags, and settings. This action cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
            Delete My Account
          </Button>
        ) : (
          <div className="flex flex-col gap-3 max-w-sm">
            <p className="text-sm font-medium">
              Type <strong>DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="rounded-md border border-destructive/50 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
              disabled={deleteStatus === 'deleting'}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={deleteConfirmText !== 'DELETE' || deleteStatus === 'deleting'}
                onClick={async () => {
                  setDeleteStatus('deleting')
                  try {
                    const res = await fetch('/api/settings/account', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ confirm: 'DELETE' }),
                    })
                    if (res.ok) {
                      router.push('/login')
                    }
                  } catch {
                    setDeleteStatus('idle')
                  }
                }}
              >
                {deleteStatus === 'deleting' ? 'Deleting...' : 'Permanently Delete'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmText('')
                }}
                disabled={deleteStatus === 'deleting'}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

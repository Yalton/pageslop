// Runs once when the Next.js server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { isBuildPhase, validateServerEnv } = await import('@/lib/env')
  if (isBuildPhase()) return
  try {
    validateServerEnv(process.env)
  } catch (err) {
    // Next logs a throw here but keeps the process up, serving only errors.
    // Exit so the container restarts and the message is the last log line.
    console.error(`[startup] ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
}

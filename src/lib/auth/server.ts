import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@/lib/db/client'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days (persistent sessions per CONTEXT.md)
    updateAge: 60 * 60 * 24, // refresh if >24h old
  },
  plugins: [nextCookies()], // must be last plugin
})

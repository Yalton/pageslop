import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@/lib/db/client'
import { sendEmail } from '@/lib/email/send'
import { verificationEmail, passwordResetEmail } from '@/lib/email/templates'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const { subject, html } = passwordResetEmail(url)
      await sendEmail({ to: user.email, subject, html })
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // Ensure callback goes to /dashboard (not /) after verification
      const verifyUrl = url.includes('callbackURL=')
        ? url
        : url + (url.includes('?') ? '&' : '?') + 'callbackURL=%2Fdashboard'
      const { subject, html } = verificationEmail(verifyUrl)
      await sendEmail({ to: user.email, subject, html })
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh if >24h old
  },
  plugins: [nextCookies()], // must be last plugin
})

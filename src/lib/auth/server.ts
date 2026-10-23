import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@/lib/db/client'
import { sendEmail } from '@/lib/email/send'
import { verificationEmail, passwordResetEmail } from '@/lib/email/templates'
import { signupAllowed } from '@/lib/auth/signup'
import { isBuildPhase, parseList, requireAuthSecret, requireAuthUrl } from '@/lib/env'

// Fail at startup on a missing or placeholder secret/URL. `next build` imports
// this module without runtime env, so the check is skipped during the build.
const buildPhase = isBuildPhase()
const secret = buildPhase ? process.env.BETTER_AUTH_SECRET : requireAuthSecret(process.env.BETTER_AUTH_SECRET)
const baseURL = buildPhase ? process.env.BETTER_AUTH_URL : requireAuthUrl(process.env.BETTER_AUTH_URL)

export const auth = betterAuth({
  secret,
  baseURL,
  trustedOrigins: baseURL ? [baseURL] : [],
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    disableSignUp: !signupAllowed(process.env.ALLOW_SIGNUP),
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
  advanced: {
    useSecureCookies: true,
    // Client IP for rate limiting. TRUSTED_IP_HEADER names the header your
    // proxy sets (cf-connecting-ip behind Cloudflare). A multi-hop
    // x-forwarded-for chain is only resolved when TRUSTED_PROXIES lists the
    // proxy addresses; otherwise only a single-value header is trusted.
    ipAddress: {
      ipAddressHeaders: parseList(process.env.TRUSTED_IP_HEADER, true) ?? ['x-forwarded-for'],
      trustedProxies: parseList(process.env.TRUSTED_PROXIES),
    },
  },
  plugins: [nextCookies()], // must be last plugin
})

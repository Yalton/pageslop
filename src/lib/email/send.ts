import nodemailer from 'nodemailer'

// Without SMTP_HOST the instance has no mail server: emails (verification and
// password reset links) are written to the server log instead, so a single-user
// self-hosted instance can be set up with `docker compose logs app`.
const smtpConfigured = Boolean(process.env.SMTP_HOST)
const port = Number(process.env.SMTP_PORT) || 465

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // Port 465 is implicit TLS; other ports (587) upgrade with STARTTLS.
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!transporter) {
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    console.log(`[email] SMTP_HOST is not set, so "${subject}" for ${to} was not sent. Links: ${links.join(' ')}`)
    return
  }
  console.log(`[email] Sending "${subject}" to ${to}`)
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    })
    console.log(`[email] Sent successfully: ${info.messageId}`)
  } catch (err) {
    console.error(`[email] Failed to send:`, err)
    throw err
  }
}

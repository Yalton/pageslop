import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.zoho.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  console.log(`[email] Sending "${subject}" to ${to} via ${process.env.SMTP_USER}`)
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

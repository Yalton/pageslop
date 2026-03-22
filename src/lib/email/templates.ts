const APP_NAME = 'Pageslop'

function baseLayout(content: string) {
  return `
    <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a;">
      <div style="padding: 32px 24px;">
        <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 24px 0;">${APP_NAME}</h1>
        ${content}
        <p style="margin: 32px 0 0 0; font-size: 12px; color: #888;">
          You received this email because you have an account at ${APP_NAME}.
        </p>
      </div>
    </div>
  `
}

export function verificationEmail(url: string) {
  return {
    subject: `Verify your email for ${APP_NAME}`,
    html: baseLayout(`
      <p style="margin: 0 0 16px 0;">Click the button below to verify your email address.</p>
      <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #18181b; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Verify Email
      </a>
      <p style="margin: 16px 0 0 0; font-size: 13px; color: #666;">
        If you didn't create an account, you can safely ignore this email.
      </p>
      <p style="margin: 12px 0 0 0; font-size: 12px; color: #999; word-break: break-all;">${url}</p>
    `),
  }
}

export function passwordResetEmail(url: string) {
  return {
    subject: `Reset your ${APP_NAME} password`,
    html: baseLayout(`
      <p style="margin: 0 0 16px 0;">We received a request to reset your password. Click the button below to choose a new password.</p>
      <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #18181b; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Reset Password
      </a>
      <p style="margin: 16px 0 0 0; font-size: 13px; color: #666;">
        This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      </p>
      <p style="margin: 12px 0 0 0; font-size: 12px; color: #999; word-break: break-all;">${url}</p>
    `),
  }
}

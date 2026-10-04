/**
 * Whether new account sign-up is allowed.
 * Pass process.env.ALLOW_SIGNUP on the server or
 * process.env.NEXT_PUBLIC_ALLOW_SIGNUP in client components.
 * Only the literal "false" (case-insensitive, trimmed) disables sign-up.
 */
export function signupAllowed(value?: string): boolean {
  return value?.trim().toLowerCase() !== 'false'
}

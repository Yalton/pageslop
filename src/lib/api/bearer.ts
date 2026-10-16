import { authenticateBearer } from '@/lib/auth/api-token'
import type { TokenScope } from '@/lib/auth/token-scopes'

/** A JSON error body `{ error }` with the given status. */
export function jsonError(status: number, message: string, headers?: HeadersInit): Response {
  return Response.json({ error: message }, { status, headers })
}

/**
 * Authenticate a bearer-token request and check it carries `scope`.
 * Returns the token's user, or the 401/403 Response to send back.
 */
export async function requireScope(
  req: Request,
  scope: TokenScope,
): Promise<{ userId: string } | Response> {
  const authed = await authenticateBearer(req)
  if (!authed) {
    return jsonError(401, 'Unauthorized: send a valid API token as "Authorization: Bearer ps_..."', {
      'WWW-Authenticate': 'Bearer realm="pageslop"',
    })
  }
  if (!authed.scopes.includes(scope)) {
    return jsonError(403, `Forbidden: this token lacks the "${scope}" scope`, {
      'WWW-Authenticate': `Bearer realm="pageslop", error="insufficient_scope", scope="${scope}"`,
    })
  }
  return { userId: authed.userId }
}

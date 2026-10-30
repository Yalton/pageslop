// Response headers applied to every route by next.config.ts.
//
// Next's App Router streams its payload through inline <script> tags, so
// script-src needs 'unsafe-inline' unless every page renders dynamically with a
// nonce; the policy still blocks scripts from other origins, plugins, framing
// and form posts elsewhere. The worker caches link favicons and preview images
// (see image-cache.ts), so img-src needs no outside origin and a viewer's
// browser never contacts the sites users save.

export interface Header {
  key: string
  value: string
}

export function contentSecurityPolicy(dev: boolean): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // React's dev overlay and fast refresh evaluate code at runtime.
    'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(dev ? ['ws:'] : [])],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  }
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

export function securityHeaders(dev: boolean): Header[] {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(dev) },
    // For browsers that predate frame-ancestors.
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ]
}

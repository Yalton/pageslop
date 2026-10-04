/** Root nav item that must only be active on its exact path. */
const EXACT_ONLY = new Set(['/dashboard'])

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '#') return false
  if (pathname === href) return true
  if (EXACT_ONLY.has(href)) return false
  return pathname.startsWith(`${href}/`)
}

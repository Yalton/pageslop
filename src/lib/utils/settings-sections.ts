/**
 * Settings page sections, in display order (most used first, destructive last).
 * `id` doubles as the DOM anchor: other pages link to #browser-extension and #mcp,
 * so those ids must not change.
 */
export const SETTINGS_SECTIONS = [
  { id: 'browser-extension', label: 'Browser extension', description: 'API tokens for the Firefox extension.' },
  { id: 'mcp', label: 'AI agents (MCP)', description: 'Let Claude and other agents use your links.' },
  { id: 'llm', label: 'LLM integration', description: 'AI-generated tags and descriptions.' },
  { id: 'account', label: 'Account security', description: 'Change your password.' },
  { id: 'data', label: 'Import & export', description: 'Bring bookmarks in, take your links out.' },
  { id: 'danger-zone', label: 'Danger zone', description: 'Permanently delete your account.' },
] as const

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']

export function isSettingsSectionId(value: string): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((s) => s.id === value)
}

export interface SectionPosition {
  id: string
  /** Distance from the viewport top to the section top, in px (getBoundingClientRect().top). */
  top: number
}

/**
 * Which section the in-page nav should highlight.
 *
 * The active section is the last one whose top has scrolled past `offset`
 * (the height of any sticky chrome plus a little slack). Before the first
 * section reaches the line, the first section is active. When the page is
 * scrolled to the bottom the last section wins, since short trailing sections
 * can never reach the line on their own.
 */
export function getActiveSectionId(
  positions: readonly SectionPosition[],
  offset: number,
  atBottom = false,
): string | null {
  if (positions.length === 0) return null
  if (atBottom) return positions[positions.length - 1].id
  let active = positions[0].id
  for (const p of positions) {
    if (p.top <= offset) active = p.id
  }
  return active
}

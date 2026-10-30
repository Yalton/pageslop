// @vitest-environment jsdom
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LinkCard } from '@/components/links/LinkCard'
import { SearchInput } from '@/components/links/SearchInput'
import { OPEN_SAVE_DIALOG_EVENT, useLinkShortcuts } from '@/lib/hooks/useLinkShortcuts'
import type { LinkWithTags } from '@/types'

afterEach(cleanup)

function makeLink(id: string, title: string): LinkWithTags {
  return {
    id,
    userId: 'user-1',
    url: `https://example.com/${id}`,
    title,
    description: null,
    ogImage: null,
    favicon: null,
    domain: 'example.com',
    status: 'ready',
    category: null,
    categorySource: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    enrichmentSource: 'rule',
    enrichmentError: null,
    uptimeStatus: 'up',
    lastStatusCode: null,
    lastCheckedAt: null,
    consecutiveFailures: 0,
    source: 'manual',
    stashState: null,
    stashedAt: null,
    tags: [],
  }
}

const links = [makeLink('a', 'First link'), makeLink('b', 'Second link'), makeLink('c', 'Third link')]

/** The dashboard pieces the shortcuts touch: search, save input and a list of cards. */
function Harness({ onOpenDetail, onHelp }: { onOpenDetail: (link: LinkWithTags) => void; onHelp: () => void }) {
  const search = useRef<HTMLDivElement>(null)
  const save = useRef<HTMLDivElement>(null)
  const results = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  useLinkShortcuts({ search, save, results, onHelp })
  return (
    <>
      <div ref={save}>
        <input aria-label="Save URL" />
      </div>
      <div ref={search}>
        <SearchInput value={query} onChange={setQuery} />
      </div>
      <div ref={results}>
        {links.map((link) => (
          <LinkCard key={link.id} link={link} onDelete={vi.fn()} onUndoDelete={vi.fn()} onOpenDetail={onOpenDetail} />
        ))}
      </div>
    </>
  )
}

function setup() {
  const onOpenDetail = vi.fn()
  const onHelp = vi.fn()
  render(<Harness onOpenDetail={onOpenDetail} onHelp={onHelp} />)
  return { onOpenDetail, onHelp, user: userEvent.setup() }
}

describe('dashboard keyboard shortcuts', () => {
  it("'/' focuses search without typing a slash", async () => {
    const { user } = setup()
    await user.keyboard('/')
    const search = screen.getByPlaceholderText('Search links...') as HTMLInputElement
    expect(document.activeElement).toBe(search)
    expect(search.value).toBe('')
  })

  it('j and k move focus between cards, and Enter opens the focused one', async () => {
    const { onOpenDetail, user } = setup()
    const card = (title: string) => screen.getByRole('button', { name: title })

    await user.keyboard('j')
    expect(document.activeElement).toBe(card('First link'))
    await user.keyboard('jj')
    expect(document.activeElement).toBe(card('Third link'))
    await user.keyboard('j')
    expect(document.activeElement).toBe(card('Third link'))
    await user.keyboard('k')
    expect(document.activeElement).toBe(card('Second link'))

    await user.keyboard('{Enter}')
    expect(onOpenDetail).toHaveBeenCalledWith(links[1])
  })

  it('ignores shortcuts while typing in a field', async () => {
    const { onHelp, user } = setup()
    await user.click(screen.getByPlaceholderText('Search links...'))
    await user.keyboard('j/?')
    expect((screen.getByPlaceholderText('Search links...') as HTMLInputElement).value).toBe('j/?')
    expect(onHelp).not.toHaveBeenCalled()
  })

  it("'n' focuses the inline save input on desktop", async () => {
    const { user } = setup()
    await user.keyboard('n')
    expect(document.activeElement).toBe(screen.getByLabelText('Save URL'))
  })

  it("'n' asks for the save dialog on mobile", async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const onOpenSave = vi.fn()
    window.addEventListener(OPEN_SAVE_DIALOG_EVENT, onOpenSave)
    try {
      const { user } = setup()
      await user.keyboard('n')
      expect(onOpenSave).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener(OPEN_SAVE_DIALOG_EVENT, onOpenSave)
      vi.unstubAllGlobals()
    }
  })

  it("'?' opens the shortcut list", async () => {
    const { onHelp, user } = setup()
    await user.keyboard('?')
    expect(onHelp).toHaveBeenCalledTimes(1)
  })
})

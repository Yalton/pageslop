// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LinkCard } from '@/components/links/LinkCard'
import { LinkCardList } from '@/components/links/LinkCardList'
import type { LinkWithTags } from '@/types'

afterEach(cleanup)

const link: LinkWithTags = {
  id: 'link-1',
  userId: 'user-1',
  url: 'https://example.com/article',
  title: 'An example article',
  description: 'Something worth reading',
  ogImage: null,
  favicon: null,
  domain: 'example.com',
  status: 'ready',
  category: 'Technology',
  categorySource: 'rule',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  enrichmentSource: 'rule',
  enrichmentError: null,
  uptimeStatus: 'up',
  lastStatusCode: 200,
  lastCheckedAt: null,
  consecutiveFailures: 0,
  source: 'manual',
  stashState: null,
  stashedAt: null,
  tags: [{ id: 'tag-1', userId: 'user-1', name: 'reading', source: 'user' }],
}

const variants = [
  ['LinkCard', LinkCard],
  ['LinkCardList', LinkCardList],
] as const

describe.each(variants)('%s keyboard access', (_name, Card) => {
  function setup(overrides: Partial<Parameters<typeof Card>[0]> = {}) {
    const onOpenDetail = vi.fn()
    const onToggleSelect = vi.fn()
    render(
      <Card
        link={link}
        onDelete={vi.fn()}
        onUndoDelete={vi.fn()}
        onOpenDetail={onOpenDetail}
        onTagClick={vi.fn()}
        onToggleSelect={onToggleSelect}
        {...overrides}
      />,
    )
    return { onOpenDetail, onToggleSelect, user: userEvent.setup() }
  }

  async function tabTo(user: ReturnType<typeof userEvent.setup>, el: HTMLElement) {
    for (let i = 0; i < 10 && document.activeElement !== el; i++) await user.tab()
    expect(document.activeElement).toBe(el)
  }

  it('opens the detail panel with Enter', async () => {
    const { onOpenDetail, user } = setup()
    await tabTo(user, screen.getByRole('button', { name: 'An example article' }))
    await user.keyboard('{Enter}')
    expect(onOpenDetail).toHaveBeenCalledWith(link)
  })

  it('opens the detail panel with Space', async () => {
    const { onOpenDetail, user } = setup()
    await tabTo(user, screen.getByRole('button', { name: 'An example article' }))
    await user.keyboard(' ')
    expect(onOpenDetail).toHaveBeenCalledWith(link)
  })

  it('toggles selection instead of opening in selection mode', async () => {
    const { onOpenDetail, onToggleSelect, user } = setup({ selecting: true })
    await tabTo(user, screen.getByRole('button', { name: 'An example article' }))
    await user.keyboard('{Enter}')
    expect(onToggleSelect).toHaveBeenCalledWith(link.id, false)
    expect(onOpenDetail).not.toHaveBeenCalled()
  })

  it('keeps inner controls separate from the open button', async () => {
    const { onOpenDetail, onToggleSelect, user } = setup()
    await user.click(screen.getByRole('checkbox', { name: `Select ${link.title}` }))
    await user.click(screen.getByRole('button', { name: 'Show links tagged reading' }))
    expect(onToggleSelect).toHaveBeenCalledTimes(1)
    expect(onOpenDetail).not.toHaveBeenCalled()
  })
})

describe('LinkCard without a title', () => {
  it('still has a labelled button that opens the detail panel', async () => {
    const onOpenDetail = vi.fn()
    const untitled = { ...link, title: null }
    render(<LinkCard link={untitled} onDelete={vi.fn()} onUndoDelete={vi.fn()} onOpenDetail={onOpenDetail} />)
    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: link.url })
    for (let i = 0; i < 10 && document.activeElement !== button; i++) await user.tab()
    await user.keyboard('{Enter}')
    expect(onOpenDetail).toHaveBeenCalledWith(untitled)
  })
})

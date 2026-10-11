import { describe, it, expect } from 'vitest'
import { isTopicSignal, matchTopics, TOPICS } from '@/lib/enrichment/topics'
import { normalizeTag } from '@/lib/enrichment/classify'

describe('matchTopics', () => {
  it('tags self-hosted apps on private hosts from the title alone', () => {
    expect(matchTopics({ title: 'Jellyfin', url: 'https://jellyfin.billbert.co/' })).toContain('self-hosted')
    expect(matchTopics({ title: 'Slop Director', url: 'http://192.168.50.24:3000/' })).toContain('self-hosted')
    expect(matchTopics({ title: 'Pi-hole flowController', url: 'http://192.168.50.78/admin' })).toContain('self-hosted')
  })

  it('finds social from a host label', () => {
    expect(matchTopics({ title: 'Postiz Register', url: 'https://social.citreum.com' })).toContain('social')
  })

  it('finds ai from a title word', () => {
    expect(
      matchTopics({ title: 'PSA: reminder that Minimax H3 is forbidden to use : r/LocalLLaMA', url: 'https://reddit.com/r/LocalLLaMA/x' }),
    ).toContain('ai')
  })

  it('finds gaming and game dev from a description and host', () => {
    const t = matchTopics({
      title: 'Steamworks - Build & Distribute Your Games on Steam',
      description: 'Steamworks is a set of tools and services that help game developers',
      url: 'https://partner.steamgames.com/',
    })
    expect(t).toContain('gaming')
    expect(t).toContain('gamedev')
  })

  it('uses host words when the page was a bot challenge', () => {
    expect(matchTopics({ title: 'Just a moment...', url: 'https://dash.cloudflare.com/x' })).toContain('cloud')
    expect(matchTopics({ title: 'Just a moment...', url: 'https://itch.io/games' })).toContain('gaming')
  })

  it('ignores a description that is leaked HTML', () => {
    expect(
      matchTopics({ title: 'x', description: '<div class="h2"><span id="challenge-error-text">Enable JavaScript and cookies</span></div>' }),
    ).toEqual([])
  })

  it('needs more than one stray body mention', () => {
    expect(matchTopics({ title: 'Recipes', bodyText: 'a recipe blog that once mentioned python' })).not.toContain('code')
    expect(
      matchTopics({ title: 'Notes', bodyText: 'python and typescript and rust compilers explained for developers' }),
    ).toContain('code')
  })

  it('matches whole words only', () => {
    expect(matchTopics({ title: 'Said the gamer' })).not.toContain('ai')
    expect(matchTopics({ title: 'Raid planner' })).toEqual([])
  })

  it('returns at most three topics, strongest first', () => {
    const t = matchTopics({
      title: 'AI game music security cloud linux',
      description: 'ai llm machine learning',
    })
    expect(t.length).toBeLessThanOrEqual(3)
    expect(t[0]).toBe('ai')
  })

  it('every topic tag is a clean, unique tag name', () => {
    const tags = TOPICS.map((t) => t.tag)
    expect(new Set(tags).size).toBe(tags.length)
    for (const tag of tags) expect(tag).toMatch(/^[a-z][a-z-]*[a-z]$/)
    // The tag cleanup folds plurals; a topic tag must survive it unchanged.
    for (const tag of tags) expect(normalizeTag(tag)).toBe(tag)
  })

  it('tags texture and 3D asset sites as design', () => {
    expect(matchTopics({ title: 'ambientCG - Free Textures, HDRIs and Models' })).toContain('design')
  })
})

describe('isTopicSignal', () => {
  it('is true only for a signal of one of the given topics', () => {
    expect(isTopicSignal('game', ['gaming'])).toBe(true)
    expect(isTopicSignal('game', ['ai'])).toBe(false)
  })
})

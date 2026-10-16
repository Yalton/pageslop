import { describe, it, expect } from 'vitest'
import { categorize, enrich } from '@/lib/enrichment/classify'

// Body text the scraper gets for every YouTube watch page: only the site footer.
const YOUTUBE_FOOTER =
  'About Press Copyright Contact us Creators Advertise Developers Terms Privacy Policy & Safety How YouTube works Test new features NFL Sunday Ticket © 2026 Google LLC'

function youtube(title: string, description: string | null = null) {
  return enrich({ bodyText: YOUTUBE_FOOTER, existingDescription: description, domain: 'youtube.com', title }).category
}

describe('categorize regressions (pageslop-atk)', () => {
  it('does not file music videos under News because of the YouTube footer', () => {
    expect(youtube('Snow Strippers')).toBe('Entertainment')
    expect(youtube('tiffany day - american girl (krisnawa flip)')).toBe('Entertainment')
    expect(youtube('Hatsune Miku x Brazilian Miku | SPYRAL - Never See')).toBe('Entertainment')
    expect(youtube('GHOST DATA & YMIR - Dream Eater')).toBe('Entertainment')
  })

  it('still lets strong title or description signals beat the video-site default', () => {
    expect(youtube('Using Satellite Photos to Trade Stocks', 'Trading stocks with satellite data and investment signals')).toBe('Finance')
  })

  it('matches whole words, not substrings', () => {
    // "brain" contains "ai", "start" contains "art", "reporter" contains "report"
    expect(categorize('brain brain start')).toBe('Other')
    expect(categorize('the updated reporter')).toBe('Other')
  })

  it('matches simple plurals of a signal', () => {
    expect(categorize('developers write programs in databases')).toBe('Technology')
  })

  it('uses the domain as a prior for known sites', () => {
    expect(categorize('Ornith-1.5 - a ornith-ai Collection', { domain: 'huggingface.co' })).toBe('Technology')
    expect(categorize('', { domain: 'open.spotify.com' })).toBe('Entertainment')
  })

  it('keeps returning Other for an unknown site with no signals', () => {
    expect(categorize('lorem ipsum', { domain: 'example.com' })).toBe('Other')
  })
})

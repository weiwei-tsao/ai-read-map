import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { ReadMapResult } from 'ai-read-map-shared'

function baseResult(overrides: Partial<ReadMapResult> = {}): ReadMapResult {
  return {
    status: 'ok',
    overview: 'This page explains X.',
    keySections: [
      { label: 'Intro', whyRead: 'Sets up the problem', targetId: 'p1' },
      { label: 'Method', whyRead: 'Describes the approach', targetId: 'p2' },
    ],
    pageQuality: 'high',
    missingContext: [],
    reason: '',
    ...overrides,
  }
}

let renderReadMap: typeof import('./panel').renderReadMap

beforeAll(async () => {
  document.body.innerHTML = `
    <button id="generate-btn"></button>
    <div id="status"></div>
    <div id="result"></div>
  `
  ;({ renderReadMap } = await import('./panel'))
})

beforeEach(() => {
  document.querySelector('#result')!.innerHTML = ''
  window.localStorage.clear()
})

describe('renderReadMap', () => {
  it('does not render page quality by default', () => {
    renderReadMap(baseResult({ pageQuality: 'high' }), 'Title', 'https://example.com')
    expect(document.querySelector('#result .chip')).toBeNull()
    expect(document.querySelector('#result')?.textContent).not.toContain('Page quality')
  })

  it('renders page quality in debug mode', () => {
    window.localStorage.setItem('ai-read-map:debug', 'true')
    renderReadMap(baseResult({ pageQuality: 'medium' }), 'Title', 'https://example.com')
    const chip = document.querySelector('#result .chip')
    expect(chip?.classList.contains('chip--medium')).toBe(true)
    expect(chip?.classList.contains('chip--high')).toBe(false)
    expect(chip?.textContent).toBe('Page quality: medium')
  })

  it('renders one section-card per key section', () => {
    renderReadMap(baseResult(), 'Title', 'https://example.com')
    expect(document.querySelectorAll('#result .section-card').length).toBe(2)
  })
})

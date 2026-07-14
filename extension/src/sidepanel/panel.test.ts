import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
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
let SECTION_ACTIVE_MS: typeof import('./panel').SECTION_ACTIVE_MS
let sendMessage: ReturnType<typeof vi.fn>

beforeAll(async () => {
  sendMessage = vi.fn()
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage,
    },
  })
  document.body.innerHTML = `
    <button id="generate-btn"></button>
    <div id="status"></div>
    <div id="result"></div>
  `
  ;({ renderReadMap, SECTION_ACTIVE_MS } = await import('./panel'))
})

beforeEach(() => {
  document.querySelector('#result')!.innerHTML = ''
  window.localStorage.clear()
  sendMessage.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('renderReadMap', () => {
  it('does not render page quality by default', () => {
    renderReadMap(baseResult({ pageQuality: 'high' }), 'Title', 'https://example.com')
    expect(document.querySelector('#result .chip')).toBeNull()
    expect(document.querySelector('#result')?.textContent).not.toContain('Page quality')
    expect(document.querySelector('#result')?.textContent).not.toContain('Copy Read Map')
  })

  it('renders debug-only controls in debug mode', () => {
    window.localStorage.setItem('ai-read-map:debug', 'true')
    renderReadMap(baseResult({ pageQuality: 'medium' }), 'Title', 'https://example.com')
    const chip = document.querySelector('#result .chip')
    expect(chip?.classList.contains('chip--medium')).toBe(true)
    expect(chip?.classList.contains('chip--high')).toBe(false)
    expect(chip?.textContent).toBe('Page quality: medium')
    expect(document.querySelector('#result')?.textContent).toContain('Copy Read Map')
  })

  it('renders one section-card per key section', () => {
    renderReadMap(baseResult(), 'Title', 'https://example.com')
    expect(document.querySelectorAll('#result .section-card').length).toBe(2)
  })

  it('renders view-in-page affordances for sections', () => {
    renderReadMap(baseResult(), 'Title', 'https://example.com')
    const buttons = Array.from(document.querySelectorAll('#result .section-card .btn--ghost'))
    expect(buttons.map((button) => button.textContent)).toEqual(['View in page', 'View in page'])
  })

  it('jumps to a section on view-in-page click and marks its card active briefly', () => {
    vi.useFakeTimers()
    renderReadMap(baseResult(), 'Title', 'https://example.com')

    const card = document.querySelector<HTMLElement>('#result .section-card')!
    card.querySelector<HTMLButtonElement>('.btn--ghost')!.click()

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith({ type: 'JUMP_TO_PARAGRAPH', targetId: 'p1' })
    expect(card.classList.contains('section-card--active')).toBe(true)

    vi.advanceTimersByTime(SECTION_ACTIVE_MS)
    expect(card.classList.contains('section-card--active')).toBe(false)
  })

  it('keeps only the last-clicked card active', () => {
    vi.useFakeTimers()
    renderReadMap(baseResult(), 'Title', 'https://example.com')

    const buttons = document.querySelectorAll<HTMLButtonElement>('#result .section-card .btn--ghost')
    const cards = document.querySelectorAll<HTMLElement>('#result .section-card')

    buttons[0].click()
    vi.advanceTimersByTime(SECTION_ACTIVE_MS / 2)
    buttons[1].click()

    expect(cards[0].classList.contains('section-card--active')).toBe(false)
    expect(cards[1].classList.contains('section-card--active')).toBe(true)

    // the first click's timer must not strip the second card's active state early
    vi.advanceTimersByTime(SECTION_ACTIVE_MS / 2 + 1)
    expect(cards[1].classList.contains('section-card--active')).toBe(true)

    vi.advanceTimersByTime(SECTION_ACTIVE_MS / 2)
    expect(cards[1].classList.contains('section-card--active')).toBe(false)
  })
})

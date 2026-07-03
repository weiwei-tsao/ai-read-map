import { describe, it, expect } from 'vitest'
import { checkExtractionQuality } from './quality-check'
import type { StructuredPageContent } from 'ai-read-map-shared'

function makeContent(paragraphTexts: string[]): StructuredPageContent {
  return {
    title: 'Test',
    url: 'https://example.com',
    domain: 'example.com',
    sections: [{ id: 's1', heading: null, paragraphs: paragraphTexts.map((text, i) => ({ id: `p${i}`, text })) }],
  }
}

describe('checkExtractionQuality', () => {
  it('fails when total text is under 500 characters', () => {
    const result = checkExtractionQuality(makeContent(['short'.repeat(10)]))
    expect(result.passed).toBe(false)
    expect(result.reason).toMatch(/couldn't find enough readable content/i)
  })

  it('fails when there are fewer than 5 paragraphs', () => {
    const longText = 'word '.repeat(30) // 150 chars each
    const result = checkExtractionQuality(makeContent([longText, longText, longText, longText]))
    expect(result.passed).toBe(false)
  })

  it('fails when there are fewer than 3 meaningful blocks', () => {
    const meaningfulText = 'word '.repeat(100) // 500 chars, >= 40-char bar
    const shortText = 'a' // 1 char, < 40-char bar
    const result = checkExtractionQuality(makeContent([meaningfulText, shortText, shortText, shortText, shortText]))
    expect(result.passed).toBe(false)
  })

  it('passes when minimums are met', () => {
    const longText = 'word '.repeat(30) // 150 chars, well over the 40-char meaningful-block bar
    const result = checkExtractionQuality(makeContent(Array(5).fill(longText)))
    expect(result.passed).toBe(true)
  })
})

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
    const longText = 'word '.repeat(30)
    const result = checkExtractionQuality(makeContent([longText, longText]))
    expect(result.passed).toBe(false)
  })

  it('passes when minimums are met', () => {
    const longText = 'word '.repeat(30) // 150 chars, well over the 40-char meaningful-block bar
    const result = checkExtractionQuality(makeContent(Array(5).fill(longText)))
    expect(result.passed).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { computeContentHash } from './content-hash.js'
import type { StructuredPageContent } from 'ai-read-map-shared'

const base: StructuredPageContent = {
  title: 'Title',
  url: 'https://example.com/a',
  domain: 'example.com',
  sections: [{ id: 's1', heading: 'Intro', paragraphs: [{ id: 'p1', text: 'Hello world' }] }],
}

describe('computeContentHash', () => {
  it('is stable for identical content', () => {
    expect(computeContentHash(base)).toBe(computeContentHash({ ...base }))
  })

  it('changes when paragraph text changes', () => {
    const changed: StructuredPageContent = {
      ...base,
      sections: [{ ...base.sections[0], paragraphs: [{ id: 'p1', text: 'Different text' }] }],
    }
    expect(computeContentHash(base)).not.toBe(computeContentHash(changed))
  })

  it('ignores url and paragraph ids', () => {
    const differentUrl: StructuredPageContent = { ...base, url: 'https://example.com/b' }
    expect(computeContentHash(base)).toBe(computeContentHash(differentUrl))
  })
})

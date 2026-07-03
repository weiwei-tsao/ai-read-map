import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetIdCounter } from './dom-extract'

vi.mock('@mozilla/readability', () => ({
  Readability: vi.fn(),
}))

import { Readability } from '@mozilla/readability'
import { extractStructuredContent } from './readability-extract'

function setParseResult(contentHtml: string | null, title = 'Mock Title') {
  ;(Readability as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    parse: () => (contentHtml === null ? null : { content: contentHtml, title }),
  }))
}

describe('extractStructuredContent', () => {
  beforeEach(() => {
    resetIdCounter()
    document.body.innerHTML = ''
  })

  it('groups paragraphs under the preceding heading, using only surviving IDs', () => {
    document.body.innerHTML = `
      <h2>Section One: An Overview</h2>
      <p>First paragraph has plenty of readable text in it for the test to work.</p>
      <p>Second paragraph also has plenty of readable text in it for the test.</p>
      <nav><p>This nav paragraph is long enough but excluded before Readability even runs.</p></nav>
    `
    // IDs are assigned in document order starting at ai-read-map-0 (reset in
    // beforeEach): h2 -> ai-read-map-0, first <p> -> ai-read-map-1, second
    // <p> -> ai-read-map-2. The nav <p> never gets an ID (excluded by
    // assignParagraphIds itself). Simulate Readability keeping only the
    // heading and the first paragraph.
    //
    // Note: the heading text must be >= 20 chars (assignParagraphIds'
    // MIN_TEXT_LENGTH) or it gets filtered out like any other short node,
    // which would shift every subsequent ID down by one.
    setParseResult(
      '<div data-ai-read-map-id="ai-read-map-0"></div><div data-ai-read-map-id="ai-read-map-1"></div>',
    )

    const result = extractStructuredContent(document)

    expect(result.title).toBe('Mock Title')
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].heading).toBe('Section One: An Overview')
    expect(result.sections[0].paragraphs).toHaveLength(1)
    expect(result.sections[0].paragraphs[0].text).toContain('First paragraph')
  })

  it('falls back to every assigned ID when Readability finds nothing', () => {
    document.body.innerHTML = `
      <h2>Section One: An Overview</h2>
      <p>First paragraph has plenty of readable text in it for the test to work.</p>
    `
    setParseResult(null)

    const result = extractStructuredContent(document)

    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].heading).toBe('Section One: An Overview')
    expect(result.sections[0].paragraphs).toHaveLength(1)
  })
})

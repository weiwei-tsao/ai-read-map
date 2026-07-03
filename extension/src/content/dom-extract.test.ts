import { describe, it, expect, beforeEach } from 'vitest'
import { assignParagraphIds, resetIdCounter } from './dom-extract'

describe('assignParagraphIds', () => {
  beforeEach(() => resetIdCounter())

  it('assigns IDs to headings and paragraphs with enough text', () => {
    document.body.innerHTML = `
      <h2>A real heading with sufficient length</h2>
      <p>This paragraph has plenty of readable text in it, well past the minimum length.</p>
    `
    const idToNode = assignParagraphIds(document)
    expect(idToNode.size).toBe(2)
    expect(document.querySelector('h2')?.getAttribute('data-ai-read-map-id')).toBeTruthy()
    expect(document.querySelector('p')?.getAttribute('data-ai-read-map-id')).toBeTruthy()
  })

  it('skips short text and nav/footer/aside/form content', () => {
    document.body.innerHTML = `
      <p>short</p>
      <nav><p>This nav paragraph is long enough but should still be skipped entirely.</p></nav>
      <p>This paragraph is long enough and outside any excluded container, so it counts.</p>
    `
    const idToNode = assignParagraphIds(document)
    expect(idToNode.size).toBe(1)
  })
})

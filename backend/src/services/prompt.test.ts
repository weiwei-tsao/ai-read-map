import { describe, it, expect } from 'vitest'
import { buildPrompt, PROMPT_VERSION } from './prompt.js'
import type { StructuredPageContent } from 'ai-read-map-shared'

const sampleContent: StructuredPageContent = {
  title: 'Sample',
  url: 'https://example.com/post',
  domain: 'example.com',
  sections: [{ id: 's1', heading: 'Heading', paragraphs: [{ id: 'p1', text: 'Body text.' }] }],
}

// These assertions lock the product direction from issue #7 (concrete
// previews over why-read value judgments), not model output quality —
// a unit test cannot guarantee generation. If one fails, the prompt's
// direction changed: make that change deliberately, not as refactor drift.
describe('buildPrompt', () => {
  it('asks for concrete previews rather than why-read judgments', () => {
    const prompt = buildPrompt(sampleContent)

    expect(prompt).toContain('preview:')
    expect(prompt).toContain('label:')
    expect(prompt).toContain('unrelated article')
    expect(prompt).not.toContain('whyRead')
    expect(prompt).not.toContain('Explain why this section is worth reading')
  })

  it('allows stating claims instead of manufacturing suspense', () => {
    const prompt = buildPrompt(sampleContent)

    expect(prompt).toContain('main claim')
    expect(prompt).not.toContain('leave a reason to click')
  })

  it('embeds the page content', () => {
    expect(buildPrompt(sampleContent)).toContain(JSON.stringify(sampleContent))
  })

  it('uses the current prompt version', () => {
    // cache keys include this (architecture invariant): if the prompt text
    // changes, bump the version here and in prompt.ts together
    expect(PROMPT_VERSION).toBe('v2')
  })
})

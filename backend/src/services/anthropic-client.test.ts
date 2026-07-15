import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

import { generateReadMap } from './anthropic-client.js'
import type { StructuredPageContent } from 'ai-read-map-shared'

const content: StructuredPageContent = {
  title: 'Test',
  url: 'https://example.com',
  domain: 'example.com',
  sections: [],
}

describe('generateReadMap', () => {
  beforeEach(() => mockCreate.mockReset())

  it('parses the text block into a ReadMapResult', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'ok',
            overview: 'x',
            keySections: [],
            pageQuality: 'high',
            missingContext: [],
            reason: '',
          }),
        },
      ],
    })

    const result = await generateReadMap(content)

    expect(result.status).toBe('ok')
    expect(result.overview).toBe('x')
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-haiku-4-5' }))
  })

  it('throws when the response has no text block', async () => {
    mockCreate.mockResolvedValue({ content: [] })

    await expect(generateReadMap(content)).rejects.toThrow('no text content')
  })

  it('truncates keySections to 5 even if the model returns more', async () => {
    const sixSections = Array.from({ length: 6 }, (_, i) => ({
      label: `Section ${i}`,
      preview: 'why',
      targetId: `p${i}`,
    }))
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'ok',
            overview: 'x',
            keySections: sixSections,
            pageQuality: 'high',
            missingContext: [],
            reason: '',
          }),
        },
      ],
    })

    const result = await generateReadMap(content)

    expect(result.keySections).toHaveLength(5)
  })
})

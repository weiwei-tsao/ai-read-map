import Anthropic from '@anthropic-ai/sdk'
import { buildPrompt } from './prompt.js'
import type { StructuredPageContent, ReadMapResult } from 'ai-read-map-shared'

const client = new Anthropic()

const READMAP_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'not_suitable', 'low_confidence'] },
    overview: { type: 'string' },
    keySections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          preview: { type: 'string' },
          targetId: { type: 'string' },
        },
        required: ['label', 'preview', 'targetId'],
        additionalProperties: false,
      },
    }, // Note: Anthropic's structured-outputs JSON schema subset does not
       // support array-length constraints (minItems/maxItems), so the 2-5
       // bound cannot be enforced here — the prompt asks for it, and the
       // code below enforces the max defensively; validateReadMap
       // (shared package) enforces the min by downgrading to
       // low_confidence when fewer than 2 valid sections remain.
    pageQuality: { type: 'string', enum: ['high', 'medium', 'low'] },
    missingContext: { type: 'array', items: { type: 'string' } },
    reason: { type: 'string' },
  },
  required: ['status', 'overview', 'keySections', 'pageQuality', 'missingContext', 'reason'],
  additionalProperties: false,
} as const

export async function generateReadMap(content: StructuredPageContent): Promise<ReadMapResult> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    output_config: { format: { type: 'json_schema', schema: READMAP_SCHEMA } },
    messages: [{ role: 'user', content: buildPrompt(content) }],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('AI response contained no text content')
  }

  const parsed = JSON.parse(textBlock.text) as ReadMapResult

  // The JSON schema above cannot express "max 5 items" (Anthropic's
  // structured-outputs subset doesn't support minItems/maxItems), so the
  // 2-5 upper bound is enforced here instead of at the schema level.
  return { ...parsed, keySections: parsed.keySections.slice(0, 5) }
}

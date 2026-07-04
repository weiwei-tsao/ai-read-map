import { Router } from 'express'
import { generateReadMap } from '../services/anthropic-client.js'
import { computeContentHash } from '../services/content-hash.js'
import { buildCacheKey, getCached, setCached } from '../services/cache.js'
import { PROMPT_VERSION } from '../services/prompt.js'
import { validateReadMap } from 'ai-read-map-shared'
import type { StructuredPageContent } from 'ai-read-map-shared'

const MAX_CONTENT_CHARS = 50_000

function isValidSections(sections: unknown): sections is StructuredPageContent['sections'] {
  return (
    Array.isArray(sections) &&
    sections.every(
      (s) =>
        s &&
        typeof s.id === 'string' &&
        Array.isArray(s.paragraphs) &&
        s.paragraphs.every((p: unknown) => p && typeof (p as { id?: unknown }).id === 'string' && typeof (p as { text?: unknown }).text === 'string'),
    )
  )
}

export const readmapRouter = Router()

readmapRouter.post('/readmap', async (req, res) => {
  const content = req.body as StructuredPageContent

  if (!content || !isValidSections(content.sections)) {
    return res.status(400).json({ status: 'not_suitable', overview: '', keySections: [], pageQuality: 'low', missingContext: [], reason: 'Invalid request body' })
  }

  const paragraphs = content.sections.flatMap((s) => s.paragraphs)
  const totalChars = paragraphs.reduce((sum, p) => sum + p.text.length, 0)

  if (totalChars > MAX_CONTENT_CHARS) {
    return res.status(413).json({ status: 'not_suitable', overview: '', keySections: [], pageQuality: 'low', missingContext: [], reason: 'Page text too long' })
  }

  const contentHash = computeContentHash(content)
  const cacheKey = buildCacheKey(content.domain, content.url, contentHash, PROMPT_VERSION)

  const cached = getCached(cacheKey)
  if (cached) {
    console.log('[ai-read-map] cache_hit', { domain: content.domain })
    return res.json(cached)
  }
  console.log('[ai-read-map] cache_miss', { domain: content.domain })

  const validTargetIds = new Set(content.sections.flatMap((s) => [s.id, ...s.paragraphs.map((p) => p.id)]))

  try {
    const raw = await generateReadMap(content)
    const validated = validateReadMap(raw, validTargetIds)
    setCached(cacheKey, validated)
    console.log('[ai-read-map] read_map_success', { domain: content.domain, status: validated.status, sectionCount: validated.keySections.length })
    res.json(validated)
  } catch (err) {
    console.error('[ai-read-map] read_map_failed', { domain: content.domain, error: (err as Error).message })
    res.status(502).json({ status: 'not_suitable', overview: '', keySections: [], pageQuality: 'low', missingContext: [], reason: 'AI generation failed' })
  }
})

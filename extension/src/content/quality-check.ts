import type { StructuredPageContent } from 'ai-read-map-shared'

export interface ExtractionQualityResult {
  passed: boolean
  reason?: string
}

const MIN_TOTAL_CHARS = 500
const MIN_PARAGRAPHS = 5
const MIN_MEANINGFUL_BLOCKS = 3
const MEANINGFUL_BLOCK_CHARS = 40

export function checkExtractionQuality(content: StructuredPageContent): ExtractionQualityResult {
  const paragraphs = content.sections.flatMap((s) => s.paragraphs)
  const totalChars = paragraphs.reduce((sum, p) => sum + p.text.length, 0)

  if (totalChars < MIN_TOTAL_CHARS) {
    return { passed: false, reason: "We couldn't find enough readable content on this page." }
  }
  if (paragraphs.length < MIN_PARAGRAPHS) {
    return { passed: false, reason: 'Not enough readable paragraphs on this page.' }
  }
  const meaningfulBlocks = paragraphs.filter((p) => p.text.length >= MEANINGFUL_BLOCK_CHARS).length
  if (meaningfulBlocks < MIN_MEANINGFUL_BLOCKS) {
    return { passed: false, reason: 'Not enough substantial text blocks on this page.' }
  }
  return { passed: true }
}

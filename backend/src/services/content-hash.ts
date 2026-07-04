import { createHash } from 'node:crypto'
import type { StructuredPageContent } from 'ai-read-map-shared'

export function computeContentHash(content: StructuredPageContent): string {
  const stable = {
    title: content.title,
    sections: content.sections.map((s) => ({
      heading: s.heading,
      paragraphs: s.paragraphs.map((p) => p.text),
    })),
  }
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex')
}

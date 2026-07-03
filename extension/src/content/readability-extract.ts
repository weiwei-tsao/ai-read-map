import { Readability } from '@mozilla/readability'
import { assignParagraphIds } from './dom-extract'
import type { StructuredPageContent, SectionContent, ParagraphContent } from 'ai-read-map-shared'

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6'])

export function extractStructuredContent(doc: Document = document): StructuredPageContent {
  const idToNode = assignParagraphIds(doc)

  // Clone before running Readability — it mutates the document it parses,
  // and we still need the original, ID-tagged DOM for jump/highlight.
  const clone = doc.cloneNode(true) as Document
  const article = new Readability(clone).parse()

  const survivingIds = new Set<string>()
  if (article?.content) {
    const parser = new DOMParser()
    const parsed = parser.parseFromString(article.content, 'text/html')
    parsed.querySelectorAll('[data-ai-read-map-id]').forEach((el) => {
      const id = el.getAttribute('data-ai-read-map-id')
      if (id) survivingIds.add(id)
    })
  }

  // Fallback: if Readability found nothing usable, fall back to every
  // assigned node rather than returning an empty page.
  const idsToUse = survivingIds.size > 0 ? survivingIds : new Set(idToNode.keys())

  const sections: SectionContent[] = []
  let currentSection: SectionContent | null = null

  for (const [id, node] of idToNode) {
    if (!idsToUse.has(id)) continue

    if (HEADING_TAGS.has(node.tagName)) {
      currentSection = { id, heading: node.textContent?.trim() ?? null, paragraphs: [] }
      sections.push(currentSection)
      continue
    }

    const paragraph: ParagraphContent = { id, text: node.textContent?.trim() ?? '' }
    if (!currentSection) {
      currentSection = { id: `${id}-section`, heading: null, paragraphs: [] }
      sections.push(currentSection)
    }
    currentSection.paragraphs.push(paragraph)
  }

  return {
    title: article?.title ?? doc.title,
    url: doc.location.href,
    domain: doc.location.hostname,
    sections,
  }
}

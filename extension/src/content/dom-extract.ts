const PARAGRAPH_SELECTOR = 'p, li, blockquote'
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6'
// tag-aware thresholds (issue #6): the paragraph minimum exists to drop nav/li
// junk, but headings carry document structure and are legitimately short
// ("FAQ", "API", "结论") — only block empty/single-character decorations
const MIN_PARAGRAPH_CHARS = 20
const MIN_HEADING_CHARS = 2

let idCounter = 0

export function assignParagraphIds(root: Document = document): Map<string, HTMLElement> {
  const idToNode = new Map<string, HTMLElement>()
  const nodes = root.querySelectorAll<HTMLElement>(`${PARAGRAPH_SELECTOR}, ${HEADING_SELECTOR}`)

  for (const node of nodes) {
    const text = node.textContent?.trim() ?? ''
    const minChars = node.matches(HEADING_SELECTOR) ? MIN_HEADING_CHARS : MIN_PARAGRAPH_CHARS
    if (text.length < minChars) continue
    if (node.closest('nav, footer, aside, form')) continue

    const id = `ai-read-map-${idCounter++}`
    node.setAttribute('data-ai-read-map-id', id)
    idToNode.set(id, node)
  }

  return idToNode
}

export function resetIdCounter(): void {
  idCounter = 0
}

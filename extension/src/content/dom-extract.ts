const PARAGRAPH_SELECTOR = 'p, li, blockquote'
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6'
const MIN_TEXT_LENGTH = 20

let idCounter = 0

export function assignParagraphIds(root: Document = document): Map<string, HTMLElement> {
  const idToNode = new Map<string, HTMLElement>()
  const nodes = root.querySelectorAll<HTMLElement>(`${PARAGRAPH_SELECTOR}, ${HEADING_SELECTOR}`)

  for (const node of nodes) {
    const text = node.textContent?.trim() ?? ''
    if (text.length < MIN_TEXT_LENGTH) continue
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

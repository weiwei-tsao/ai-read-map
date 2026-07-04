import { extractStructuredContent } from './readability-extract'
import { checkExtractionQuality } from './quality-check'

let lastIdToNode: Map<string, HTMLElement> | null = null
let highlightTimeout: number | undefined

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_PAGE') {
    const content = extractStructuredContent(document)
    lastIdToNode = collectIdToNode()
    const quality = checkExtractionQuality(content)
    sendResponse({ content, quality })
    return
  }

  if (message.type === 'JUMP_TO_PARAGRAPH') {
    jumpToParagraph(message.targetId)
    sendResponse({ ok: true })
  }
})

function collectIdToNode(): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>()
  document.querySelectorAll<HTMLElement>('[data-ai-read-map-id]').forEach((el) => {
    const id = el.getAttribute('data-ai-read-map-id')
    if (id) map.set(id, el)
  })
  return map
}

function jumpToParagraph(targetId: string): void {
  const node = lastIdToNode?.get(targetId)
  if (!node) return

  node.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const originalBackground = node.style.backgroundColor
  const originalTransition = node.style.transition
  node.style.transition = 'background-color 0.3s ease'
  node.style.backgroundColor = '#fff3b0'

  window.clearTimeout(highlightTimeout)
  highlightTimeout = window.setTimeout(() => {
    node.style.backgroundColor = originalBackground
    node.style.transition = originalTransition
  }, 2000)
}

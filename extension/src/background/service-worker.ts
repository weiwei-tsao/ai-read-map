import { validateReadMap } from 'ai-read-map-shared'
import type { StructuredPageContent, ReadMapResult } from 'ai-read-map-shared'

const BACKEND_URL = 'http://localhost:8787/api/readmap'

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GENERATE_READMAP') {
    handleGenerate().then(sendResponse)
    return true // keep the message channel open for the async response
  }

  if (message.type === 'JUMP_TO_PARAGRAPH') {
    forwardToActiveTab(message)
  }
})

async function handleGenerate(): Promise<
  { ok: true; readMap: ReadMapResult; title: string; url: string } | { ok: false; error: string }
> {
  console.log('[ai-read-map] read_map_requested')
  try {
    const tab = await getActiveTab()
    const { content, quality, domTargetIds } = await chrome.tabs.sendMessage(tab.id!, { type: 'EXTRACT_PAGE' })

    if (!quality.passed) {
      return { ok: false, error: quality.reason }
    }

    const rawReadMap = await requestReadMap(content as StructuredPageContent)
    const validTargetIds = new Set(domTargetIds as string[])
    const readMap = validateReadMap(rawReadMap, validTargetIds)

    return { ok: true, readMap, title: content.title, url: content.url }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

async function forwardToActiveTab(message: unknown): Promise<void> {
  const tab = await getActiveTab()
  if (tab.id) chrome.tabs.sendMessage(tab.id, message)
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) throw new Error('No active tab')
  return tab
}

async function requestReadMap(content: StructuredPageContent): Promise<ReadMapResult> {
  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content),
  })
  if (!response.ok) {
    const reason = await response
      .json()
      .then((body) => body?.reason)
      .catch(() => undefined)
    throw new Error(reason ?? `Backend error: ${response.status}`)
  }
  return response.json()
}

import { validateReadMap } from 'ai-read-map-shared'
import type { StructuredPageContent, ReadMapResult } from 'ai-read-map-shared'

const BACKEND_URL = 'http://localhost:8787/api/readmap'
const CONTENT_SCRIPT_FILE = 'content.js'

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GENERATE_READMAP') {
    handleGenerate().then(sendResponse)
    return true // keep the message channel open for the async response
  }

  if (message.type === 'JUMP_TO_PARAGRAPH') {
    forwardToActiveTab(message).then(sendResponse)
    return true
  }
})

async function handleGenerate(): Promise<
  { ok: true; readMap: ReadMapResult; title: string; url: string } | { ok: false; error: string }
> {
  try {
    const tab = await getActiveTab()
    await ensureContentScriptInjected(tab.id!)
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

async function forwardToActiveTab(message: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tab = await getActiveTab()
    await chrome.tabs.sendMessage(tab.id!, message)
    return { ok: true }
  } catch {
    // content script gone (navigation / tab switch) — fail visibly, don't re-inject:
    // the read map's targetIds only exist in the page it was generated from
    return { ok: false, error: 'The page has changed. Generate the read map again to jump.' }
  }
}

// on-demand injection (issue #5): no static content_scripts in the manifest,
// so inject via activeTab + scripting right before EXTRACT_PAGE. The ping
// avoids double-injecting, which would register duplicate message listeners.
async function ensureContentScriptInjected(tabId: number): Promise<void> {
  const alreadyInjected = await chrome.tabs
    .sendMessage(tabId, { type: 'PING_CONTENT_SCRIPT' })
    .then((response) => response?.ok === true)
    .catch(() => false)

  if (alreadyInjected) return

  await chrome.scripting.executeScript({
    target: { tabId },
    files: [CONTENT_SCRIPT_FILE],
  }).catch(() => {
    // no host grant and no live activeTab grant for this page
    throw new Error(
      'AI Read Map is not allowed to read this page. Click Generate again and allow access, or click the extension icon on this page first.',
    )
  })
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

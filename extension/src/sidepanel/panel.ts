import type { ReadMapResult } from 'ai-read-map-shared'

const generateBtn = document.querySelector<HTMLButtonElement>('#generate-btn')!
const statusEl = document.querySelector<HTMLDivElement>('#status')!
const resultEl = document.querySelector<HTMLDivElement>('#result')!

generateBtn.addEventListener('click', onGenerate)

async function onGenerate(): Promise<void> {
  setStatus('Generating read map...', 'loading')
  resultEl.innerHTML = ''
  generateBtn.disabled = true

  // must happen inside the click's user gesture, before any async round-trip.
  // Reading the tab's URL to request a single origin would itself need the
  // "tabs" permission, so ask for http/https once; denial falls back to the
  // activeTab grant from the last extension-icon click.
  await chrome.permissions
    .request({ origins: ['http://*/*', 'https://*/*'] })
    .catch(() => false)

  const response = await chrome.runtime.sendMessage({ type: 'GENERATE_READMAP' })
  generateBtn.disabled = false

  if (!response) {
    setStatus('Something went wrong.', 'error')
    return
  }

  if (!response.ok) {
    setStatus(response.error ?? 'Something went wrong.', 'error')
    return
  }

  renderReadMap(response.readMap, response.title, response.url)
}

function setStatus(text: string, kind: 'loading' | 'error' | 'idle'): void {
  statusEl.textContent = text
  statusEl.className = kind
}

export function renderReadMap(readMap: ReadMapResult, title: string, url: string): void {
  if (readMap.status === 'not_suitable') {
    setStatus(readMap.reason || "We couldn't find enough readable content on this page.", 'error')
    return
  }

  if (readMap.status === 'low_confidence' || readMap.keySections.length < 2) {
    setStatus('Low confidence: this page may not have enough clear sections.', 'error')
  } else {
    setStatus('', 'idle')
  }

  const overviewEl = document.createElement('p')
  overviewEl.className = 'overview'
  overviewEl.textContent = readMap.overview
  resultEl.appendChild(overviewEl)

  const eyebrowEl = document.createElement('div')
  eyebrowEl.className = 'eyebrow'
  eyebrowEl.textContent = 'Key Sections'
  resultEl.appendChild(eyebrowEl)

  const list = document.createElement('ol')
  list.className = 'section-list'
  for (const section of readMap.keySections) {
    const item = document.createElement('li')
    item.className = 'section-card'

    const label = document.createElement('strong')
    label.className = 'section-label'
    label.textContent = section.label
    item.appendChild(label)

    const why = document.createElement('p')
    why.className = 'section-why'
    why.textContent = section.whyRead
    item.appendChild(why)

    // whole-card click area comes from the button's ::after overlay in panel.css
    const jumpBtn = document.createElement('button')
    jumpBtn.className = 'btn btn--ghost'
    jumpBtn.textContent = 'View in page'
    jumpBtn.addEventListener('click', () => {
      markSectionActive(item)
      chrome.runtime
        .sendMessage({ type: 'JUMP_TO_PARAGRAPH', targetId: section.targetId })
        .then((response) => {
          if (response?.ok === false) {
            item.classList.remove('section-card--active')
            setStatus(response.error ?? 'Something went wrong.', 'error')
          }
        })
    })
    item.appendChild(jumpBtn)

    list.appendChild(item)
  }
  resultEl.appendChild(list)

  if (isDebugMode()) {
    const qualityChip = document.createElement('span')
    qualityChip.className = `chip chip--${readMap.pageQuality}`
    qualityChip.textContent = `Page quality: ${readMap.pageQuality}`
    resultEl.appendChild(qualityChip)

    const copyBtn = document.createElement('button')
    copyBtn.className = 'btn btn--secondary'
    copyBtn.textContent = 'Copy Read Map'
    copyBtn.addEventListener('click', () => copyReadMap(readMap, title, url))
    resultEl.appendChild(copyBtn)
  }
}

// matches the 2s page highlight in content/index.ts so both cues fade together
export const SECTION_ACTIVE_MS = 2000

let sectionActiveTimeout: number | undefined

function markSectionActive(item: HTMLElement): void {
  for (const el of document.querySelectorAll('.section-card--active')) {
    el.classList.remove('section-card--active')
  }
  window.clearTimeout(sectionActiveTimeout)
  item.classList.add('section-card--active')
  sectionActiveTimeout = window.setTimeout(
    () => item.classList.remove('section-card--active'),
    SECTION_ACTIVE_MS,
  )
}

function isDebugMode(): boolean {
  return window.localStorage.getItem('ai-read-map:debug') === 'true'
}

async function copyReadMap(readMap: ReadMapResult, title: string, url: string): Promise<void> {
  const lines = [
    `Title: ${title}`,
    `URL: ${url}`,
    '',
    `Overview:\n${readMap.overview}`,
    '',
    'Key Sections:',
    ...readMap.keySections.map((s, i) => `${i + 1}. ${s.label} — ${s.whyRead}`),
  ]
  await navigator.clipboard.writeText(lines.join('\n'))
}

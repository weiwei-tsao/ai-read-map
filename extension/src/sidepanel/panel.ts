import type { ReadMapResult } from 'ai-read-map-shared'

const generateBtn = document.querySelector<HTMLButtonElement>('#generate-btn')!
const statusEl = document.querySelector<HTMLDivElement>('#status')!
const resultEl = document.querySelector<HTMLDivElement>('#result')!

generateBtn.addEventListener('click', onGenerate)

async function onGenerate(): Promise<void> {
  setStatus('Generating read map...', 'loading')
  resultEl.innerHTML = ''
  generateBtn.disabled = true

  const response = await chrome.runtime.sendMessage({ type: 'GENERATE_READMAP' })
  generateBtn.disabled = false

  if (!response.ok) {
    setStatus(response.error ?? 'Something went wrong.', 'error')
    return
  }

  renderReadMap(response.readMap)
}

function setStatus(text: string, kind: 'loading' | 'error' | 'idle'): void {
  statusEl.textContent = text
  statusEl.className = kind
}

function renderReadMap(readMap: ReadMapResult): void {
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
  overviewEl.textContent = readMap.overview
  resultEl.appendChild(overviewEl)

  const list = document.createElement('ol')
  for (const section of readMap.keySections) {
    const item = document.createElement('li')

    const label = document.createElement('strong')
    label.textContent = section.label
    item.appendChild(label)

    const why = document.createElement('p')
    why.textContent = section.whyRead
    item.appendChild(why)

    const jumpBtn = document.createElement('button')
    jumpBtn.textContent = 'Jump'
    jumpBtn.addEventListener('click', () => {
      console.log('[ai-read-map] jump_clicked')
      chrome.runtime.sendMessage({ type: 'JUMP_TO_PARAGRAPH', targetId: section.targetId })
    })
    item.appendChild(jumpBtn)

    list.appendChild(item)
  }
  resultEl.appendChild(list)

  const qualityEl = document.createElement('p')
  qualityEl.textContent = `Page quality: ${readMap.pageQuality}`
  resultEl.appendChild(qualityEl)

  const copyBtn = document.createElement('button')
  copyBtn.textContent = 'Copy Read Map'
  copyBtn.addEventListener('click', () => copyReadMap(readMap))
  resultEl.appendChild(copyBtn)
}

async function copyReadMap(readMap: ReadMapResult): Promise<void> {
  console.log('[ai-read-map] copy_clicked')
  const lines = [
    `Overview:\n${readMap.overview}`,
    '',
    'Key Sections:',
    ...readMap.keySections.map((s, i) => `${i + 1}. ${s.label} — ${s.whyRead}`),
  ]
  await navigator.clipboard.writeText(lines.join('\n'))
}

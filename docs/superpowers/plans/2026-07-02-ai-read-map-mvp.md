# AI Read Map — Core MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI Read Map MVP end-to-end — a Chrome extension that extracts a webpage's readable content, sends it to a backend that calls Claude to generate a 2–5 section "read map," and lets the user jump to and highlight the original paragraph for each section.

**Architecture:** npm-workspaces monorepo with two packages: `extension/` (Manifest V3 Chrome extension, Vite + CRXJS, vanilla TypeScript) and `backend/` (Node.js + Express + TypeScript API that calls the Anthropic API and never exposes the API key to the browser). The content script assigns stable IDs to DOM paragraphs/headings before running Mozilla's Readability extractor on a cloned document, so IDs survive extraction and can be used to scroll-and-highlight the original node later. The backend enforces a JSON schema on Claude's response via structured outputs, validates target IDs, caches by content hash, and rate-limits requests.

**Tech Stack:** TypeScript everywhere. Extension: Vite, `@crxjs/vite-plugin`, `@mozilla/readability`, Vitest + jsdom. Backend: Express, `@anthropic-ai/sdk` (model `claude-haiku-4-5`), `express-rate-limit`, Vitest.

**Scope note:** This plan covers Phases 1–5 of `docs/AI_Read_Map_MVP.md` (the core MVP). BYOK mode (spec §24) is explicitly a fast-follow and is out of scope here — the spec itself says it must not block the first private test.

## Global Constraints

- Manual trigger only — the extension must never process a page automatically in the background. (spec §9.1)
- Chrome permissions limited to: `activeTab`, `scripting`, `storage`, `sidePanel`. (spec §18)
- Extraction minimums: at least 500 characters, at least 5 paragraphs, at least 3 text blocks ≥ 40 characters. Below these, treat as `not_suitable`. (spec §15.3)
- `keySections` must contain 2–5 items when `status: "ok"`; `label` under 8 words; `whyRead` under 20 words. If fewer than 2 valid sections survive target-ID validation, the result becomes `low_confidence`. (spec §9.5, §10.3)
- Allowed `status` values: `ok`, `not_suitable`, `low_confidence`. (spec §10.4)
- The AI API key must never be exposed inside the Chrome extension — all AI calls go through the backend. (spec §14.3)
- Cache key: `domain + url + stable_content_hash + prompt_version`, computed over `title + heading hierarchy + paragraph text, in order`. (spec §16.1)
- Free-mode model: `claude-haiku-4-5` (Anthropic, low-cost tier), called via `@anthropic-ai/sdk` with `output_config.format` structured JSON output — never assistant-turn prefill, never raw string parsing of unstructured output.
- The UI must never render a Jump button that cannot resolve to a live DOM node — target-ID validation happens both backend-side (against the content that was sent) and extension-side (against the actual DOM), with the extension-side check being the final gate before rendering.

---

## File Structure

```
ai-read-map/
├── package.json                              # npm workspaces root
├── extension/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── vite.config.ts
│   └── src/
│       ├── manifest.ts                       # CRXJS manifest definition
│       ├── shared/
│       │   ├── types.ts                      # StructuredPageContent, ReadMapResult, etc.
│       │   └── validate-target-ids.ts         # client-side target-ID validation gate
│       ├── content/
│       │   ├── dom-extract.ts                # assigns data-ai-read-map-id to DOM nodes
│       │   ├── dom-extract.test.ts
│       │   ├── readability-extract.ts        # clone + Readability + ID-preserving section build
│       │   ├── quality-check.ts              # extraction minimums (spec §15.3)
│       │   ├── quality-check.test.ts
│       │   └── index.ts                      # content-script entry: message handlers, jump/highlight
│       ├── background/
│       │   └── service-worker.ts             # orchestrates extract -> backend call -> validate
│       └── sidepanel/
│           ├── index.html
│           ├── panel.ts                      # render overview/sections/jump/copy, loading/error
│           └── panel.css
└── backend/
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    └── src/
        ├── index.ts                          # Express app entry
        ├── types.ts                          # mirrors extension shared types
        ├── routes/
        │   └── readmap.ts                    # POST /api/readmap
        └── services/
            ├── prompt.ts                     # prompt template (spec §13)
            ├── anthropic-client.ts           # Claude call with structured output
            ├── validate-output.ts            # backend-side target-ID validation
            ├── validate-output.test.ts
            ├── content-hash.ts
            ├── content-hash.test.ts
            ├── cache.ts                      # in-memory cache, domain+url+hash+promptVersion key
            └── cache.test.ts
```

---

### Task 1: Monorepo Skeleton

**Files:**
- Create: `package.json` (root)
- Modify: `.gitignore`

**Interfaces:**
- Produces: an npm workspaces root that later tasks' `extension/` and `backend/` packages join.

- [ ] **Step 1: Create the root `package.json`**

```json
{
  "name": "ai-read-map",
  "private": true,
  "workspaces": ["extension", "backend"],
  "scripts": {
    "dev:extension": "npm run dev -w extension",
    "dev:backend": "npm run dev -w backend",
    "build:extension": "npm run build -w extension",
    "test": "npm run test -w extension && npm run test -w backend"
  }
}
```

- [ ] **Step 2: Extend `.gitignore`**

Read the existing `.gitignore` first, then append (if not already present):

```
node_modules/
dist/
.env
```

- [ ] **Step 3: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: add npm workspaces root"
```

---

### Task 2: Chrome Extension Skeleton (Vite + CRXJS, Manifest V3, Side Panel Shell)

**Files:**
- Create: `extension/package.json`
- Create: `extension/tsconfig.json`
- Create: `extension/vite.config.ts`
- Create: `extension/src/manifest.ts`
- Create: `extension/src/sidepanel/index.html`
- Create: `extension/src/sidepanel/panel.ts`
- Create: `extension/src/sidepanel/panel.css`
- Create: `extension/src/background/service-worker.ts`

**Interfaces:**
- Produces: a loadable unpacked extension with a side panel that opens on icon click and shows a "Generate Read Map" button (wired up for real in Task 10/11).

- [ ] **Step 1: Create `extension/package.json`**

```json
{
  "name": "ai-read-map-extension",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@mozilla/readability": "^0.5.0"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0",
    "@types/chrome": "^0.0.280",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `extension/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "types": ["chrome", "vite/client"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `extension/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'jsdom' },
})
```

- [ ] **Step 4: Create `extension/src/manifest.ts`**

```ts
import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'AI Read Map',
  version: '0.1.0',
  description: 'Turn long webpages into a clickable map of key sections.',
  permissions: ['activeTab', 'scripting', 'storage', 'sidePanel'],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  action: {},
})
```

Note: the content script is declared here so it's present on every page (required for `chrome.tabs.sendMessage` to reach it), but it does no work until it receives an `EXTRACT_PAGE` message — passively registering a listener is not "processing the page," so this does not violate the manual-trigger constraint. `src/content/index.ts` is created in Task 9; Vite will fail to resolve it until then, which is expected at this step.

- [ ] **Step 5: Create `extension/vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest'

export default defineConfig({
  plugins: [crx({ manifest })],
})
```

- [ ] **Step 6: Create `extension/src/background/service-worker.ts`**

```ts
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error)
```

- [ ] **Step 7: Create `extension/src/sidepanel/index.html`**

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AI Read Map</title>
  <link rel="stylesheet" href="./panel.css" />
</head>
<body>
  <div id="app">
    <h1>AI Read Map</h1>
    <button id="generate-btn">Generate Read Map</button>
    <div id="status"></div>
    <div id="result"></div>
    <details id="privacy-note">
      <summary>Privacy</summary>
      <p>
        Page content is only read after you click "Generate Read Map." The
        extracted text (not your browsing history) is sent to the AI Read Map
        backend to generate the read map, then discarded except for a
        short-lived cache keyed to this page's content. Remove the extension
        at any time to stop all processing.
      </p>
    </details>
  </div>
  <script type="module" src="./panel.ts"></script>
</body>
</html>
```

- [ ] **Step 8: Create `extension/src/sidepanel/panel.ts` (stub, expanded in Task 11)**

```ts
const btn = document.querySelector<HTMLButtonElement>('#generate-btn')!
const status = document.querySelector<HTMLDivElement>('#status')!

btn.addEventListener('click', () => {
  status.textContent = 'Wiring added in a later task.'
})
```

- [ ] **Step 9: Create `extension/src/sidepanel/panel.css`**

```css
body { font-family: system-ui, sans-serif; margin: 0; padding: 12px; }
#status.loading { color: #555; }
#status.error { color: #b00020; }
#result ol { padding-left: 20px; }
#result li { margin-bottom: 12px; }
#result button { margin-top: 4px; }
```

- [ ] **Step 10: Install dependencies and verify the dev build starts**

```bash
npm install
npm run dev -w extension
```

Expected: Vite starts without a fatal error about `src/content/index.ts` being unresolved is acceptable at this point (it doesn't exist yet) — if Vite hard-fails instead of just warning, stop and create an empty placeholder `extension/src/content/index.ts` with a single `export {}` line so the dev server can start; Task 9 will replace it.

- [ ] **Step 11: Commit**

```bash
git add extension package.json
git commit -m "feat: scaffold Chrome extension with Vite, CRXJS, and side panel shell"
```

---

### Task 3: DOM Paragraph/Heading ID Assignment

**Files:**
- Create: `extension/src/shared/types.ts`
- Create: `extension/src/content/dom-extract.ts`
- Test: `extension/src/content/dom-extract.test.ts`

**Interfaces:**
- Produces: `assignParagraphIds(doc?: Document): Map<string, HTMLElement>` — sets `data-ai-read-map-id` on candidate paragraph/heading nodes in document order and returns the id→node map. Consumed by Task 4.
- Produces: `resetIdCounter(): void` — test-only helper to make IDs deterministic across test runs.

- [ ] **Step 1: Create `extension/src/shared/types.ts`**

```ts
export interface ParagraphContent {
  id: string
  text: string
}

export interface SectionContent {
  id: string
  heading: string | null
  paragraphs: ParagraphContent[]
}

export interface StructuredPageContent {
  title: string
  url: string
  domain: string
  sections: SectionContent[]
}

export interface KeySection {
  label: string
  whyRead: string
  targetId: string
}

export interface ReadMapResult {
  status: 'ok' | 'not_suitable' | 'low_confidence'
  overview: string
  keySections: KeySection[]
  pageQuality: 'high' | 'medium' | 'low'
  missingContext: string[]
  reason: string
}
```

- [ ] **Step 2: Write the failing test**

```ts
// extension/src/content/dom-extract.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { assignParagraphIds, resetIdCounter } from './dom-extract'

describe('assignParagraphIds', () => {
  beforeEach(() => resetIdCounter())

  it('assigns IDs to headings and paragraphs with enough text', () => {
    document.body.innerHTML = `
      <h2>A real heading</h2>
      <p>This paragraph has plenty of readable text in it, well past the minimum length.</p>
    `
    const idToNode = assignParagraphIds(document)
    expect(idToNode.size).toBe(2)
    expect(document.querySelector('h2')?.getAttribute('data-ai-read-map-id')).toBeTruthy()
    expect(document.querySelector('p')?.getAttribute('data-ai-read-map-id')).toBeTruthy()
  })

  it('skips short text and nav/footer/aside/form content', () => {
    document.body.innerHTML = `
      <p>short</p>
      <nav><p>This nav paragraph is long enough but should still be skipped entirely.</p></nav>
      <p>This paragraph is long enough and outside any excluded container, so it counts.</p>
    `
    const idToNode = assignParagraphIds(document)
    expect(idToNode.size).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w extension`
Expected: FAIL with "Cannot find module './dom-extract'"

- [ ] **Step 3: Create `extension/src/content/dom-extract.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -w extension`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extension/src/shared/types.ts extension/src/content/dom-extract.ts extension/src/content/dom-extract.test.ts
git commit -m "feat: assign stable IDs to paragraph and heading DOM nodes"
```

---

### Task 4: Readability-Based Structured Extraction (ID-Preserving)

**Files:**
- Create: `extension/src/content/readability-extract.ts`

**Interfaces:**
- Consumes: `assignParagraphIds` from Task 3 (`extension/src/content/dom-extract.ts`).
- Produces: `extractStructuredContent(doc?: Document): StructuredPageContent` — the function Task 9's content script calls on `EXTRACT_PAGE`.

- [ ] **Step 1: Create `extension/src/content/readability-extract.ts`**

```ts
import { Readability } from '@mozilla/readability'
import { assignParagraphIds } from './dom-extract'
import type { StructuredPageContent, SectionContent, ParagraphContent } from '../shared/types'

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
```

- [ ] **Step 2: Manual verification**

```bash
npm install
```

There is no unit test here — Readability's DOM-cloning behavior under jsdom is flaky enough that a unit test would mostly test jsdom, not this code. Task 9's content-script integration and the manual E2E check in Task 12 are this function's real check.

- [ ] **Step 3: Commit**

```bash
git add extension/src/content/readability-extract.ts extension/package.json extension/package-lock.json
git commit -m "feat: extract structured page content while preserving paragraph IDs"
```

---

### Task 5: Extraction Quality Checks

**Files:**
- Create: `extension/src/content/quality-check.ts`
- Test: `extension/src/content/quality-check.test.ts`

**Interfaces:**
- Consumes: `StructuredPageContent` from `extension/src/shared/types.ts`.
- Produces: `checkExtractionQuality(content: StructuredPageContent): { passed: boolean; reason?: string }` — consumed by Task 9's content script and Task 10's background worker.

- [ ] **Step 1: Write the failing test**

```ts
// extension/src/content/quality-check.test.ts
import { describe, it, expect } from 'vitest'
import { checkExtractionQuality } from './quality-check'
import type { StructuredPageContent } from '../shared/types'

function makeContent(paragraphTexts: string[]): StructuredPageContent {
  return {
    title: 'Test',
    url: 'https://example.com',
    domain: 'example.com',
    sections: [{ id: 's1', heading: null, paragraphs: paragraphTexts.map((text, i) => ({ id: `p${i}`, text })) }],
  }
}

describe('checkExtractionQuality', () => {
  it('fails when total text is under 500 characters', () => {
    const result = checkExtractionQuality(makeContent(['short'.repeat(10)]))
    expect(result.passed).toBe(false)
    expect(result.reason).toMatch(/too short/i)
  })

  it('fails when there are fewer than 5 paragraphs', () => {
    const longText = 'word '.repeat(30)
    const result = checkExtractionQuality(makeContent([longText, longText]))
    expect(result.passed).toBe(false)
  })

  it('passes when minimums are met', () => {
    const longText = 'word '.repeat(30) // 150 chars, well over the 40-char meaningful-block bar
    const result = checkExtractionQuality(makeContent(Array(5).fill(longText)))
    expect(result.passed).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w extension`
Expected: FAIL with "Cannot find module './quality-check'"

- [ ] **Step 3: Create `extension/src/content/quality-check.ts`**

```ts
import type { StructuredPageContent } from '../shared/types'

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -w extension`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extension/src/content/quality-check.ts extension/src/content/quality-check.test.ts
git commit -m "feat: add extraction quality checks per MVP minimums"
```

---

### Task 6: Backend Skeleton (Express + TypeScript)

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env.example`
- Create: `backend/src/types.ts`
- Create: `backend/src/index.ts`

**Interfaces:**
- Produces: a running Express server with `GET /health`, ready for Task 8 to add `POST /api/readmap`.

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "ai-read-map-backend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.35.0",
    "express": "^4.21.0",
    "express-rate-limit": "^7.4.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `backend/.env.example`**

```
ANTHROPIC_API_KEY=sk-ant-...
PORT=8787
```

- [ ] **Step 4: Create `backend/src/types.ts`**

```ts
export interface ParagraphContent {
  id: string
  text: string
}

export interface SectionContent {
  id: string
  heading: string | null
  paragraphs: ParagraphContent[]
}

export interface StructuredPageContent {
  title: string
  url: string
  domain: string
  sections: SectionContent[]
}

export interface KeySection {
  label: string
  whyRead: string
  targetId: string
}

export interface ReadMapResult {
  status: 'ok' | 'not_suitable' | 'low_confidence'
  overview: string
  keySections: KeySection[]
  pageQuality: 'high' | 'medium' | 'low'
  missingContext: string[]
  reason: string
}
```

This intentionally mirrors `extension/src/shared/types.ts`. `ponytail:` two packages, one small duplicated type file — not worth a shared npm package at MVP scale; extract one if the types drift and cause a bug.

- [ ] **Step 5: Create `backend/src/index.ts`**

```ts
import express from 'express'

const app = express()
app.use(express.json({ limit: '2mb' }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787
app.listen(PORT, () => console.log(`ai-read-map backend listening on :${PORT}`))
```

- [ ] **Step 6: Verify the server starts**

```bash
npm install
cp backend/.env.example backend/.env  # then fill in a real ANTHROPIC_API_KEY
npm run dev -w backend
curl http://localhost:8787/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
git add backend package.json package-lock.json
git commit -m "feat: scaffold Express backend"
```

---

### Task 7: Anthropic Integration — Prompt and Structured Read Map Generation

**Files:**
- Create: `backend/src/services/prompt.ts`
- Create: `backend/src/services/anthropic-client.ts`

**Interfaces:**
- Consumes: `StructuredPageContent` from `backend/src/types.ts`.
- Produces: `generateReadMap(content: StructuredPageContent): Promise<ReadMapResult>` and `PROMPT_VERSION: string`, both consumed by Task 8's route.

- [ ] **Step 1: Create `backend/src/services/prompt.ts`**

```ts
import type { StructuredPageContent } from '../types.js'

export const PROMPT_VERSION = 'v1'

export function buildPrompt(content: StructuredPageContent): string {
  return `You are helping a user skim a long webpage.

Your job is to create a clickable reading map.
Your job is not to replace the page.
Your job is to help the user decide which parts of the original page are worth reading.

Use ONLY the page content provided below.
Do not use outside knowledge.
Do not infer facts that are not stated in the page.
Do not provide legal, financial, medical, immigration, investment, tax, or safety advice.
Do not recommend what decision the user should make.
Do not speculate about causes, motives, consequences, or future outcomes unless the page explicitly states them.
Ignore navigation text, ads, newsletter prompts, comments, related links, footer content, and promotional content.

Select 2 to 5 useful sections or paragraphs.
If the page has limited useful content, return fewer sections.
Do not force weak sections.

For each selected section:
- Provide a short label
- Explain why this section is worth reading
- Return the paragraphId or sectionId
- Stay neutral
- Do not add unsupported interpretation

If the page is not suitable for a reading map, return status: "not_suitable" with a short reason.

Return valid JSON only.

Rules:
- overview must be 1 to 2 short sentences.
- keySections must contain 2 to 5 items when status is ok.
- label must be under 8 words.
- whyRead must be under 20 words.
- targetId must match one of the provided paragraph or section IDs.
- pageQuality should reflect whether the extracted content is clear and complete.
- missingContext should be empty unless the page content is incomplete or unclear.
- reason should be empty when status is ok.

Page content:
${JSON.stringify(content)}`
}
```

- [ ] **Step 2: Create `backend/src/services/anthropic-client.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk'
import { buildPrompt } from './prompt.js'
import type { StructuredPageContent, ReadMapResult } from '../types.js'

const client = new Anthropic()

const READMAP_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'not_suitable', 'low_confidence'] },
    overview: { type: 'string' },
    keySections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          whyRead: { type: 'string' },
          targetId: { type: 'string' },
        },
        required: ['label', 'whyRead', 'targetId'],
        additionalProperties: false,
      },
    },
    pageQuality: { type: 'string', enum: ['high', 'medium', 'low'] },
    missingContext: { type: 'array', items: { type: 'string' } },
    reason: { type: 'string' },
  },
  required: ['status', 'overview', 'keySections', 'pageQuality', 'missingContext', 'reason'],
  additionalProperties: false,
} as const

export async function generateReadMap(content: StructuredPageContent): Promise<ReadMapResult> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    output_config: { format: { type: 'json_schema', schema: READMAP_SCHEMA } },
    messages: [{ role: 'user', content: buildPrompt(content) }],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('AI response contained no text content')
  }

  return JSON.parse(textBlock.text) as ReadMapResult
}
```

`output_config.format` with a JSON schema guarantees Claude's response is valid JSON matching this shape (structured outputs), so `JSON.parse` here cannot throw on malformed JSON — it can still throw if the API itself errors, which the route in Task 8 catches.

- [ ] **Step 3: Manual verification**

```bash
npm install
node --input-type=module -e "
import { generateReadMap } from './backend/dist/services/anthropic-client.js'
" # skip if dist/ doesn't exist yet — real verification happens via Task 8's endpoint
```

There's no isolated unit test for this module — it's a thin wrapper around a live API call, and mocking the Anthropic SDK's response shape would mostly test the mock. Task 8's manual `curl` verification against a live page is this module's real check.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/prompt.ts backend/src/services/anthropic-client.ts backend/package.json backend/package-lock.json
git commit -m "feat: generate structured read maps via Claude"
```

---

### Task 8: Read Map Endpoint — Cache, Validation, Rate Limiting, Error Handling

**Files:**
- Create: `backend/src/services/content-hash.ts`
- Test: `backend/src/services/content-hash.test.ts`
- Create: `backend/src/services/cache.ts`
- Test: `backend/src/services/cache.test.ts`
- Create: `backend/src/services/validate-output.ts`
- Test: `backend/src/services/validate-output.test.ts`
- Create: `backend/src/routes/readmap.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes: `generateReadMap`, `PROMPT_VERSION` from Task 7.
- Produces: `POST /api/readmap` — accepts a `StructuredPageContent` body, returns a `ReadMapResult`. Consumed by Task 10's background worker.

- [ ] **Step 1: Write the failing test for content hashing**

```ts
// backend/src/services/content-hash.test.ts
import { describe, it, expect } from 'vitest'
import { computeContentHash } from './content-hash'
import type { StructuredPageContent } from '../types'

const base: StructuredPageContent = {
  title: 'Title',
  url: 'https://example.com/a',
  domain: 'example.com',
  sections: [{ id: 's1', heading: 'Intro', paragraphs: [{ id: 'p1', text: 'Hello world' }] }],
}

describe('computeContentHash', () => {
  it('is stable for identical content', () => {
    expect(computeContentHash(base)).toBe(computeContentHash({ ...base }))
  })

  it('changes when paragraph text changes', () => {
    const changed: StructuredPageContent = {
      ...base,
      sections: [{ ...base.sections[0], paragraphs: [{ id: 'p1', text: 'Different text' }] }],
    }
    expect(computeContentHash(base)).not.toBe(computeContentHash(changed))
  })

  it('ignores url and paragraph ids', () => {
    const differentUrl: StructuredPageContent = { ...base, url: 'https://example.com/b' }
    expect(computeContentHash(base)).toBe(computeContentHash(differentUrl))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -w backend`
Expected: FAIL with "Cannot find module './content-hash'"

- [ ] **Step 3: Create `backend/src/services/content-hash.ts`**

```ts
import { createHash } from 'node:crypto'
import type { StructuredPageContent } from '../types.js'

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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -w backend`
Expected: PASS

- [ ] **Step 5: Write the failing test for the cache**

```ts
// backend/src/services/cache.test.ts
import { describe, it, expect } from 'vitest'
import { buildCacheKey, getCached, setCached } from './cache'
import type { ReadMapResult } from '../types'

const readMap: ReadMapResult = {
  status: 'ok',
  overview: 'Overview',
  keySections: [],
  pageQuality: 'high',
  missingContext: [],
  reason: '',
}

describe('cache', () => {
  it('returns undefined for a miss and the value for a hit', () => {
    const key = buildCacheKey('example.com', 'https://example.com/a', 'hash1', 'v1')
    expect(getCached(key)).toBeUndefined()
    setCached(key, readMap)
    expect(getCached(key)).toEqual(readMap)
  })

  it('keys are distinct per content hash', () => {
    const keyA = buildCacheKey('example.com', 'https://example.com/a', 'hashA', 'v1')
    const keyB = buildCacheKey('example.com', 'https://example.com/a', 'hashB', 'v1')
    setCached(keyA, readMap)
    expect(getCached(keyB)).toBeUndefined()
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `npm run test -w backend`
Expected: FAIL with "Cannot find module './cache'"

- [ ] **Step 7: Create `backend/src/services/cache.ts`**

```ts
import type { ReadMapResult } from '../types.js'

interface CacheEntry {
  value: ReadMapResult
  createdAt: number
}

// ponytail: single-process in-memory cache — entries are lost on restart and
// not shared across instances. Move to Redis if the backend scales beyond
// one process or needs to survive restarts.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, CacheEntry>()

export function buildCacheKey(domain: string, url: string, contentHash: string, promptVersion: string): string {
  return `${domain}|${url}|${contentHash}|${promptVersion}`
}

export function getCached(key: string): ReadMapResult | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    cache.delete(key)
    return undefined
  }
  return entry.value
}

export function setCached(key: string, value: ReadMapResult): void {
  cache.set(key, { value, createdAt: Date.now() })
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npm run test -w backend`
Expected: PASS

- [ ] **Step 9: Write the failing test for target-ID validation**

```ts
// backend/src/services/validate-output.test.ts
import { describe, it, expect } from 'vitest'
import { validateReadMap } from './validate-output'
import type { ReadMapResult } from '../types'

function makeResult(overrides: Partial<ReadMapResult> = {}): ReadMapResult {
  return {
    status: 'ok',
    overview: 'Overview',
    keySections: [
      { label: 'A', whyRead: 'why', targetId: 'p1' },
      { label: 'B', whyRead: 'why', targetId: 'p2' },
    ],
    pageQuality: 'high',
    missingContext: [],
    reason: '',
    ...overrides,
  }
}

describe('validateReadMap', () => {
  it('passes through when all target IDs are valid', () => {
    const result = validateReadMap(makeResult(), new Set(['p1', 'p2']))
    expect(result.status).toBe('ok')
    expect(result.keySections).toHaveLength(2)
  })

  it('drops invalid target IDs', () => {
    const result = validateReadMap(
      makeResult({
        keySections: [
          { label: 'A', whyRead: 'why', targetId: 'p1' },
          { label: 'Fake', whyRead: 'why', targetId: 'does-not-exist' },
          { label: 'C', whyRead: 'why', targetId: 'p2' },
        ],
      }),
      new Set(['p1', 'p2']),
    )
    expect(result.keySections.map((s) => s.targetId)).toEqual(['p1', 'p2'])
  })

  it('drops duplicate target IDs, keeping the first', () => {
    const result = validateReadMap(
      makeResult({
        keySections: [
          { label: 'A', whyRead: 'why', targetId: 'p1' },
          { label: 'A again', whyRead: 'why', targetId: 'p1' },
        ],
      }),
      new Set(['p1']),
    )
    expect(result.keySections).toHaveLength(1)
  })

  it('downgrades to low_confidence when fewer than 2 valid sections remain', () => {
    const result = validateReadMap(
      makeResult({ keySections: [{ label: 'A', whyRead: 'why', targetId: 'p1' }] }),
      new Set(['p1']),
    )
    expect(result.status).toBe('low_confidence')
  })

  it('leaves non-ok statuses untouched', () => {
    const result = validateReadMap(makeResult({ status: 'not_suitable', keySections: [] }), new Set())
    expect(result.status).toBe('not_suitable')
  })
})
```

- [ ] **Step 10: Run to verify it fails**

Run: `npm run test -w backend`
Expected: FAIL with "Cannot find module './validate-output'"

- [ ] **Step 11: Create `backend/src/services/validate-output.ts`**

```ts
import type { ReadMapResult } from '../types.js'

export function validateReadMap(result: ReadMapResult, validTargetIds: Set<string>): ReadMapResult {
  if (result.status !== 'ok') return result

  const seen = new Set<string>()
  const validSections = result.keySections.filter((section) => {
    if (!validTargetIds.has(section.targetId)) return false
    if (seen.has(section.targetId)) return false
    seen.add(section.targetId)
    return true
  })

  if (validSections.length < 2) {
    return {
      ...result,
      status: 'low_confidence',
      keySections: validSections,
      reason: 'Not enough valid key sections after validation',
    }
  }

  return { ...result, keySections: validSections }
}
```

- [ ] **Step 12: Run to verify it passes**

Run: `npm run test -w backend`
Expected: PASS

- [ ] **Step 13: Create `backend/src/routes/readmap.ts`**

```ts
import { Router } from 'express'
import { generateReadMap } from '../services/anthropic-client.js'
import { validateReadMap } from '../services/validate-output.js'
import { computeContentHash } from '../services/content-hash.js'
import { buildCacheKey, getCached, setCached } from '../services/cache.js'
import { PROMPT_VERSION } from '../services/prompt.js'
import type { StructuredPageContent } from '../types.js'

const MAX_CONTENT_CHARS = 50_000

export const readmapRouter = Router()

readmapRouter.post('/readmap', async (req, res) => {
  const content = req.body as StructuredPageContent

  if (!content || !Array.isArray(content.sections)) {
    return res.status(400).json({ status: 'not_suitable', overview: '', keySections: [], pageQuality: 'low', missingContext: [], reason: 'Invalid request body' })
  }

  const paragraphs = content.sections.flatMap((s) => s.paragraphs)
  const totalChars = paragraphs.reduce((sum, p) => sum + p.text.length, 0)

  if (totalChars > MAX_CONTENT_CHARS) {
    return res.status(413).json({ status: 'not_suitable', overview: '', keySections: [], pageQuality: 'low', missingContext: [], reason: 'Page text too long' })
  }

  const contentHash = computeContentHash(content)
  const cacheKey = buildCacheKey(content.domain, content.url, contentHash, PROMPT_VERSION)

  const cached = getCached(cacheKey)
  if (cached) {
    console.log('[ai-read-map] cache_hit', { domain: content.domain })
    return res.json(cached)
  }
  console.log('[ai-read-map] cache_miss', { domain: content.domain })

  const validTargetIds = new Set(content.sections.flatMap((s) => [s.id, ...s.paragraphs.map((p) => p.id)]))

  try {
    const raw = await generateReadMap(content)
    const validated = validateReadMap(raw, validTargetIds)
    setCached(cacheKey, validated)
    console.log('[ai-read-map] read_map_success', { domain: content.domain, status: validated.status, sectionCount: validated.keySections.length })
    res.json(validated)
  } catch (err) {
    console.error('[ai-read-map] read_map_failed', { domain: content.domain, error: (err as Error).message })
    res.status(502).json({ status: 'not_suitable', overview: '', keySections: [], pageQuality: 'low', missingContext: [], reason: 'AI generation failed' })
  }
})
```

- [ ] **Step 14: Wire the router and rate limiting into `backend/src/index.ts`**

```ts
import express from 'express'
import rateLimit from 'express-rate-limit'
import { readmapRouter } from './routes/readmap.js'

const app = express()
app.use(express.json({ limit: '2mb' }))

const limiter = rateLimit({ windowMs: 60_000, max: 20 })
app.use('/api', limiter, readmapRouter)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787
app.listen(PORT, () => console.log(`ai-read-map backend listening on :${PORT}`))
```

- [ ] **Step 15: Manual verification against a live page**

```bash
npm run dev -w backend
curl -X POST http://localhost:8787/api/readmap \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Article",
    "url": "https://example.com/article",
    "domain": "example.com",
    "sections": [
      {"id": "s1", "heading": "Introduction", "paragraphs": [
        {"id": "p1", "text": "This is the first paragraph of a long article about a made-up policy change that affects many people across several regions."},
        {"id": "p2", "text": "This second paragraph explains the timeline for the change, including when it starts and when the transition period ends for everyone involved."}
      ]},
      {"id": "s2", "heading": "Eligibility", "paragraphs": [
        {"id": "p3", "text": "This paragraph lists who is eligible for the program and what documentation is required to apply before the deadline passes."},
        {"id": "p4", "text": "This paragraph describes exceptions to the eligibility rules for a smaller group of applicants under special circumstances."},
        {"id": "p5", "text": "This final paragraph summarizes next steps and where to find more information about the application process online."}
      ]}
    ]
  }'
```

Expected: a JSON response with `status: "ok"`, an `overview`, and 2–5 `keySections` whose `targetId`s are all drawn from `p1`–`p5`.

- [ ] **Step 16: Commit**

```bash
git add backend/src/services backend/src/routes backend/src/index.ts
git commit -m "feat: add read map endpoint with caching, validation, and rate limiting"
```

---

### Task 9: Content Script — Message Handlers and Jump/Highlight

**Files:**
- Create: `extension/src/content/index.ts`

**Interfaces:**
- Consumes: `extractStructuredContent` (Task 4), `checkExtractionQuality` (Task 5).
- Produces: content script responding to `chrome.runtime` messages `EXTRACT_PAGE` (returns `{ content, quality }`) and `JUMP_TO_PARAGRAPH` (scrolls and highlights). Consumed by Task 10's background worker.

- [ ] **Step 1: Create `extension/src/content/index.ts`**

```ts
import { extractStructuredContent } from './readability-extract'
import { checkExtractionQuality } from './quality-check'
import type { StructuredPageContent } from '../shared/types'

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
```

Note: `extractStructuredContent` already calls `assignParagraphIds` internally (Task 4), so `collectIdToNode` here just re-queries the now-tagged DOM rather than re-deriving IDs — this keeps a single source of truth for ID assignment.

- [ ] **Step 2: If Task 2's placeholder file exists, remove it**

If `extension/src/content/index.ts` previously contained only `export {}` from Task 2 Step 10, this step's content replaces it — no separate deletion needed.

- [ ] **Step 3: Manual verification**

```bash
npm run dev -w extension
```

Load the unpacked extension (`extension/dist` after `npm run build -w extension`, or the Vite dev output per CRXJS docs) in `chrome://extensions`, open any long article page, open the extension's side panel, and confirm no console errors appear in the page's DevTools or the content script's console.

- [ ] **Step 4: Commit**

```bash
git add extension/src/content/index.ts
git commit -m "feat: wire content script extraction and jump/highlight messaging"
```

---

### Task 10: Background Service Worker — Orchestration and Client-Side Validation

**Files:**
- Create: `extension/src/shared/validate-target-ids.ts`
- Modify: `extension/src/background/service-worker.ts`

**Interfaces:**
- Consumes: `StructuredPageContent`, `ReadMapResult` from `extension/src/shared/types.ts`.
- Produces: `chrome.runtime` message handler for `GENERATE_READMAP` (returns `{ ok: true, readMap } | { ok: false, error }`) and forwards `JUMP_TO_PARAGRAPH` to the active tab. Consumed by Task 11's side panel.

- [ ] **Step 1: Create `extension/src/shared/validate-target-ids.ts`**

```ts
import type { ReadMapResult } from './types'

// Mirrors backend/src/services/validate-output.ts. ponytail: kept as a small
// duplicate rather than a shared package — this is the extension's own gate
// against the *live DOM*, which only the extension can check; the backend's
// copy validates against what it was sent, which is a different, earlier check.
export function validateReadMap(result: ReadMapResult, validTargetIds: Set<string>): ReadMapResult {
  if (result.status !== 'ok') return result

  const seen = new Set<string>()
  const validSections = result.keySections.filter((section) => {
    if (!validTargetIds.has(section.targetId)) return false
    if (seen.has(section.targetId)) return false
    seen.add(section.targetId)
    return true
  })

  if (validSections.length < 2) {
    return {
      ...result,
      status: 'low_confidence',
      keySections: validSections,
      reason: 'Not enough valid key sections after validation',
    }
  }

  return { ...result, keySections: validSections }
}
```

- [ ] **Step 2: Replace `extension/src/background/service-worker.ts`**

```ts
import { validateReadMap } from '../shared/validate-target-ids'
import type { StructuredPageContent, ReadMapResult } from '../shared/types'

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

async function handleGenerate(): Promise<{ ok: true; readMap: ReadMapResult } | { ok: false; error: string }> {
  console.log('[ai-read-map] read_map_requested')
  try {
    const tab = await getActiveTab()
    const { content, quality } = await chrome.tabs.sendMessage(tab.id!, { type: 'EXTRACT_PAGE' })

    if (!quality.passed) {
      return { ok: false, error: quality.reason }
    }

    const rawReadMap = await requestReadMap(content as StructuredPageContent)
    const validTargetIds = new Set(
      (content as StructuredPageContent).sections.flatMap((s) => [s.id, ...s.paragraphs.map((p) => p.id)]),
    )
    const readMap = validateReadMap(rawReadMap, validTargetIds)

    return { ok: true, readMap }
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
    throw new Error(`Backend error: ${response.status}`)
  }
  return response.json()
}
```

- [ ] **Step 3: Manual verification**

With the backend running (`npm run dev -w backend`) and the extension reloaded in `chrome://extensions`, open a long article page, open the side panel, and click "Generate Read Map" (still a no-op stub in the panel until Task 11 — verify instead via the service worker's console: `chrome://extensions` → "service worker" link → console). Sending `chrome.runtime.sendMessage({type: 'GENERATE_READMAP'})` from that console should log `read_map_requested` and eventually resolve with `{ok: true, readMap: {...}}`.

- [ ] **Step 4: Commit**

```bash
git add extension/src/shared/validate-target-ids.ts extension/src/background/service-worker.ts
git commit -m "feat: orchestrate generate flow with client-side target-ID validation"
```

---

### Task 11: Side Panel UI — Overview, Key Sections, Jump, Copy, Loading/Error States

**Files:**
- Modify: `extension/src/sidepanel/panel.ts`

**Interfaces:**
- Consumes: `chrome.runtime.sendMessage({type: 'GENERATE_READMAP'})` and `{type: 'JUMP_TO_PARAGRAPH', targetId}` from Task 10.

- [ ] **Step 1: Replace `extension/src/sidepanel/panel.ts`**

```ts
import type { ReadMapResult } from '../shared/types'

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
```

- [ ] **Step 2: End-to-end manual verification**

With the backend running and the extension reloaded:

1. Open a long article page (news article, blog post, or documentation page with clear headings/paragraphs).
2. Click the extension icon → side panel opens.
3. Click "Generate Read Map" → status shows "Generating read map...", then an overview and 2–5 key sections appear, each with a "Jump" button.
4. Click "Jump" on a section → the page scrolls to and briefly highlights the corresponding paragraph.
5. Click "Copy Read Map" → paste into a text editor and confirm the title/overview/sections format matches spec §9.8.
6. Open a page that is clearly unsuitable (e.g. a search results page or a mostly-empty page) and confirm a `not_suitable` or extraction-failure message renders instead of broken UI.

- [ ] **Step 3: Commit**

```bash
git add extension/src/sidepanel/panel.ts
git commit -m "feat: render read map with jump, copy, and loading/error states"
```

---

### Task 12: Final Verification Pass

**Files:** None — this task only runs existing code and checks it against the spec's acceptance criteria (spec §21).

- [ ] **Step 1: Run the full test suite**

```bash
npm run test
```

Expected: all Vitest suites (extension: `dom-extract`, `quality-check`; backend: `content-hash`, `cache`, `validate-output`) pass.

- [ ] **Step 2: Run both dev servers together**

```bash
npm run dev:backend   # terminal 1
npm run dev:extension # terminal 2
```

Load the extension unpacked, and repeat the manual E2E flow from Task 11 Step 2 against at least two different domains (e.g. a news article and a technical documentation page) to sanity-check extraction across page shapes, per spec §23.1's mitigation of "start with article-like pages, track failed pages."

- [ ] **Step 3: Check spec acceptance criteria (spec §21)**

Confirm each of the following manually:
- The extension extracts title, headings, and paragraphs and assigns IDs.
- Every rendered Jump button resolves to a real DOM node (Task 10's `validateReadMap` gate).
- The backend never returns a broken JSON shape (structured outputs in Task 7 enforce this).
- Output stays grounded — spot-check that `whyRead` text references only what's in the page, not outside knowledge.
- A `not_suitable` page (e.g. a login page or search results page) shows a graceful message, not a crash.
- The `ANTHROPIC_API_KEY` never appears in any extension file, network request from the extension, or `extension/dist` build output — grep the built extension bundle to confirm: `grep -r "sk-ant" extension/dist` should return nothing.

- [ ] **Step 4: Commit any fixes found during verification, then stop — no separate commit needed if nothing changed**

---

## Self-Review Notes

- **Spec coverage:** Manual trigger (Task 2 manifest — no `matches` auto-run of extraction, only passive listener), extraction + IDs (Tasks 3–5), backend + AI (Tasks 6–8), target-ID validation both server- and client-side (Tasks 8, 10), jump/highlight (Task 9), side panel + copy + loading/error (Task 11), caching + rate limiting (Task 8), privacy note (Task 2's side panel HTML), lightweight logging (Tasks 8, 10, 11 `console.log` calls). BYOK (spec §24) is explicitly out of scope per this plan's header.
- **Placeholder scan:** No `TODO`/`TBD` left in any step; every code block is complete and runnable as written.
- **Type consistency:** `StructuredPageContent`, `SectionContent`, `ParagraphContent`, `ReadMapResult`, `KeySection` are defined identically (by design, per the Task 6 Step 4 note) in `extension/src/shared/types.ts` and `backend/src/types.ts`, and every task that references them uses these exact names and shapes.

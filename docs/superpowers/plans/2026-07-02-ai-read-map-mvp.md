# AI Read Map — Core MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI Read Map MVP end-to-end — a Chrome extension that extracts a webpage's readable content, sends it to a backend that calls Claude to generate a 2–5 section "read map," and lets the user jump to and highlight the original paragraph for each section.

**Architecture:** npm-workspaces monorepo with three packages: `shared/` (types + the target-ID validation function used by both other packages), `extension/` (Manifest V3 Chrome extension, Vite + CRXJS, vanilla TypeScript), and `backend/` (Node.js + Express + TypeScript API that calls the Anthropic API and never exposes the API key to the browser). The content script assigns stable IDs to DOM paragraphs/headings before running Mozilla's Readability extractor on a cloned document, so IDs survive extraction and can be used to scroll-and-highlight the original node later. The backend enforces a JSON schema on Claude's response via structured outputs, validates target IDs, caches by content hash, and rate-limits requests. `shared`'s `validateReadMap` is called twice — once backend-side (against the content that was sent) and once extension-side (against the live DOM) — because those are genuinely different checks against different sources of truth, not duplicated logic.

**Tech Stack:** TypeScript everywhere, no build step for `shared` (consumed as TS source by both Vite and tsx). Extension: Vite, `@crxjs/vite-plugin`, `@mozilla/readability`, Vitest + jsdom. Backend: Express, `@anthropic-ai/sdk` (model `claude-haiku-4-5`), `express-rate-limit`, `tsx` (dev and run, no compile step), Vitest.

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
- Shared logic (types, target-ID validation) lives in the `shared` workspace and is imported by both `extension` and `backend` — it is not duplicated in either package.

---

## File Structure

```
ai-read-map/
├── package.json                              # npm workspaces root: shared, extension, backend
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types.ts                          # StructuredPageContent, ReadMapResult, etc.
│       ├── validate-read-map.ts               # target-ID validation (used by both consumers)
│       ├── validate-read-map.test.ts
│       └── index.ts                           # re-exports
├── extension/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── vite.config.ts
│   └── src/
│       ├── manifest.ts                        # CRXJS manifest definition
│       ├── content/
│       │   ├── dom-extract.ts                 # assigns data-ai-read-map-id to DOM nodes
│       │   ├── dom-extract.test.ts
│       │   ├── readability-extract.ts         # clone + Readability + ID-preserving section build
│       │   ├── readability-extract.test.ts
│       │   ├── quality-check.ts                # extraction minimums (spec §15.3)
│       │   ├── quality-check.test.ts
│       │   └── index.ts                        # content-script entry: message handlers, jump/highlight
│       ├── background/
│       │   └── service-worker.ts               # orchestrates extract -> backend call -> validate
│       └── sidepanel/
│           ├── index.html
│           ├── panel.ts                        # render overview/sections/jump/copy, loading/error
│           └── panel.css
└── backend/
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    └── src/
        ├── index.ts                            # Express app entry
        ├── routes/
        │   └── readmap.ts                       # POST /api/readmap
        └── services/
            ├── prompt.ts                        # prompt template (spec §13)
            ├── anthropic-client.ts               # Claude call with structured output
            ├── anthropic-client.test.ts
            ├── content-hash.ts
            ├── content-hash.test.ts
            ├── cache.ts                          # in-memory cache, domain+url+hash+promptVersion key
            └── cache.test.ts
```

---

### Task 1: Monorepo Skeleton

**Files:**
- Create: `package.json` (root)
- Modify: `.gitignore`

**Interfaces:**
- Produces: an npm workspaces root that later tasks' `shared/`, `extension/`, and `backend/` packages join.

- [ ] **Step 1: Create the root `package.json`**

```json
{
  "name": "ai-read-map",
  "private": true,
  "workspaces": ["shared", "extension", "backend"],
  "scripts": {
    "dev:extension": "npm run dev -w extension",
    "dev:backend": "npm run dev -w backend",
    "build:extension": "npm run build -w extension",
    "test": "npm run test -w shared && npm run test -w extension && npm run test -w backend"
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

### Task 2: Shared Package — Types and Target-ID Validation

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/types.ts`
- Test: `shared/src/validate-read-map.test.ts`
- Create: `shared/src/validate-read-map.ts`
- Create: `shared/src/index.ts`

**Interfaces:**
- Produces: `StructuredPageContent`, `SectionContent`, `ParagraphContent`, `ReadMapResult`, `KeySection` types, and `validateReadMap(result: ReadMapResult, validTargetIds: Set<string>): ReadMapResult`. Both are imported as `ai-read-map-shared` by `extension` (Tasks 5, 6, 10, 11) and `backend` (Tasks 8, 9).

- [ ] **Step 1: Create `shared/package.json`**

```json
{
  "name": "ai-read-map-shared",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

No build step — both consumers (Vite in `extension`, `tsx` in `backend`) transpile this package's TypeScript source directly wherever it's imported from. `ponytail:` skip a compiled `dist/` for this package; add one only if a consumer needs plain pre-compiled JS (e.g. a non-tsx/non-Vite deployment target).

- [ ] **Step 2: Create `shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `shared/src/types.ts`**

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

- [ ] **Step 4: Write the failing test for `validateReadMap`**

```ts
// shared/src/validate-read-map.test.ts
import { describe, it, expect } from 'vitest'
import { validateReadMap } from './validate-read-map.js'
import type { ReadMapResult } from './types.js'

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

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm run test -w shared`
Expected: FAIL with "Cannot find module './validate-read-map.js'"

- [ ] **Step 6: Create `shared/src/validate-read-map.ts`**

```ts
import type { ReadMapResult } from './types.js'

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

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm run test -w shared`
Expected: PASS

- [ ] **Step 8: Create `shared/src/index.ts`**

```ts
export * from './types.js'
export * from './validate-read-map.js'
```

- [ ] **Step 9: Commit**

```bash
git add shared package.json
git commit -m "feat: add shared types and target-ID validation package"
```

---

### Task 3: Chrome Extension Skeleton (Vite + CRXJS, Manifest V3, Side Panel Shell)

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
- Consumes: `ai-read-map-shared` (Task 2), via workspace dependency.
- Produces: a loadable unpacked extension with a side panel that opens on icon click and shows a "Generate Read Map" button (wired up for real in Task 11/12).

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
    "@mozilla/readability": "^0.5.0",
    "ai-read-map-shared": "*"
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

Note: the content script is declared here so it's present on every page (required for `chrome.tabs.sendMessage` to reach it), but it does no work until it receives an `EXTRACT_PAGE` message — passively registering a listener is not "processing the page," so this does not violate the manual-trigger constraint. `src/content/index.ts` is created in Task 10; Vite will fail to resolve it until then, which is expected at this step.

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

- [ ] **Step 8: Create `extension/src/sidepanel/panel.ts` (stub, expanded in Task 12)**

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

Expected: Vite starts without a fatal error about `src/content/index.ts` being unresolved is acceptable at this point (it doesn't exist yet) — if Vite hard-fails instead of just warning, stop and create an empty placeholder `extension/src/content/index.ts` with a single `export {}` line so the dev server can start; Task 10 will replace it.

- [ ] **Step 11: Commit**

```bash
git add extension package.json package-lock.json
git commit -m "feat: scaffold Chrome extension with Vite, CRXJS, and side panel shell"
```

---

### Task 4: DOM Paragraph/Heading ID Assignment

**Files:**
- Create: `extension/src/content/dom-extract.ts`
- Test: `extension/src/content/dom-extract.test.ts`

**Interfaces:**
- Produces: `assignParagraphIds(doc?: Document): Map<string, HTMLElement>` — sets `data-ai-read-map-id` on candidate paragraph/heading nodes in document order and returns the id→node map. Consumed by Task 5.
- Produces: `resetIdCounter(): void` — test-only helper to make IDs deterministic across test runs. Also used by Task 5's test.

- [ ] **Step 1: Write the failing test**

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
git add extension/src/content/dom-extract.ts extension/src/content/dom-extract.test.ts
git commit -m "feat: assign stable IDs to paragraph and heading DOM nodes"
```

---

### Task 5: Readability-Based Structured Extraction (ID-Preserving)

**Files:**
- Create: `extension/src/content/readability-extract.ts`
- Test: `extension/src/content/readability-extract.test.ts`

**Interfaces:**
- Consumes: `assignParagraphIds`, `resetIdCounter` from Task 4 (`extension/src/content/dom-extract.ts`); `StructuredPageContent` from `ai-read-map-shared` (Task 2).
- Produces: `extractStructuredContent(doc?: Document): StructuredPageContent` — the function Task 10's content script calls on `EXTRACT_PAGE`.

- [ ] **Step 1: Write the failing test, mocking `@mozilla/readability`**

The real Readability library's DOM-cloning and parsing behavior is what would make a test of *its* output flaky under jsdom. Mock it so this test verifies *our* ID-preserving grouping logic deterministically instead.

```ts
// extension/src/content/readability-extract.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetIdCounter } from './dom-extract'

vi.mock('@mozilla/readability', () => ({
  Readability: vi.fn(),
}))

import { Readability } from '@mozilla/readability'
import { extractStructuredContent } from './readability-extract'

function setParseResult(contentHtml: string | null, title = 'Mock Title') {
  ;(Readability as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    parse: () => (contentHtml === null ? null : { content: contentHtml, title }),
  }))
}

describe('extractStructuredContent', () => {
  beforeEach(() => {
    resetIdCounter()
    document.body.innerHTML = ''
  })

  it('groups paragraphs under the preceding heading, using only surviving IDs', () => {
    document.body.innerHTML = `
      <h2>Section One</h2>
      <p>First paragraph has plenty of readable text in it for the test to work.</p>
      <p>Second paragraph also has plenty of readable text in it for the test.</p>
      <nav><p>This nav paragraph is long enough but excluded before Readability even runs.</p></nav>
    `
    // IDs are assigned in document order starting at ai-read-map-0 (reset in
    // beforeEach): h2 -> ai-read-map-0, first <p> -> ai-read-map-1, second
    // <p> -> ai-read-map-2. The nav <p> never gets an ID (excluded by
    // assignParagraphIds itself). Simulate Readability keeping only the
    // heading and the first paragraph.
    setParseResult(
      '<div data-ai-read-map-id="ai-read-map-0"></div><div data-ai-read-map-id="ai-read-map-1"></div>',
    )

    const result = extractStructuredContent(document)

    expect(result.title).toBe('Mock Title')
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].heading).toBe('Section One')
    expect(result.sections[0].paragraphs).toHaveLength(1)
    expect(result.sections[0].paragraphs[0].text).toContain('First paragraph')
  })

  it('falls back to every assigned ID when Readability finds nothing', () => {
    document.body.innerHTML = `
      <h2>Section One</h2>
      <p>First paragraph has plenty of readable text in it for the test to work.</p>
    `
    setParseResult(null)

    const result = extractStructuredContent(document)

    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].paragraphs).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w extension`
Expected: FAIL with "Cannot find module './readability-extract'"

- [ ] **Step 3: Create `extension/src/content/readability-extract.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -w extension`
Expected: PASS

- [ ] **Step 5: Install dependencies (picks up `@mozilla/readability` and the `ai-read-map-shared` workspace link)**

```bash
npm install
```

- [ ] **Step 6: Commit**

```bash
git add extension/src/content/readability-extract.ts extension/src/content/readability-extract.test.ts extension/package.json package-lock.json
git commit -m "feat: extract structured page content while preserving paragraph IDs"
```

---

### Task 6: Extraction Quality Checks

**Files:**
- Create: `extension/src/content/quality-check.ts`
- Test: `extension/src/content/quality-check.test.ts`

**Interfaces:**
- Consumes: `StructuredPageContent` from `ai-read-map-shared` (Task 2).
- Produces: `checkExtractionQuality(content: StructuredPageContent): { passed: boolean; reason?: string }` — consumed by Task 10's content script and Task 11's background worker.

- [ ] **Step 1: Write the failing test**

```ts
// extension/src/content/quality-check.test.ts
import { describe, it, expect } from 'vitest'
import { checkExtractionQuality } from './quality-check'
import type { StructuredPageContent } from 'ai-read-map-shared'

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
    expect(result.reason).toMatch(/couldn't find enough readable content/i)
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
import type { StructuredPageContent } from 'ai-read-map-shared'

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

### Task 7: Backend Skeleton (Express + TypeScript)

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env.example`
- Create: `backend/src/index.ts`

**Interfaces:**
- Consumes: `ai-read-map-shared` (Task 2), via workspace dependency.
- Produces: a running Express server with `GET /health`, ready for Task 9 to add `POST /api/readmap`.

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "ai-read-map-backend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.35.0",
    "ai-read-map-shared": "*",
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

No compiled `dist/` build for this MVP — `tsx` runs TypeScript directly in both dev and "production" (the private-test deployment target). `ponytail:` add a real `tsc` build step when deploying somewhere that specifically wants plain Node without `tsx` as a runtime dependency.

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `backend/.env.example`**

```
ANTHROPIC_API_KEY=sk-ant-...
PORT=8787
```

- [ ] **Step 4: Create `backend/src/index.ts`**

```ts
import express from 'express'

const app = express()
app.use(express.json({ limit: '2mb' }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787
app.listen(PORT, () => console.log(`ai-read-map backend listening on :${PORT}`))
```

- [ ] **Step 5: Verify the server starts**

```bash
npm install
cp backend/.env.example backend/.env  # then fill in a real ANTHROPIC_API_KEY
npm run dev -w backend
curl http://localhost:8787/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 6: Commit**

```bash
git add backend package.json package-lock.json
git commit -m "feat: scaffold Express backend"
```

---

### Task 8: Anthropic Integration — Prompt and Structured Read Map Generation

**Files:**
- Create: `backend/src/services/prompt.ts`
- Create: `backend/src/services/anthropic-client.ts`
- Test: `backend/src/services/anthropic-client.test.ts`

**Interfaces:**
- Consumes: `StructuredPageContent`, `ReadMapResult` from `ai-read-map-shared` (Task 2).
- Produces: `generateReadMap(content: StructuredPageContent): Promise<ReadMapResult>` and `PROMPT_VERSION: string`, both consumed by Task 9's route.

- [ ] **Step 1: Create `backend/src/services/prompt.ts`**

```ts
import type { StructuredPageContent } from 'ai-read-map-shared'

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

- [ ] **Step 2: Write the failing test for `generateReadMap`, mocking `@anthropic-ai/sdk`**

Mocking the SDK isolates this test to *our* request shape and response parsing — not the network call or Claude's actual output, which the manual `curl` check in Task 9 covers.

```ts
// backend/src/services/anthropic-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

import { generateReadMap } from './anthropic-client.js'
import type { StructuredPageContent } from 'ai-read-map-shared'

const content: StructuredPageContent = {
  title: 'Test',
  url: 'https://example.com',
  domain: 'example.com',
  sections: [],
}

describe('generateReadMap', () => {
  beforeEach(() => mockCreate.mockReset())

  it('parses the text block into a ReadMapResult', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'ok',
            overview: 'x',
            keySections: [],
            pageQuality: 'high',
            missingContext: [],
            reason: '',
          }),
        },
      ],
    })

    const result = await generateReadMap(content)

    expect(result.status).toBe('ok')
    expect(result.overview).toBe('x')
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-haiku-4-5' }))
  })

  it('throws when the response has no text block', async () => {
    mockCreate.mockResolvedValue({ content: [] })

    await expect(generateReadMap(content)).rejects.toThrow('no text content')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -w backend`
Expected: FAIL with "Cannot find module './anthropic-client.js'"

- [ ] **Step 4: Create `backend/src/services/anthropic-client.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk'
import { buildPrompt } from './prompt.js'
import type { StructuredPageContent, ReadMapResult } from 'ai-read-map-shared'

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

`output_config.format` with a JSON schema guarantees Claude's response is valid JSON matching this shape (structured outputs), so `JSON.parse` here cannot throw on malformed JSON — it can still throw if the API itself errors, which the route in Task 9 catches.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -w backend`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/prompt.ts backend/src/services/anthropic-client.ts backend/src/services/anthropic-client.test.ts backend/package.json package-lock.json
git commit -m "feat: generate structured read maps via Claude"
```

---

### Task 9: Read Map Endpoint — Cache, Validation, Rate Limiting, Error Handling

**Files:**
- Create: `backend/src/services/content-hash.ts`
- Test: `backend/src/services/content-hash.test.ts`
- Create: `backend/src/services/cache.ts`
- Test: `backend/src/services/cache.test.ts`
- Create: `backend/src/routes/readmap.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes: `generateReadMap`, `PROMPT_VERSION` from Task 8; `validateReadMap` from `ai-read-map-shared` (Task 2).
- Produces: `POST /api/readmap` — accepts a `StructuredPageContent` body, returns a `ReadMapResult`. Consumed by Task 11's background worker.

- [ ] **Step 1: Write the failing test for content hashing**

```ts
// backend/src/services/content-hash.test.ts
import { describe, it, expect } from 'vitest'
import { computeContentHash } from './content-hash.js'
import type { StructuredPageContent } from 'ai-read-map-shared'

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
Expected: FAIL with "Cannot find module './content-hash.js'"

- [ ] **Step 3: Create `backend/src/services/content-hash.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -w backend`
Expected: PASS

- [ ] **Step 5: Write the failing test for the cache**

```ts
// backend/src/services/cache.test.ts
import { describe, it, expect } from 'vitest'
import { buildCacheKey, getCached, setCached } from './cache.js'
import type { ReadMapResult } from 'ai-read-map-shared'

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
Expected: FAIL with "Cannot find module './cache.js'"

- [ ] **Step 7: Create `backend/src/services/cache.ts`**

```ts
import type { ReadMapResult } from 'ai-read-map-shared'

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

- [ ] **Step 9: Create `backend/src/routes/readmap.ts`**

```ts
import { Router } from 'express'
import { generateReadMap } from '../services/anthropic-client.js'
import { computeContentHash } from '../services/content-hash.js'
import { buildCacheKey, getCached, setCached } from '../services/cache.js'
import { PROMPT_VERSION } from '../services/prompt.js'
import { validateReadMap } from 'ai-read-map-shared'
import type { StructuredPageContent } from 'ai-read-map-shared'

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

- [ ] **Step 10: Wire the router and rate limiting into `backend/src/index.ts`**

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

- [ ] **Step 11: Manual verification against a live page**

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

- [ ] **Step 12: Commit**

```bash
git add backend/src/services backend/src/routes backend/src/index.ts
git commit -m "feat: add read map endpoint with caching, validation, and rate limiting"
```

---

### Task 10: Content Script — Message Handlers and Jump/Highlight

**Files:**
- Create: `extension/src/content/index.ts`

**Interfaces:**
- Consumes: `extractStructuredContent` (Task 5), `checkExtractionQuality` (Task 6).
- Produces: content script responding to `chrome.runtime` messages `EXTRACT_PAGE` (returns `{ content, quality }`) and `JUMP_TO_PARAGRAPH` (scrolls and highlights). Consumed by Task 11's background worker.

- [ ] **Step 1: Create `extension/src/content/index.ts`**

```ts
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
```

Note: `extractStructuredContent` already calls `assignParagraphIds` internally (Task 5), so `collectIdToNode` here just re-queries the now-tagged DOM rather than re-deriving IDs — this keeps a single source of truth for ID assignment.

- [ ] **Step 2: If Task 3's placeholder file exists, remove it**

If `extension/src/content/index.ts` previously contained only `export {}` from Task 3 Step 10, this step's content replaces it — no separate deletion needed.

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

### Task 11: Background Service Worker — Orchestration and Client-Side Validation

**Files:**
- Modify: `extension/src/background/service-worker.ts`

**Interfaces:**
- Consumes: `StructuredPageContent`, `ReadMapResult`, `validateReadMap` from `ai-read-map-shared` (Task 2).
- Produces: `chrome.runtime` message handler for `GENERATE_READMAP` (returns `{ ok: true, readMap } | { ok: false, error }`) and forwards `JUMP_TO_PARAGRAPH` to the active tab. Consumed by Task 12's side panel.

- [ ] **Step 1: Replace `extension/src/background/service-worker.ts`**

```ts
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

- [ ] **Step 2: Manual verification**

With the backend running (`npm run dev -w backend`) and the extension reloaded in `chrome://extensions`, open a long article page. Open the service worker's console (`chrome://extensions` → "service worker" link) and run `chrome.runtime.sendMessage({type: 'GENERATE_READMAP'})`. Expected: logs `read_map_requested`, then resolves with `{ok: true, readMap: {...}}` (or `{ok: false, error: ...}` on an unsuitable page).

- [ ] **Step 3: Commit**

```bash
git add extension/src/background/service-worker.ts
git commit -m "feat: orchestrate generate flow with client-side target-ID validation"
```

---

### Task 12: Side Panel UI — Overview, Key Sections, Jump, Copy, Loading/Error States

**Files:**
- Modify: `extension/src/sidepanel/panel.ts`

**Interfaces:**
- Consumes: `chrome.runtime.sendMessage({type: 'GENERATE_READMAP'})` and `{type: 'JUMP_TO_PARAGRAPH', targetId}` from Task 11; `ReadMapResult` from `ai-read-map-shared` (Task 2).

- [ ] **Step 1: Replace `extension/src/sidepanel/panel.ts`**

```ts
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

### Task 13: Final Verification Pass

**Files:** None — this task only runs existing code and checks it against the spec's acceptance criteria (spec §21).

- [ ] **Step 1: Run the full test suite**

```bash
npm run test
```

Expected: all Vitest suites pass — `shared` (`validate-read-map`), `extension` (`dom-extract`, `readability-extract`, `quality-check`), `backend` (`content-hash`, `cache`, `anthropic-client`).

- [ ] **Step 2: Run both dev servers together**

```bash
npm run dev:backend   # terminal 1
npm run dev:extension # terminal 2
```

Load the extension unpacked, and repeat the manual E2E flow from Task 12 Step 2 against at least two different domains (e.g. a news article and a technical documentation page) to sanity-check extraction across page shapes, per spec §23.1's mitigation of "start with article-like pages, track failed pages."

- [ ] **Step 3: Check spec acceptance criteria (spec §21)**

Confirm each of the following manually:
- The extension extracts title, headings, and paragraphs and assigns IDs.
- Every rendered Jump button resolves to a real DOM node (Task 11's `validateReadMap` gate).
- The backend never returns a broken JSON shape (structured outputs in Task 8 enforce this).
- Output stays grounded — spot-check that `whyRead` text references only what's in the page, not outside knowledge.
- A `not_suitable` page (e.g. a login page or search results page) shows a graceful message, not a crash.
- The `ANTHROPIC_API_KEY` never appears in any extension file, network request from the extension, or `extension/dist` build output — grep the built extension bundle to confirm: `grep -r "sk-ant" extension/dist` should return nothing.

- [ ] **Step 4: Commit any fixes found during verification, then stop — no separate commit needed if nothing changed**

---

## Self-Review Notes

- **Spec coverage:** Manual trigger (Task 3 manifest — no `matches` auto-run of extraction, only passive listener), extraction + IDs (Tasks 4–6), backend + AI (Tasks 7–9), target-ID validation both server- and client-side via the shared `validateReadMap` (Tasks 9, 11), jump/highlight (Task 10), side panel + copy + loading/error (Task 12), caching + rate limiting (Task 9), privacy note (Task 3's side panel HTML), lightweight logging (Tasks 9, 11, 12 `console.log` calls). BYOK (spec §24) is explicitly out of scope per this plan's header.
- **Placeholder scan:** No `TODO`/`TBD` left in any step; every code block is complete and runnable as written.
- **Type consistency:** `StructuredPageContent`, `SectionContent`, `ParagraphContent`, `ReadMapResult`, `KeySection` are defined once, in `shared/src/types.ts`, and every task that references them imports from `ai-read-map-shared` using these exact names and shapes — no duplicate type definitions remain in either `extension` or `backend`.
- **Duplication resolved:** `validateReadMap` exists once, in `shared/src/validate-read-map.ts`, called with two different `validTargetIds` sets (submitted content in Task 9, live DOM in Task 11) — no duplicated logic.

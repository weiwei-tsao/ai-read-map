# Side Panel Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the "ai-read-map theme" design spec (warm paper neutrals, serif-for-reading / sans-for-chrome / mono-for-metadata, copper accent, borders-over-shadows) to the extension's side panel.

**Architecture:** Introduce a token layer (`tokens.css`) and self-hosted fonts (`fonts.css`, via `@fontsource`) that `index.html` links ahead of `panel.css`. Rewrite `panel.css` to consume the tokens. Add class hooks to the static markup in `index.html` and to the DOM elements `panel.ts` builds dynamically (section cards, quality chip, buttons). No new architecture — this stays entirely inside `extension/src/sidepanel/`, per `architecture.md`'s "UI only" boundary for that directory.

**Tech Stack:** Plain CSS custom properties (no preprocessor, no CSS-in-JS), `@fontsource/instrument-sans` `@fontsource/source-serif-4` `@fontsource/ibm-plex-mono` for self-hosted fonts (MV3 CSP blocks remote font/style loading, so Google Fonts CDN links are not an option), Vitest + jsdom (already configured) for the one behavioral test.

## Global Constraints

- Theme tokens live in `extension/src/sidepanel/tokens.css` as `:root` custom properties — colors, fonts, a 4px-base spacing scale, two border radii tiers, two shadow tiers. Exact values are listed in Task 1.
- Serif (`Source Serif 4`) is used **only** for reading content (the AI-generated overview paragraph). Sans (`Instrument Sans`) is used for all interface chrome (buttons, labels, section titles). Mono (`IBM Plex Mono`) is used **only** for small-caps eyebrow/metadata labels. Never mix these roles.
- Exactly one accent color drives interactive elements: `--accent` (`#996136`, copper) — used on the primary "Generate" button. `--accent-sage` (`#6B8F71`) is used **only** to mark the page-quality chip when quality is `"high"`.
  - **Assumption called out:** the source design spec's color swatches were an unrendered template (`{{ c.bg }}` placeholders never filled in), so no sage hex was actually specified anywhere in the spec text. `#6B8F71` is this plan's own pick, chosen to harmonize with the copper/paper palette. If a real value shows up later, it's a one-line edit to `--accent-sage` in `tokens.css` — nothing else changes.
  - The spec's 36px serif hero size is a marketing-page display size, not appropriate for a ~360px-wide Chrome side panel header — Task 1/5 scale the panel's own `<h1>` down to 20px while keeping serif + 600 weight + tight tracking, noted inline where it's applied.
- Borders over shadows: `.section-card` gets a 1px `--border` at rest; `--shadow-card` applies **only** on `:hover`/`:focus-within`, never at rest.
- No new workspace dependencies outside `extension` — `shared` and `backend` are untouched by this plan.

---

### Task 1: Design tokens

**Files:**
- Create: `extension/src/sidepanel/tokens.css`

**Interfaces:**
- Produces: CSS custom properties consumed by Task 5 (`panel.css`) and Task 3 (`index.html` link order) — `--ink`, `--ink-secondary`, `--ink-muted`, `--ink-faint`, `--paper`, `--surface`, `--border`, `--accent`, `--accent-sage`, `--font-serif`, `--font-sans`, `--font-mono`, `--space-1` through `--space-7`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--shadow-card`, `--shadow-modal`.

- [ ] **Step 1: Create the token file**

```css
:root {
  /* color */
  --ink: #26221C;
  --ink-secondary: #3B362E;
  --ink-muted: #6F675B;
  --ink-faint: #9A9184;
  --paper: #F7F4EE;
  --surface: #FFFFFF;
  --border: #E7E1D5;
  --accent: #996136;
  --accent-sage: #6B8F71;

  /* type */
  --font-serif: 'Source Serif 4', Georgia, serif;
  --font-sans: 'Instrument Sans', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;

  /* space (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;

  /* shape */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;

  /* elevation — hover/focus only, per "borders over shadows" */
  --shadow-card: 0 1px 2px rgba(38, 34, 28, .06), 0 4px 16px rgba(38, 34, 28, .05);
  --shadow-modal: 0 2px 4px rgba(38, 34, 28, .08), 0 12px 32px rgba(38, 34, 28, .10);
}
```

- [ ] **Step 2: Commit**

```bash
git add extension/src/sidepanel/tokens.css
git commit -m "feat(extension): add sidepanel design tokens"
```

---

### Task 2: Self-hosted fonts

**Files:**
- Modify: `extension/package.json`
- Create: `extension/src/sidepanel/fonts.css`

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: `extension/src/sidepanel/fonts.css`, linked by Task 3's `index.html`. Registers `@font-face` rules for `Instrument Sans` (400, 600), `Source Serif 4` (400, 600), `IBM Plex Mono` (400) — matching the exact weights `tokens.css`'s `--font-*` families are used at in Task 5.

- [ ] **Step 1: Add font packages**

```bash
npm install --workspace extension @fontsource/instrument-sans@5.2.8 @fontsource/source-serif-4@5.2.9 @fontsource/ibm-plex-mono@5.2.7
```

Expected: `extension/package.json` gains the three entries under `dependencies`, `package-lock.json` updates.

- [ ] **Step 2: Create the font-loading stylesheet**

```css
@import '@fontsource/instrument-sans/400.css';
@import '@fontsource/instrument-sans/600.css';
@import '@fontsource/source-serif-4/400.css';
@import '@fontsource/source-serif-4/600.css';
@import '@fontsource/ibm-plex-mono/400.css';
```

- [ ] **Step 3: Verify the build resolves the font imports**

Run: `npm run build -w extension`
Expected: build succeeds with no "failed to resolve import" errors; `extension/dist/` contains bundled `.woff2` files.

- [ ] **Step 4: Commit**

```bash
git add extension/package.json package-lock.json extension/src/sidepanel/fonts.css
git commit -m "feat(extension): self-host sidepanel theme fonts"
```

---

### Task 3: Wire tokens/fonts into the panel shell

**Files:**
- Modify: `extension/src/sidepanel/index.html`

**Interfaces:**
- Consumes: `extension/src/sidepanel/tokens.css` (Task 1), `extension/src/sidepanel/fonts.css` (Task 2).
- Produces: class hooks `app`, `app-title`, `btn btn--primary`, `privacy` for Task 5's `panel.css` to style.

- [ ] **Step 1: Update the HTML**

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AI Read Map</title>
  <link rel="stylesheet" href="./tokens.css" />
  <link rel="stylesheet" href="./fonts.css" />
  <link rel="stylesheet" href="./panel.css" />
</head>
<body>
  <div id="app" class="app">
    <h1 class="app-title">AI Read Map</h1>
    <button id="generate-btn" class="btn btn--primary">Generate Read Map</button>
    <div id="status"></div>
    <div id="result"></div>
    <details id="privacy-note" class="privacy">
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

- [ ] **Step 2: Commit**

```bash
git add extension/src/sidepanel/index.html
git commit -m "feat(extension): link theme tokens and fonts into sidepanel shell"
```

---

### Task 4: Class hooks and quality chip in `panel.ts` (TDD)

**Files:**
- Modify: `extension/src/sidepanel/panel.ts`
- Test: `extension/src/sidepanel/panel.test.ts`

**Interfaces:**
- Consumes: `ReadMapResult` from `ai-read-map-shared` (`status`, `overview`, `keySections: KeySection[]`, `pageQuality: 'high' | 'medium' | 'low'`, `missingContext`, `reason`).
- Produces: exported `renderReadMap(readMap: ReadMapResult, title: string, url: string): void` (previously unexported — needed so the test can call it directly without going through `chrome.runtime.sendMessage`). DOM output gains classes `overview`, `eyebrow`, `section-list`, `section-card`, `section-label`, `section-why`, `chip chip--${pageQuality}`, `btn btn--ghost`, `btn btn--secondary` — consumed by Task 5's `panel.css`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { ReadMapResult } from 'ai-read-map-shared'

function baseResult(overrides: Partial<ReadMapResult> = {}): ReadMapResult {
  return {
    status: 'ok',
    overview: 'This page explains X.',
    keySections: [
      { label: 'Intro', whyRead: 'Sets up the problem', targetId: 'p1' },
      { label: 'Method', whyRead: 'Describes the approach', targetId: 'p2' },
    ],
    pageQuality: 'high',
    missingContext: [],
    reason: '',
    ...overrides,
  }
}

let renderReadMap: typeof import('./panel').renderReadMap

beforeAll(async () => {
  document.body.innerHTML = `
    <button id="generate-btn"></button>
    <div id="status"></div>
    <div id="result"></div>
  `
  ;({ renderReadMap } = await import('./panel'))
})

beforeEach(() => {
  document.querySelector('#result')!.innerHTML = ''
})

describe('renderReadMap', () => {
  it('renders a sage-variant chip for high page quality', () => {
    renderReadMap(baseResult({ pageQuality: 'high' }), 'Title', 'https://example.com')
    const chip = document.querySelector('#result .chip')
    expect(chip?.classList.contains('chip--high')).toBe(true)
  })

  it('renders a neutral-variant chip for medium page quality', () => {
    renderReadMap(baseResult({ pageQuality: 'medium' }), 'Title', 'https://example.com')
    const chip = document.querySelector('#result .chip')
    expect(chip?.classList.contains('chip--medium')).toBe(true)
    expect(chip?.classList.contains('chip--high')).toBe(false)
  })

  it('renders one section-card per key section', () => {
    renderReadMap(baseResult(), 'Title', 'https://example.com')
    expect(document.querySelectorAll('#result .section-card').length).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npx vitest run src/sidepanel/panel.test.ts`
Expected: FAIL — `renderReadMap` is not exported from `./panel` (or the module throws because `#generate-btn`/`#status`/`#result` aren't found — either way, a clear failure, not a pass).

- [ ] **Step 3: Update `panel.ts`**

```typescript
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

    const jumpBtn = document.createElement('button')
    jumpBtn.className = 'btn btn--ghost'
    jumpBtn.textContent = 'Jump'
    jumpBtn.addEventListener('click', () => {
      console.log('[ai-read-map] jump_clicked')
      chrome.runtime.sendMessage({ type: 'JUMP_TO_PARAGRAPH', targetId: section.targetId })
    })
    item.appendChild(jumpBtn)

    list.appendChild(item)
  }
  resultEl.appendChild(list)

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

async function copyReadMap(readMap: ReadMapResult, title: string, url: string): Promise<void> {
  console.log('[ai-read-map] copy_clicked')
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && npx vitest run src/sidepanel/panel.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add extension/src/sidepanel/panel.ts extension/src/sidepanel/panel.test.ts
git commit -m "feat(extension): add sidepanel theme class hooks and quality chip"
```

---

### Task 5: Theme `panel.css`

**Files:**
- Modify: `extension/src/sidepanel/panel.css`

**Interfaces:**
- Consumes: tokens from Task 1, class names produced by Task 3 (`app`, `app-title`, `btn btn--primary`, `privacy`) and Task 4 (`overview`, `eyebrow`, `section-list`, `section-card`, `section-label`, `section-why`, `chip`, `chip--high`, `chip--medium`, `chip--low`, `btn btn--ghost`, `btn btn--secondary`), plus the pre-existing `#status.loading` / `#status.error` classes set by `setStatus` in `panel.ts`.
- Produces: nothing consumed by later tasks — this is the leaf of the dependency chain.

- [ ] **Step 1: Replace `panel.css`**

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: var(--space-5) var(--space-4);
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 13.5px;
  line-height: 1.5;
}

.app-title {
  font-family: var(--font-serif);
  font-weight: 600;
  font-size: 20px;
  letter-spacing: -0.01em;
  margin: 0 0 var(--space-4);
}

.btn {
  font-family: var(--font-sans);
  font-weight: 500;
  font-size: 13.5px;
  letter-spacing: -0.01em;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
}

.btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--surface);
}

.btn--ghost {
  background: transparent;
  padding: var(--space-1) var(--space-2);
  font-size: 12.5px;
}

.btn--secondary {
  margin-top: var(--space-4);
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

#status {
  margin: var(--space-3) 0;
  font-size: 12.5px;
}

#status.loading {
  color: var(--ink-muted);
}

#status.error {
  color: #b00020;
}

.overview {
  font-family: var(--font-serif);
  font-size: 16px;
  line-height: 1.7;
  color: var(--ink-secondary);
  margin: 0 0 var(--space-5);
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin-bottom: var(--space-2);
}

.section-list {
  list-style: none;
  margin: 0 0 var(--space-5);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  transition: box-shadow 0.15s ease;
}

.section-card:hover,
.section-card:focus-within {
  box-shadow: var(--shadow-card);
}

.section-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: var(--space-1);
}

.section-why {
  margin: 0 0 var(--space-2);
  font-size: 12.5px;
  color: var(--ink-muted);
}

.chip {
  display: inline-block;
  font-size: 12px;
  font-weight: 500;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  color: var(--ink-muted);
  background: var(--paper);
}

.chip--high {
  color: var(--accent-sage);
  border-color: var(--accent-sage);
  background: color-mix(in oklab, var(--accent-sage) 12%, var(--surface));
}

.privacy {
  margin-top: var(--space-5);
  font-size: 12px;
  color: var(--ink-muted);
}

.privacy summary {
  cursor: pointer;
  font-family: var(--font-mono);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-size: 11px;
}
```

- [ ] **Step 2: Commit**

```bash
git add extension/src/sidepanel/panel.css
git commit -m "feat(extension): theme sidepanel with paper/copper design tokens"
```

---

### Task 6: Full verification

**Files:** none (verification only)

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS for `shared`, `extension` (including the new `panel.test.ts`), and `backend`.

- [ ] **Step 2: Typecheck the extension workspace**

Run: `npm run typecheck -w extension`
Expected: no errors.

- [ ] **Step 3: Build the extension**

Run: `npm run build:extension`
Expected: build succeeds; `extension/dist/` contains the bundled fonts and updated CSS.

- [ ] **Step 4: Manually load and eyeball the panel**

Load `extension/dist` as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked), open the side panel on any article page, click "Generate Read Map", and confirm: paper background, serif overview paragraph, copper primary button, bordered section cards with a hover shadow (not a resting one), and a sage-tinted chip only when page quality is "high".

- [ ] **Step 5: Commit any fixups found during manual check**

If Step 4 turns up an issue, fix it in the relevant file from Tasks 1–5 and commit:

```bash
git add -A
git commit -m "fix(extension): sidepanel theme polish from manual QA"
```

(Skip this step if nothing needed fixing.)

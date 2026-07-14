# Architecture

## Module boundaries

- `shared/` — types (`types.ts`) and validation (`validate-read-map.ts`) only. No backend or extension code may duplicate these; both import from `ai-read-map-shared`.
- `backend/src/routes/` — HTTP layer only (request parsing, response shaping). Business logic lives in `backend/src/services/`.
- `backend/src/services/` — Anthropic calls, caching, content hashing, prompt construction. Must not import Express types.
- `extension/src/content/` — runs in the page context (content script). Not declared in the manifest; the background worker injects it on demand via `chrome.scripting.executeScript` (`activeTab`) before sending `EXTRACT_PAGE`.
- `extension/src/background/` — service worker, coordinates messaging between content script, side panel, and backend.
- `extension/src/sidepanel/` — UI only; no direct Anthropic API calls, always goes through the backend.

## Data flow

1. User triggers extraction → `extension/src/content/index.ts` (dispatches to `readability-extract.ts` / `dom-extract.ts`, gated by `quality-check.ts`)
2. Content script → background service worker → side panel
3. Side panel/background → `POST` to backend `backend/src/routes/readmap.ts`
4. Backend: `content-hash.ts` hashes the page → `cache.ts` checked → `anthropic-client.ts` called on a miss → response validated via `ai-read-map-shared`'s `validate-read-map.ts`
5. Response flows back to the side panel for rendering

## Invariants

- Cache is a single in-process `Map` (`backend/src/services/cache.ts`) — do not assume it survives a restart or is shared across instances.
- Cache key includes `promptVersion` (`services/prompt.ts`) — bump it when the prompt changes so stale cached results aren't served.
- `MAX_CONTENT_CHARS` (50,000) in `routes/readmap.ts` truncates/limits page content sent to Anthropic — respect this boundary when changing extraction.
- Extension permissions are deliberately narrow: `activeTab` + on-demand `chrome.scripting.executeScript` injection, no static `content_scripts` (issue #5). Don't reintroduce broad host matches for normal product flows.

Related: [api.md](./api.md) · [testing.md](./testing.md)

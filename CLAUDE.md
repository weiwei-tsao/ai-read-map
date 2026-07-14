# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

Node.js monorepo (npm workspaces) · TypeScript (strict) · Chrome extension (Manifest V3, Vite + @crxjs) · Express backend · Anthropic SDK · Vitest

## Project Structure

- `shared/` — types and validation (`ai-read-map-shared`), consumed by both `backend` and `extension`
- `backend/` — Express API server; calls the Anthropic API to generate a "read map," caches results in-memory
- `extension/` — Chrome MV3 extension: content script extracts page content, background service worker coordinates, side panel renders the read map

## Dev Commands

```bash
npm run dev:extension       # vite dev server for the extension
npm run dev:backend         # tsx watch for the backend (loads backend/.env)
npm run build:extension     # vite build
npm test                    # runs shared, extension, backend test suites in order
npm run typecheck -w <workspace>   # tsc --noEmit, per workspace (backend/extension/shared)
```

## Architecture Notes

Data flow: extension content script extracts page content → side panel/background sends it to the backend (`POST` to `backend/src/routes/readmap.ts`) → backend hashes content, checks the in-memory cache (`services/cache.ts`), calls the Anthropic API (`services/anthropic-client.ts`) if uncached, validates the result against the shared schema (`ai-read-map-shared`), returns it.

The in-memory cache is single-process and does not survive restarts — see the `ponytail:` note in `backend/src/services/cache.ts`.

The extension uses `activeTab` plus `chrome.scripting.executeScript` to inject the content script only after the user triggers read-map generation from the side panel. Keep host permissions narrow; broad `http://*/*` or `https://*/*` content-script matches should not be reintroduced for normal product flows.

@.claude/rules/git.md
@.claude/rules/architecture.md
@.claude/rules/api.md
@.claude/rules/testing.md

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`weiwei-tsao/ai-read-map`), using the `gh` CLI. External PRs are not treated as a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix) — no repo-specific overrides. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

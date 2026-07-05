---
description: Structured bug diagnosis and resolution — no code changes until root cause is confirmed
---

# Structured Bug Fix

Phased approach: diagnose fully before touching any code.

## Phase 1: Gather Context (read-only)

Ask for: error message or symptom, reproduction steps, suspected area (extension/backend/shared).
Skip questions already answered by the user.

## Phase 2: Trace the Full Data Flow

Request-to-response layers for this project:

```
extension/src/content/index.ts (extraction, gated by quality-check.ts)
  → extension background/service-worker.ts
  → extension sidepanel/panel.ts
  → POST backend/src/routes/readmap.ts
  → backend/src/services/content-hash.ts, cache.ts, anthropic-client.ts
  → ai-read-map-shared validate-read-map.ts
  → response back to side panel
```

Cross-cutting concerns to always check:

- Cache key correctness — `buildCacheKey` includes `PROMPT_VERSION`; a stale cache entry can mask a real bug (`backend/src/services/cache.ts`)
- `MAX_CONTENT_CHARS` truncation in `routes/readmap.ts` — could be the actual cause of a "missing content" symptom
- Extension manifest permissions/host matches — a symptom that looks like a logic bug can be a permissions gap (`extension/src/manifest.ts`)
- Whether the failure is in the content script (page context) vs. background vs. side panel — these are separate execution contexts with separate message-passing boundaries

Read files at each relevant layer. Do not assume — verify each hop.

## Phase 3: Present Diagnosis — Wait for Confirmation

Before writing a single line of code, present:

  Root cause: <one sentence>
  Evidence: <file:line — what it shows> (list 2–4)
  Files that need changes: <path — what and why> (numbered list)

  No code has been changed yet. Confirm to proceed.

## Phase 4: Implement the Fix

Apply changes to ALL identified files, not just the most obvious one.

Checklist before marking done:

- [ ] Every file from the diagnosis addressed
- [ ] No hardcoded secrets or env var fallbacks
- [ ] No new `any` types introduced
- [ ] If touching `routes/readmap.ts` or services: response still matches `ReadMapResult` shape on every code path (including error paths)

## Phase 5: Verify

```bash
npm run typecheck -w <workspace>   # for every workspace touched
npm test                           # shared, extension, backend
```

If any check fails, fix before closing.

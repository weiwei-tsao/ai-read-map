# API Conventions

Single-endpoint backend today (`backend/src/routes/readmap.ts`); follow these patterns as more endpoints are added.

## Endpoint shape

- `POST /readmap` — body is `StructuredPageContent` (from `ai-read-map-shared`)
- Response is always a `ReadMapResult`-shaped JSON object, even on error — callers can rely on `status`/`overview`/`keySections`/`pageQuality`/`missingContext` always being present. Don't return a bare error object.

## Status codes in use

- `200` — success (cached or freshly generated)
- `400` — invalid/malformed request body (fails `isValidSections`)
- `413` — content exceeds `MAX_CONTENT_CHARS` (50,000)
- `502` — Anthropic call or validation failed (`generateReadMap` / `validateReadMap` threw)

## Auth

None. No API key or session check on this endpoint — don't assume one exists when adding new routes; add explicit auth if a new endpoint needs it.

## Logging

Structured `console.log`/`console.error` with an `[ai-read-map]` prefix and an event name (`cache_hit`, `cache_miss`, `read_map_success`, `read_map_failed`) plus a small context object. Follow this pattern for new routes rather than free-form log strings.

Related: [architecture.md](./architecture.md)

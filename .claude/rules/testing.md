# Testing Conventions

Vitest across all three workspaces (`shared`, `extension`, `backend`).

## What to test

- Pure logic and validation (`shared/src/validate-read-map.ts`), content extraction/quality gating (`extension/src/content/`), caching/hashing/Anthropic-calling services (`backend/src/services/`)
- Skip trivial pass-throughs and one-line wrappers

## File naming and location

Co-located: `<name>.ts` next to `<name>.test.ts` in the same directory (e.g. `cache.ts` / `cache.test.ts`).

## Mock strategy

- Mock the Anthropic SDK at the module boundary, not the service function — see `backend/src/services/anthropic-client.test.ts` (`vi.mock('@anthropic-ai/sdk', ...)` with `vi.hoisted` for the mock handle, reset in `beforeEach`).
- The in-memory cache (`cache.ts`) is real in tests, not mocked — it's cheap and process-local.
- Extension content-script tests use `jsdom` to simulate the page DOM rather than mocking `document`.

## Running tests

```bash
npm test                        # all three workspaces, in order: shared, extension, backend
npm run test -w backend         # single workspace
npx vitest run <path/to/file>   # single file, run from that workspace's directory
```

Related: [architecture.md](./architecture.md)

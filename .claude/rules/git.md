# Git Conventions

## Commit messages

Conventional Commits: `type(scope): description`

- Types: feat · fix · refactor · docs · style · chore · test · perf · revert
- Scopes: `backend` · `extension` · `shared` (or omit for repo-wide changes)
- Description: ≤12 words, imperative mood, lowercase, no trailing period
- Breaking change: `feat(backend)!: remove field from response`

## Branch naming

`feat/<slug>` · `fix/<slug>` · `chore/<slug>`

## Never commit

- `.env*` (backend loads secrets via `--env-file=.env`)
- `node_modules/`, `dist/`, build output
- Anthropic API keys or any secret value

## Before opening a PR

- [ ] `npm test` passes (shared, extension, backend)
- [ ] `npm run typecheck -w <workspace>` passes for every workspace touched
- [ ] No stray debug `console.log`/`console.error` in `backend/src` or `extension/src` beyond the structured `[ai-read-map]` logging pattern (see [api.md](./api.md#logging))
- [ ] No hardcoded values that should be env vars or config

Related: [architecture.md](./architecture.md)

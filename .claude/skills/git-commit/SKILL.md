---
description: Run quality checks, draft a Conventional Commits message with ≤12-word description, and commit staged changes.
---

## 1. Quality Gate

Run in parallel — stop and report if any fail. (No repo-wide lint/format tooling exists — typecheck and tests are the gate.)

```bash
npm run typecheck -w backend
npm run typecheck -w extension
npm run typecheck -w shared
npm test
```

## 2. Inspect Staged Changes

```bash
git status
git diff --staged
```

If nothing is staged: stop and offer to show `git diff`.
Unstage and warn if staged files include: `.env*`, `node_modules/`, `dist/`, or any file containing an Anthropic API key.

## 3. Draft Commit Message

Format: `type(scope): description`

Types: feat · fix · refactor · docs · style · chore · test · perf · revert
Scopes: `backend` · `extension` · `shared` (omit for repo-wide changes)
Rules: ≤12 words after the colon, imperative mood, lowercase, no trailing period.

Breaking change: append `!` before colon — `feat(backend)!: remove field from response`

## 4. Commit

Show the draft to the user and get confirmation. Then:

```bash
git commit -m "$(cat <<'EOF'
type(scope): description
EOF
)"
```

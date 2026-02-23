# Development Guide

## Branch Strategy

- Main branch: `main`
- Feature branches: `codex/<short-topic>`
- Keep PRs small and scoped to one concern when possible.
- No direct push to `main` for feature work.

## Coding Conventions

- TypeScript `strict` mode must pass.
- Keep identity keys normalized:
  - `x_handle`: lowercase ASCII (`[a-z0-9_]{1,15}`)
  - `slug`: lowercase ASCII + underscore (`[a-z0-9_]{3,32}`)
- Keep display text sanitized via Unicode normalization and control-char removal.
- API validation must reject malformed input with 4xx instead of silent fallback.
- For DB changes:
  - update `src/db/schema.ts`
  - add a migration SQL file under `drizzle/`
  - run local migration and typecheck before PR

## Release Safety Checks

1. `pnpm typecheck`
2. `pnpm db:migrate:local`
3. `pnpm dev` then smoke test:
   - `/`
   - `/tag/{tag}`
   - `/p/{handle}/{slug}`
   - `/claim`
   - `/sitemap.xml`
   - `/robots.txt`
   - `POST /submit/url` (LPフォームで検証)
4. Trigger scheduled handler locally:
   - `curl http://localhost:8787/cdn-cgi/handler/scheduled`

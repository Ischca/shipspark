# ShipSpark

## Product Direction

A casual release board for X hashtag posts.
Makers post with a campaign hashtag, and releases are listed and searchable on the site.

This project does **not** target Product Hunt submission workflows.
This project does **not** include landing page auto-generation in MVP.

## MVP Direction

- Primary path: hashtag-based auto-listing from X posts
- Ingestion strategy: X API polling worker (15-minute interval, 7-day backfill)
- Scheduler/runtime: Cloudflare Cron Trigger + Worker
- Temporary required hashtags:
  - `#ShipSpark`
  - `#ss_{slug}` (`snake_case`)
- Secondary hashtags: metadata only (not ingest filters)
- Core pages: feed and product detail
- Trust layer: maker claim flow for official vs user post separation
- Backup path: manual post URL submit from LP when auto-ingestion misses
- Comments: redirect to X thread only (no site-native comments in MVP)
- Identity key: `x_handle + slug` (handle normalized to lowercase)
- Infra priority: minimize cost (Hono + Cloudflare D1 + Workers/Cron)
- Rendering: SSR required for SEO pages
- Package manager / DB layer: pnpm + Drizzle ORM

## Route Strategy (SEO)

- `/`: landing + latest feed
- `/tag/{tag}`: tag feed
- `/p/{handle}/{slug}`: product detail (canonical SEO page)

## Project Docs

- Product brief: `docs/PRODUCT_BRIEF.md`
- Product spec summary: `docs/PRODUCT_SPEC_V0.1.md`
- Initial tasks: `docs/TODO.md`
- Development guide: `docs/DEVELOPMENT_GUIDE.md`

## Dev Setup

1. Install deps: `pnpm install`
2. Update `wrangler.toml` `database_id` with actual D1 ID
3. Set secrets:
   - `wrangler secret put X_BEARER_TOKEN`
   - `wrangler secret put SESSION_SECRET`
   - optional: `wrangler secret put INTERNAL_INGEST_TOKEN`
4. Apply local migrations: `pnpm db:migrate:local`
5. Apply remote migrations (after `wrangler login`): `pnpm db:migrate:prod`
6. Start local server: `pnpm dev`

## Implemented Scaffold

- Hono SSR routes: `/`, `/tag/:tag`, `/p/:handle/:slug`
- Claim routes: `/claim`, `/claim/start`, `/claim/verify`
- Fallback route: `POST /submit/url` (LP投稿URL登録)
- SEO files: `/sitemap.xml`, `/robots.txt`
- API:
  - `POST /api/ingest` (internal token required)
  - `POST /api/products/:productId/vote`
  - `POST /api/products/:productId/click`
- D1/Drizzle schema + initial SQL migration
- Cloudflare Cron trigger (15m) + X API polling implementation
- LP投稿ダイアログ（3モード、編集可、Copy、Post on X）
- CI baseline: GitHub Actions `pnpm typecheck`

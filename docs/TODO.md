# Initial TODO

## Product Definition

- [x] Rewrite product scope to hashtag-based release board.
- [x] Remove Product Hunt workflow and LP auto-generation assumptions.
- [x] Set required hashtags: `#ShipSpark` and `#ss_{slug}`.
- [x] Set manual URL submit policy: LP公開フォーム fallback.
- [x] Set secondary hashtag policy: metadata only.
- [x] Set comment policy: X thread redirect only in MVP.
- [x] Set claim policy: no email auth in MVP.
- [x] Set uniqueness policy: `x_handle + slug`.
- [x] Freeze MVP scope with priority (Must/Should/Later).
- [x] Finalize campaign hashtag naming (`#ShipSpark`).

## Technical Decisions

- [x] Decide hashtag ingestion strategy: X API polling worker.
- [x] Set polling interval: 15 minutes.
- [x] Set backfill window: 7 days.
- [x] Define URL/routing pattern for composite key (`x_handle + slug`).
- [x] Finalize framework: Hono.
- [x] Confirm data store: Cloudflare D1.
- [x] Confirm worker/scheduler stack: Cloudflare Cron Trigger + Worker.
- [x] Define environment strategy: local + prod.
- [x] Select package manager: pnpm.
- [x] Select DB access layer: Drizzle ORM.
- [x] Require SSR for SEO-critical pages.

## Delivery Setup

- [x] Define parser rules for `hashtag-only`, `short`, `full` post modes.
- [x] Design DB schema for `products`, `launches`, `claims`, `votes`, `reports`.
- [x] Remove admin auth and use claim-based ownership flow.
- [x] Implement handle normalization (lowercase canonical) and Unicode safety filters for display text.
- [x] Implement claim expiry window (24h) and cleanup job.
- [x] Implement vote anti-abuse constraint (cookie/IP/User-Agent daily limit).
- [x] Implement `Hot` score weighting (`upvote:click = 2:1`).
- [x] Set coding conventions and branch strategy.
- [x] Add CI baseline (lint/test/build).
- [x] Scaffold first runnable app.

## Immediate Next Action

- [x] Build `/` page first.
- [x] Build `/tag/{tag}` page second.
- [x] Build `/p/{handle}/{slug}` page third.
- [x] Build post dialog (3 modes) and X intent link generation.
- [x] Enforce slug hashtag validation (`#ss_{slug}`) in submission/ingest path.
- [x] Build ingest endpoint and first worker path for auto-listing.
- [x] Add manual URL submit as fallback path.

# Product Brief: ShipSpark

## 1. Product Name

- Product name: `ShipSpark`

## 2. Concept

- A casual release board where makers post on X with a specific hashtag and entries are listed on the site.
- Positioning: lighter than Product Hunt, lower friction, X-first publishing.

## 3. Problem

- New products get announced on X but quickly disappear in the timeline.
- Existing launch platforms can feel too heavy for fast-moving AI builders.
- Readers cannot easily browse, search, and revisit hashtag-based releases.

## 4. Target Users

- Makers building and shipping AI products rapidly.
- Builders who can create products but struggle with announcement continuity.
- Readers who want a browsable feed of newly released tools.

## 5. Core Value Proposition

- Post once on X with a hashtag and get discoverability in a structured release list.
- Keep X as the primary publishing surface while adding archive/search/thread context.
- Distinguish official maker posts from user-generated mentions and feedback.

## 6. Core User Stories

### Maker

1. Open the site and click `Post on X`.
2. Pick a template mode (`hashtag-only`, `short`, `full`) and post via X intent.
3. The post appears in the hashtag feed automatically (MVP target).
4. Complete claim flow to mark account as official maker.

### Reader

1. Open tag feed and browse new or hot releases.
2. Open product page and view official launch post plus related posts.
3. Jump to X thread for discussion.

## 7. MVP Scope

### Must

- Hashtag-based ingestion pipeline for X posts (primary path).
- Ingestion source strategy for MVP: X API polling.
- Polling interval: every 15 minutes.
- Backfill window: last 7 days.
- Worker scheduling/execute: Cloudflare Cron Trigger + Worker (cost-first).
- Required hashtags for listed posts:
  - Campaign hashtag (v1 fixed): `#ShipSpark`
  - Product slug hashtag (required): `#ss_{slug}` (`snake_case`, 3-32 chars)
- Secondary hashtags are stored as metadata only (not ingestion criteria in MVP).
- Tag feed page with sort: `New` and `Hot`.
- Product detail page with embedded official post and related posts.
- Post dialog with 3 modes (`hashtag-only` default, `short`, `full`) and X intent integration.
- Maker claim flow (handle + claim post URL verification, no email in MVP) to separate official vs user posts.
- Basic parser for hashtag keys and optional template fields (`name`, `url`, optional metadata).
- Basic moderation controls (rate limit, report, blocklist).
- Fallback path: manual post URL submit from LP when ingestion misses a post.
- Comment experience in MVP: redirect to X thread only (no site-native comments).
- SEO-first SSR pages for feed and product detail (server-rendered metadata).

### Should

- Claim verification UI and state management polish (error handling and guidance text).
- Basic operations runbook and alert baseline for polling failures.

### Later

- Full reply/quote ingestion from X conversation graph.
- Team collaboration and role management.
- Billing and paid plans.

## 8. Out of Scope (MVP)

- Product Hunt submission workflow.
- Landing page auto-generation.
- Advanced team collaboration and role management.
- Full reply/quote ingestion from X conversation graph.
- Billing and paid plans.

## 9. Success Metrics

- Time from X post to visible listing: within 60 minutes (MVP target).
- Auto-ingestion success rate for tagged posts: over 80% (tracked daily).
- Share of posts with identified official maker status: over 50% for active products.

## 10. Open Decisions

- Initial anti-spam thresholds and moderation policy.
- Production operations details (monitoring/alerts/cost guardrails).

## 11. Data and Ranking Rules

- Product uniqueness key: `x_handle + slug` (composite unique).
- `New` sort: latest ingestion/submit time.
- `Hot` sort: site upvotes + click score (weighted).
- Hot weighting in MVP: `upvote:click = 2:1`.
- Upvote rule in MVP: one vote per cookie/IP/User-Agent per day.
- Click score events in MVP: detail page view + external link click (homepage/repo).
- Claim code expiry: 24 hours.
- Handle normalization: lowercase canonical value for identity key.
- Multilingual policy: keep identity keys ASCII-safe; allow Unicode for display name fields with normalization and control-character filtering.

## 12. Build Order

- First screen order: `/` -> `/tag/{tag}` -> `/p/{handle}/{slug}`.

## 13. Implementation Stack (Confirmed)

- Web framework: Hono.
- Data store: Cloudflare D1.
- Scheduler/runtime: Cloudflare Cron Trigger + Worker.
- Rendering: SSR required for SEO-critical pages.
- Package manager: pnpm.
- DB access layer: Drizzle ORM.
- Environment strategy: local + prod (no staging in MVP).

## 14. Milestones

1. Finalize spec and ingestion assumptions
2. Implement feed + product pages + ingest worker
3. Implement claim flow and official/user separation
4. Add ranking/moderation baseline
5. Launch beta with one campaign hashtag

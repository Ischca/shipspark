# Product Spec v0.1: Hashtag Release Board

## 1. Positioning

- Build a casual release board that starts from X hashtag posts.
- Lower friction than Product Hunt style submission flows.
- Preserve discoverability after timeline posts are buried.

## 2. MVP Product Goal

- Target from day one: if a post includes the campaign hashtag, it is listed automatically.
- Keep a fallback `submit URL` path for reliability gaps (LP公開フォームで対応).
- Ingestion strategy in MVP: X API polling worker.
- Polling interval: every 15 minutes.
- Backfill window: last 7 days.
- Worker scheduling/execute: Cloudflare Cron Trigger + Worker.
- Required hashtags:
  - `#ShipSpark` (campaign)
  - `#ss_{slug}` (product identifier, required)
- Secondary hashtags are metadata only in MVP (not ingestion filters).

## 3. User Experience

### Maker

1. Open LP and click `Post on X`.
2. Choose one mode in post dialog: `hashtag-only` (default), `short`, `full`.
3. Post via X intent.
4. Post is auto-listed under the tag feed.
5. Complete claim flow to mark official maker account.

### Reader

1. Browse tag feed in `New` or `Hot`.
2. Open product detail.
3. View official launch post and related user posts.
4. Jump to X thread for discussion.

## 4. Core Screens

- `/`: LP + post dialog + feed entry point
- `/tag/{tag}`: tag feed (new/hot)
- `/p/{handle}/{slug}`: product detail
- `/claim`: maker claim flow
- MVP build priority: `/` -> `/tag/{tag}` -> `/p/{handle}/{slug}`

## 5. Post Dialog Requirements

- Default mode: hashtag-only.
- Editable text area in all modes.
- `Copy` button and `Post on X` button.
- No forced template usage.
- Generated examples must include both required hashtags.

## 6. Card Levels

- `L0`: URL + embed only (no template fields).
- `L1`: basic extracted fields (name/url/one-liner).
- `L2`: rich fields (category/pricing/repo/install).

## 7. Official vs User Distinction

- Maker claim by verification post including claim code and X handle match (no email auth in MVP).
- Posts from verified maker handle + both required hashtags are marked official.
- Others are user posts.

## 8. Ranking

- `New`: submit or ingest time descending.
- `Hot`: weighted score from site upvotes and click volume.
- Weight ratio: `upvote:click = 2:1`.
- Upvote limit: one vote per cookie/IP/User-Agent per day.
- Click inputs for score: detail page view and external link click.
- `Discussed`: future scope.

## 9. Moderation Baseline

- Rate limit for submissions.
- Report flow.
- Domain/pattern blocklist.
- Optional segregation for unverified entries.
- Bot/vote abuse protection with cookie/IP/User-Agent constraints.
- Edit permission control: verified claim + signed owner session cookie.

## 10. Identity and Uniqueness

- Product uniqueness key is composite: `x_handle + slug`.
- Same `slug` can exist under different handles.
- Default URL scheme: include both handle and slug in path.
- Handle canonicalization: lowercase before storage and matching.
- Multilingual control: identity keys remain ASCII-safe, while display text fields support Unicode.
- Text safety: normalize Unicode and remove control/invisible characters from user-entered display fields.

## 11. Claim Rules

- Claim verification uses handle + claim post URL.
- Claim code expires in 24 hours.
- Pending claim expiry is processed automatically by scheduled jobs.

## 12. MVP Non-Goals

- Product Hunt submission support.
- Landing page auto-generation.
- Full X conversation harvesting from API graph.
- Billing and multi-role team features.
- Site-native comment system (MVP uses X thread redirect only).

## 13. Operational Targets

- Listing latency target: within 60 minutes from X post creation.

## 14. Infra Preferences

- Priority: minimize infra cost.
- Framework: Hono.
- Data store: Cloudflare D1.
- Runtime/scheduler: Cloudflare Workers + Cron Trigger.
- Rendering: SSR required (SEO priority).
- Package manager: pnpm.
- DB access: Drizzle ORM.
- Environment strategy: local + prod.

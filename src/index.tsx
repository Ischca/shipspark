import { and, desc, eq, sql } from "drizzle-orm";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { Hono } from "hono";
import type { Context } from "hono";
import { getDb } from "./db/client";
import { claims, ingestState, launches, productMetrics, products, votes } from "./db/schema";
import { buildVoteFingerprint } from "./lib/fingerprint";
import {
  CAMPAIGN_HASHTAG,
  PRODUCT_SLUG_PREFIX,
  extractHashtags,
  extractSlugFromTags,
  hasCampaignTag,
  normalizeTag,
  requiredTagExample
} from "./lib/hashtags";
import { parseTemplateFields } from "./lib/parser";
import {
  isValidHandle,
  normalizeHandle,
  normalizeTagParam,
  sanitizeDisplayText
} from "./lib/validation";
import type { Bindings, HonoEnv } from "./types";
import { GENERATED_STYLES } from "./_generated_styles";

type FeedItem = {
  productId: string;
  handle: string;
  slug: string;
  name: string;
  tagline: string | null;
  xUrl: string;
  ingestedAt: number;
  upvotes: number;
  clicks: number;
  isMakerPost: boolean;
};

type LayoutProps = {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  children: unknown;
};

type IngestPayload = {
  xUrl: string;
  rawText: string;
  authorHandle: string;
  authorName?: string;
  authorUrl?: string;
  isMakerPost?: boolean;
};

type IngestResult =
  | {
      ok: true;
      duplicate: boolean;
      productPath: string;
      tags: string[];
      productId: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
      required?: string;
    };

type PollCursor = {
  lastTweetId: string | null;
  updatedAtIso: string;
  query: string;
  nextPollAfterMs: number | null;
  lastErrorCode: string | null;
};

type ClaimPageProps = {
  notice?: string;
  error?: string;
  handle?: string;
  claimToken?: string;
  verifyPostUrl?: string;
};

type ProductEditPageProps = {
  handle: string;
  slug: string;
  name: string;
  tagline: string | null;
  homepageUrl: string | null;
  repoUrl: string | null;
  notice?: string;
  error?: string;
};

type XSearchResponse = {
  data?: Array<{
    id: string;
    text: string;
    author_id?: string;
  }>;
  includes?: {
    users?: Array<{
      id: string;
      username: string;
      name?: string;
    }>;
  };
  meta?: {
    result_count?: number;
    newest_id?: string;
    oldest_id?: string;
    next_token?: string;
  };
};

type XTweetLookupResponse = {
  data?: {
    id: string;
    text: string;
    author_id?: string;
  };
  includes?: {
    users?: Array<{
      id: string;
      username: string;
      name?: string;
    }>;
  };
};

const app = new Hono<HonoEnv>();

const NOW = () => Date.now();
const DEFAULT_TITLE = "ShipSpark | Casual Launch Board for X";
const DEFAULT_DESCRIPTION =
  "Post on X with #ShipSpark and #ss_{product}. ShipSpark auto-lists your launch and keeps it searchable.";
const HOT_WEIGHT_UPVOTE = 2;
const POLL_STATE_LEGACY_KEY = "x_recent_search_cursor_v1";
const POLL_STATE_KEY_PREFIX = "x_recent_search_cursor_v2";
const POLL_MAX_PAGES = 5;
const POLL_CREDITS_DEPLETED_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const POLL_RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;
const POLL_TRANSIENT_ERROR_COOLDOWN_MS = 5 * 60 * 1000;
const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;
const OWNER_SESSION_COOKIE = "sn_owner_session";

const EXTRA_STYLES = `
@import url("https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap");
`;

const Icon = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
       class={className}>
    <path d={d} />
  </svg>
);

const ICONS = {
  arrowUpRight: "M7 17L17 7M17 7H7M17 7V17",
  chevronUp: "M18 15L12 9L6 15",
  sparkles: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
  send: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z M21.854 2.147l-10.94 10.939",
  link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  shield: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
  externalLink: "M15 3h6v6 M10 14L21 3 M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
  edit: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
  x: "M18 6L6 18 M6 6l12 12",
};

const SITE_URL = "https://shipspark.net";
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#6d28d9"/><g transform="translate(4,4)"><path d="${ICONS.sparkles}" fill="#fff"/></g></svg>`;
const FAVICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`;

const toAbsoluteUrl = (requestUrl: string, path: string): string => {
  const u = new URL(requestUrl);
  return `${u.origin}${path}`;
};

const formatJst = (timestamp: number): string =>
  new Date(timestamp).toLocaleString("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

const buildIntentUrl = (text: string): string => {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
};

const buildPostTemplate = (mode: "hashtag-only" | "short" | "full", slug: string): string => {
  const tags = requiredTagExample(slug);
  if (mode === "hashtag-only") {
    return tags;
  }
  if (mode === "short") {
    return `name: Your Product\nurl: https://example.com\n${tags}`;
  }
  return `name: Your Product\ntagline: One line value proposition\nurl: https://example.com\nrepo: https://github.com/owner/repo\n${tags}`;
};

// --- OG Image PNG generation ---

const ogPngCrc32 = (buf: Uint8Array): number => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const ogPngChunk = (type: string, data: Uint8Array): Uint8Array => {
  const t = new Uint8Array([type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)]);
  const out = new Uint8Array(4 + 4 + data.length + 4);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(t, 4);
  out.set(data, 8);
  const forCrc = new Uint8Array(4 + data.length);
  forCrc.set(t, 0);
  forCrc.set(data, 4);
  v.setUint32(8 + data.length, ogPngCrc32(forCrc));
  return out;
};

let cachedOgPng: Uint8Array | null = null;

const generateOgPng = async (): Promise<Uint8Array> => {
  if (cachedOgPng) return cachedOgPng;

  const W = 1200, H = 630;
  const rowBytes = 1 + W * 3;
  const raw = new Uint8Array(rowBytes * H);

  // Gradient: dark navy-purple → brand purple
  const c0 = [15, 10, 40];
  const c1 = [109, 40, 217];

  for (let y = 0; y < H; y++) {
    const off = y * rowBytes;
    raw[off] = 0; // filter: none
    const t = y / (H - 1);
    const r = Math.round(c0[0] + (c1[0] - c0[0]) * t);
    const g = Math.round(c0[1] + (c1[1] - c0[1]) * t);
    const b = Math.round(c0[2] + (c1[2] - c0[2]) * t);
    raw[off + 1] = r;
    raw[off + 2] = g;
    raw[off + 3] = b;
    let filled = 3;
    while (filled < W * 3) {
      const len = Math.min(filled, W * 3 - filled);
      raw.copyWithin(off + 1 + filled, off + 1, off + 1 + len);
      filled += len;
    }
  }

  // Sparkle overlay (4-pointed star in center)
  const cx = Math.round(W * 0.5), cy = Math.round(H * 0.5);
  const armH = 100, armV = 80, armW = 4, diaR = 24;
  const reach = Math.max(armH, armV);
  for (let dy = -reach; dy <= reach; dy++) {
    const py = cy + dy;
    if (py < 0 || py >= H) continue;
    for (let dx = -reach; dx <= reach; dx++) {
      const px = cx + dx;
      if (px < 0 || px >= W) continue;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      let a = 0;
      if (adx + ady < diaR) a = Math.max(a, 1 - (adx + ady) / diaR);
      if (ady < armW && adx < armH) a = Math.max(a, (1 - adx / armH) * (1 - ady / armW));
      if (adx < armW && ady < armV) a = Math.max(a, (1 - ady / armV) * (1 - adx / armW));
      if (a > 0) {
        a = a * a * 0.85;
        const p = py * rowBytes + 1 + px * 3;
        raw[p]     = Math.min(255, Math.round(raw[p]     * (1 - a) + 255 * a));
        raw[p + 1] = Math.min(255, Math.round(raw[p + 1] * (1 - a) + 255 * a));
        raw[p + 2] = Math.min(255, Math.round(raw[p + 2] * (1 - a) + 255 * a));
      }
    }
  }

  // Compress (PNG uses zlib = CompressionStream "deflate")
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  writer.write(raw);
  writer.close();
  const parts: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  const compLen = parts.reduce((s, p) => s + p.length, 0);
  const compressed = new Uint8Array(compLen);
  let pos = 0;
  for (const p of parts) { compressed.set(p, pos); pos += p.length; }

  // Assemble PNG
  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, W);
  ihdrView.setUint32(4, H);
  ihdrData[8] = 8; ihdrData[9] = 2; // 8-bit RGB

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = ogPngChunk("IHDR", ihdrData);
  const idat = ogPngChunk("IDAT", compressed);
  const iend = ogPngChunk("IEND", new Uint8Array(0));

  const png = new Uint8Array(sig.length + ihdr.length + idat.length + iend.length);
  let o = 0;
  png.set(sig, o); o += sig.length;
  png.set(ihdr, o); o += ihdr.length;
  png.set(idat, o); o += idat.length;
  png.set(iend, o);

  cachedOgPng = png;
  return png;
};

const getLatestFeed = async (env: Bindings, limit: number): Promise<FeedItem[]> => {
  const db = getDb(env.DB);
  const rows = await db
    .select({
      productId: products.id,
      handle: products.xHandle,
      slug: products.slug,
      name: products.name,
      tagline: products.tagline,
      xUrl: launches.xUrl,
      ingestedAt: launches.ingestedAt,
      upvotes: productMetrics.upvoteCount,
      clicks: productMetrics.clickCount,
      isMakerPost: launches.isMakerPost
    })
    .from(launches)
    .innerJoin(products, eq(launches.productId, products.id))
    .leftJoin(productMetrics, eq(productMetrics.productId, products.id))
    .orderBy(desc(launches.ingestedAt))
    .limit(limit);

  return rows.map((row) => ({
    productId: row.productId,
    handle: row.handle,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    xUrl: row.xUrl,
    ingestedAt: row.ingestedAt,
    upvotes: row.upvotes ?? 0,
    clicks: row.clicks ?? 0,
    isMakerPost: row.isMakerPost
  }));
};

const getTagFeed = async (
  env: Bindings,
  tag: string,
  sort: "new" | "hot",
  limit: number
): Promise<FeedItem[]> => {
  const db = getDb(env.DB);
  const tagNeedle = `%"${tag.toLowerCase()}"%`;
  const hotScore = sql<number>`
    (coalesce(${productMetrics.upvoteCount}, 0) * ${HOT_WEIGHT_UPVOTE} + coalesce(${productMetrics.clickCount}, 0))
  `;

  const query = db
    .select({
      productId: products.id,
      handle: products.xHandle,
      slug: products.slug,
      name: products.name,
      tagline: products.tagline,
      xUrl: launches.xUrl,
      ingestedAt: launches.ingestedAt,
      upvotes: productMetrics.upvoteCount,
      clicks: productMetrics.clickCount,
      isMakerPost: launches.isMakerPost
    })
    .from(launches)
    .innerJoin(products, eq(launches.productId, products.id))
    .leftJoin(productMetrics, eq(productMetrics.productId, products.id))
    .where(sql`${launches.hashtags} like ${tagNeedle}`)
    .limit(limit);

  const rows =
    sort === "hot"
      ? await query.orderBy(desc(hotScore), desc(launches.ingestedAt))
      : await query.orderBy(desc(launches.ingestedAt));

  return rows.map((row) => ({
    productId: row.productId,
    handle: row.handle,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    xUrl: row.xUrl,
    ingestedAt: row.ingestedAt,
    upvotes: row.upvotes ?? 0,
    clicks: row.clicks ?? 0,
    isMakerPost: row.isMakerPost
  }));
};

const ensureMetricRow = async (env: Bindings, productId: string): Promise<void> => {
  const db = getDb(env.DB);
  await db
    .insert(productMetrics)
    .values({
      productId,
      upvoteCount: 0,
      clickCount: 0,
      updatedAt: NOW()
    })
    .onConflictDoNothing();
};

const bumpClicks = async (env: Bindings, productId: string): Promise<void> => {
  const db = getDb(env.DB);
  await ensureMetricRow(env, productId);
  await db
    .update(productMetrics)
    .set({
      clickCount: sql`${productMetrics.clickCount} + 1`,
      updatedAt: NOW()
    })
    .where(eq(productMetrics.productId, productId));
};

const ingestLaunchPayload = async (env: Bindings, payload: IngestPayload): Promise<IngestResult> => {
  if (!payload.xUrl || !payload.rawText || !payload.authorHandle) {
    return { ok: false, status: 400, error: "xUrl, rawText, authorHandle are required" };
  }

  try {
    new URL(payload.xUrl);
  } catch {
    return { ok: false, status: 400, error: "xUrl must be a valid URL" };
  }

  const handle = normalizeHandle(payload.authorHandle);
  if (!isValidHandle(handle)) {
    return { ok: false, status: 400, error: "authorHandle format is invalid" };
  }

  const normalizedText = sanitizeDisplayText(payload.rawText);
  const hashtags = extractHashtags(normalizedText);
  const hasCampaign = hasCampaignTag(hashtags);
  const slug = extractSlugFromTags(hashtags);

  if (!hasCampaign || !slug) {
    return {
      ok: false,
      status: 400,
      error: "required hashtags are missing",
      required: requiredTagExample("your_product")
    };
  }

  const parsed = parseTemplateFields(normalizedText);
  const productName = sanitizeDisplayText(parsed.name ?? slug);
  const now = NOW();
  const db = getDb(env.DB);

  const existingProduct = await db
    .select({
      id: products.id,
      tagline: products.tagline,
      homepageUrl: products.homepageUrl,
      repoUrl: products.repoUrl
    })
    .from(products)
    .where(and(eq(products.xHandle, handle), eq(products.slug, slug)))
    .limit(1);

  let productId: string;
  if (existingProduct.length === 0) {
    productId = crypto.randomUUID();
    await db.insert(products).values({
      id: productId,
      xHandle: handle,
      slug,
      name: productName || slug,
      tagline: parsed.tagline ? sanitizeDisplayText(parsed.tagline) : null,
      homepageUrl: parsed.homepageUrl ?? null,
      repoUrl: parsed.repoUrl ?? null,
      ownerHandle: handle,
      createdAt: now,
      updatedAt: now
    });
    await ensureMetricRow(env, productId);
  } else {
    productId = existingProduct[0].id;

    const patchTagline = !existingProduct[0].tagline && parsed.tagline;
    const patchHomepage = !existingProduct[0].homepageUrl && parsed.homepageUrl;
    const patchRepo = !existingProduct[0].repoUrl && parsed.repoUrl;

    if (patchTagline || patchHomepage || patchRepo) {
      await db
        .update(products)
        .set({
          tagline: patchTagline ? sanitizeDisplayText(parsed.tagline ?? "") : existingProduct[0].tagline,
          homepageUrl: patchHomepage ? parsed.homepageUrl ?? null : existingProduct[0].homepageUrl,
          repoUrl: patchRepo ? parsed.repoUrl ?? null : existingProduct[0].repoUrl,
          updatedAt: now
        })
        .where(eq(products.id, productId));
    }
  }

  const existingLaunch = await db
    .select({ id: launches.id })
    .from(launches)
    .where(eq(launches.xUrl, payload.xUrl))
    .limit(1);

  if (existingLaunch.length > 0) {
    return {
      ok: true,
      duplicate: true,
      productPath: `/p/${handle}/${slug}`,
      tags: hashtags,
      productId
    };
  }

  await db.insert(launches).values({
    id: crypto.randomUUID(),
    productId,
    xUrl: payload.xUrl,
    xPostId: payload.xUrl.split("/").pop() ?? null,
    authorName: payload.authorName ? sanitizeDisplayText(payload.authorName) : null,
    authorUrl: payload.authorUrl ?? null,
    rawText: normalizedText,
    hashtags: JSON.stringify(hashtags),
    isMakerPost: payload.isMakerPost ?? false,
    ingestedAt: now
  });

  return {
    ok: true,
    duplicate: false,
    productPath: `/p/${handle}/${slug}`,
    tags: hashtags,
    productId
  };
};

const makeClaimToken = (): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let body = "";
  for (let i = 0; i < 8; i += 1) {
    const index = Math.floor(Math.random() * alphabet.length);
    body += alphabet[index];
  }
  return `claim:${body}`;
};

const parseTweetUrl = (rawUrl: string): { handle: string; tweetId: string } | null => {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 3) {
      return null;
    }
    const [handle, statusKeyword, tweetId] = parts;
    if (statusKeyword !== "status") {
      return null;
    }
    if (!/^[0-9]+$/.test(tweetId)) {
      return null;
    }
    const normalizedHandle = normalizeHandle(handle);
    if (!isValidHandle(normalizedHandle)) {
      return null;
    }
    return { handle: normalizedHandle, tweetId };
  } catch {
    return null;
  }
};

const parseOptionalHttpUrl = (raw: string): { ok: true; value: string | null } | { ok: false } => {
  const input = raw.trim();
  if (!input) {
    return { ok: true, value: null };
  }

  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false };
    }
    return { ok: true, value: parsed.toString() };
  } catch {
    return { ok: false };
  }
};

const expirePendingClaims = async (env: Bindings): Promise<number> => {
  const db = getDb(env.DB);
  const now = NOW();
  const result = await db
    .update(claims)
    .set({ status: "expired" })
    .where(and(eq(claims.status, "pending"), sql`${claims.expiresAt} < ${now}`));

  return Number(result.meta?.changes ?? 0);
};

const fetchTweetForClaim = async (
  bearerToken: string,
  tweetId: string
): Promise<{ text: string; authorHandle: string; authorName?: string } | null> => {
  const params = new URLSearchParams({
    expansions: "author_id",
    "tweet.fields": "author_id,text",
    "user.fields": "username,name"
  });

  const response = await fetch(`https://api.x.com/2/tweets/${tweetId}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${bearerToken}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`claim verify: x api tweet lookup failed status=${response.status} body=${body}`);
    return null;
  }

  const payload = (await response.json()) as XTweetLookupResponse;
  if (!payload.data?.text || !payload.data.author_id) {
    return null;
  }

  const user = payload.includes?.users?.find((item) => item.id === payload.data?.author_id);
  if (!user?.username) {
    return null;
  }

  return {
    text: payload.data.text,
    authorHandle: normalizeHandle(user.username),
    authorName: user.name
  };
};

const getDefaultSearchQuery = (env: Bindings): string => {
  return env.X_SEARCH_QUERY?.trim() || `#${CAMPAIGN_HASHTAG} -is:retweet`;
};

const buildPollStateKey = (query: string): string => {
  const normalized = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  let hash = 2166136261;
  for (const char of query) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  const queryHash = (hash >>> 0).toString(16).padStart(8, "0");
  return `${POLL_STATE_KEY_PREFIX}:${normalized || "default"}:${queryHash}`;
};

const parsePollCursor = (value: string): PollCursor | null => {
  try {
    const parsed = JSON.parse(value) as PollCursor;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      lastTweetId: parsed.lastTweetId ?? null,
      updatedAtIso: parsed.updatedAtIso ?? new Date(0).toISOString(),
      query: parsed.query ?? "",
      nextPollAfterMs: typeof parsed.nextPollAfterMs === "number" ? parsed.nextPollAfterMs : null,
      lastErrorCode: typeof parsed.lastErrorCode === "string" ? parsed.lastErrorCode : null
    };
  } catch {
    return null;
  }
};

const loadPollCursor = async (env: Bindings, query: string): Promise<PollCursor | null> => {
  const db = getDb(env.DB);
  const stateKey = buildPollStateKey(query);
  const rows = await db
    .select({ value: ingestState.value })
    .from(ingestState)
    .where(eq(ingestState.key, stateKey))
    .limit(1);

  if (rows.length > 0) {
    return parsePollCursor(rows[0].value);
  }

  const legacyRows = await db
    .select({ value: ingestState.value })
    .from(ingestState)
    .where(eq(ingestState.key, POLL_STATE_LEGACY_KEY))
    .limit(1);

  if (legacyRows.length === 0) {
    return null;
  }

  const legacyCursor = parsePollCursor(legacyRows[0].value);
  if (!legacyCursor) {
    return null;
  }

  if (legacyCursor.query && legacyCursor.query !== query) {
    return null;
  }

  return legacyCursor;
};

const savePollCursor = async (env: Bindings, query: string, cursor: PollCursor): Promise<void> => {
  const db = getDb(env.DB);
  const stateKey = buildPollStateKey(query);
  await db
    .insert(ingestState)
    .values({
      key: stateKey,
      value: JSON.stringify(cursor),
      updatedAt: NOW()
    })
    .onConflictDoUpdate({
      target: ingestState.key,
      set: {
        value: JSON.stringify(cursor),
        updatedAt: NOW()
      }
    });
};

const pickNewerTweetId = (current: string | null, incoming: string): string => {
  if (!current) {
    return incoming;
  }
  try {
    return BigInt(incoming) > BigInt(current) ? incoming : current;
  } catch {
    return incoming > current ? incoming : current;
  }
};

const extractRateLimitResetMs = (response: Response): number | null => {
  const retryAfterHeader = response.headers.get("retry-after");
  if (retryAfterHeader) {
    const asNumber = Number.parseInt(retryAfterHeader, 10);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return Date.now() + asNumber * 1000;
    }
  }

  const resetHeader = response.headers.get("x-rate-limit-reset");
  if (!resetHeader) {
    return null;
  }

  const epochSeconds = Number.parseInt(resetHeader, 10);
  if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) {
    return null;
  }

  return epochSeconds * 1000;
};

const runIngestionPolling = async (env: Bindings, cronExpr: string): Promise<void> => {
  const expired = await expirePendingClaims(env);
  if (expired > 0) {
    console.log(`[claims] expired pending claims=${expired}`);
  }

  const bearer = env.X_BEARER_TOKEN?.trim();
  if (!bearer) {
    console.warn(`[polling] skip: X_BEARER_TOKEN is not configured (cron=${cronExpr})`);
    return;
  }

  const query = getDefaultSearchQuery(env);
  const cursor = await loadPollCursor(env, query);
  const now = Date.now();

  if (cursor?.nextPollAfterMs && now < cursor.nextPollAfterMs) {
    console.log(
      `[polling] skip cooldown cron=${cronExpr} query="${query}" until=${new Date(cursor.nextPollAfterMs).toISOString()} reason=${cursor.lastErrorCode ?? "unknown"}`
    );
    return;
  }

  const userById = new Map<string, { username: string; name?: string }>();
  let newestTweetId = cursor?.lastTweetId ?? null;
  let nextToken: string | undefined;
  let scanned = 0;
  let accepted = 0;
  let nextPollAfterMs: number | null = null;
  let lastErrorCode: string | null = null;

  try {
    for (let page = 0; page < POLL_MAX_PAGES; page += 1) {
      const params = new URLSearchParams({
        query,
        max_results: "100",
        expansions: "author_id",
        "tweet.fields": "author_id,text,created_at",
        "user.fields": "username,name"
      });

      if (cursor?.lastTweetId) {
        params.set("since_id", cursor.lastTweetId);
      } else {
        params.set("start_time", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      }

      if (nextToken) {
        params.set("next_token", nextToken);
      }

      const endpoint = `https://api.x.com/2/tweets/search/recent?${params.toString()}`;
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${bearer}`
        }
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`[polling] x api error status=${response.status} body=${body}`);

        if (response.status === 402) {
          nextPollAfterMs = Date.now() + POLL_CREDITS_DEPLETED_COOLDOWN_MS;
          lastErrorCode = "credits_depleted";
        } else if (response.status === 429) {
          nextPollAfterMs =
            extractRateLimitResetMs(response) ?? Date.now() + POLL_RATE_LIMIT_COOLDOWN_MS;
          lastErrorCode = "rate_limited";
        } else if (response.status >= 500) {
          nextPollAfterMs = Date.now() + POLL_TRANSIENT_ERROR_COOLDOWN_MS;
          lastErrorCode = `x_http_${response.status}`;
        } else {
          lastErrorCode = `x_http_${response.status}`;
        }

        break;
      }

      nextPollAfterMs = null;
      lastErrorCode = null;

      const payload = (await response.json()) as XSearchResponse;
      const users = payload.includes?.users ?? [];
      for (const user of users) {
        userById.set(user.id, { username: user.username, name: user.name });
      }

      const tweets = payload.data ?? [];
      if (tweets.length === 0) {
        nextToken = undefined;
        break;
      }

      for (const tweet of tweets) {
        scanned += 1;
        newestTweetId = pickNewerTweetId(newestTweetId, tweet.id);
        const user = tweet.author_id ? userById.get(tweet.author_id) : null;
        if (!user?.username) {
          continue;
        }

        const result = await ingestLaunchPayload(env, {
          xUrl: `https://x.com/${user.username}/status/${tweet.id}`,
          rawText: tweet.text,
          authorHandle: user.username,
          authorName: user.name,
          authorUrl: `https://x.com/${user.username}`,
          isMakerPost: false
        });

        if (result.ok) {
          accepted += 1;
        }
      }

      nextToken = payload.meta?.next_token;
      if (!nextToken) {
        break;
      }
    }
  } catch (error) {
    nextPollAfterMs = Date.now() + POLL_TRANSIENT_ERROR_COOLDOWN_MS;
    lastErrorCode = "worker_exception";
    const message = error instanceof Error ? error.message : `${error}`;
    console.error(`[polling] unexpected error cron=${cronExpr} message=${message}`);
  }

  await savePollCursor(env, query, {
    lastTweetId: newestTweetId,
    updatedAtIso: new Date().toISOString(),
    query,
    nextPollAfterMs,
    lastErrorCode
  });

  console.log(
    `[polling] done cron=${cronExpr} query="${query}" sinceId=${cursor?.lastTweetId ?? "null"} scanned=${scanned} accepted=${accepted} newestTweetId=${newestTweetId} cooldownUntil=${nextPollAfterMs ? new Date(nextPollAfterMs).toISOString() : "none"}`
  );
};

const getSessionSecret = (env: Bindings): string => env.SESSION_SECRET?.trim() ?? "";

const isSecureRequest = (requestUrl: string): boolean => {
  return new URL(requestUrl).protocol === "https:";
};

const getOwnerSessionHandle = async (c: Context<HonoEnv>): Promise<string | null> => {
  const secret = getSessionSecret(c.env as Bindings);
  if (!secret) {
    return null;
  }

  const signed = await getSignedCookie(c, secret, OWNER_SESSION_COOKIE);
  if (typeof signed !== "string" || !signed.trim()) {
    return null;
  }

  const handle = normalizeHandle(signed);
  if (!isValidHandle(handle)) {
    return null;
  }

  return handle;
};

const setOwnerSessionHandle = async (c: Context<HonoEnv>, handle: string): Promise<boolean> => {
  const secret = getSessionSecret(c.env as Bindings);
  if (!secret) {
    return false;
  }

  await setSignedCookie(c, OWNER_SESSION_COOKIE, handle, secret, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isSecureRequest(c.req.url),
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return true;
};

const hasVerifiedOwnerClaim = async (env: Bindings, handle: string): Promise<boolean> => {
  const db = getDb(env.DB);
  const rows = await db
    .select({ id: claims.id })
    .from(claims)
    .where(and(eq(claims.xHandle, handle), eq(claims.status, "verified")))
    .limit(1);

  return rows.length > 0;
};

const isApiIngestAuthorized = (c: Context<HonoEnv>): boolean => {
  const internalToken = c.env.INTERNAL_INGEST_TOKEN?.trim();
  const headerToken = c.req.header("x-internal-ingest-token")?.trim();

  return Boolean(internalToken && headerToken && internalToken === headerToken);
};

const Layout = ({ children, title, description, canonical, ogImage }: LayoutProps) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title ?? DEFAULT_TITLE}</title>
      <meta name="description" content={description ?? DEFAULT_DESCRIPTION} />
      {canonical ? <link rel="canonical" href={canonical} /> : null}
      <link rel="icon" href={FAVICON_DATA_URI} type="image/svg+xml" />
      <meta name="theme-color" content="#6d28d9" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="ShipSpark" />
      <meta property="og:title" content={title ?? DEFAULT_TITLE} />
      <meta property="og:description" content={description ?? DEFAULT_DESCRIPTION} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      <meta property="og:image" content={ogImage ?? `${SITE_URL}/og.png`} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title ?? DEFAULT_TITLE} />
      <meta name="twitter:description" content={description ?? DEFAULT_DESCRIPTION} />
      <meta name="twitter:image" content={ogImage ?? `${SITE_URL}/og.png`} />
      <style>{GENERATED_STYLES}{EXTRA_STYLES}</style>
    </head>
    <body class="min-h-screen">
      <header class="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div class="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <a href="/" class="text-xl font-extrabold tracking-tight">
            Ship<span class="text-primary">Spark</span>
          </a>
          <nav class="flex items-center gap-2">
            <a class="pill" href={`/tag/${normalizeTag(CAMPAIGN_HASHTAG)}`}>
              #{CAMPAIGN_HASHTAG}
            </a>
            <a class="pill" href="/claim">
              <Icon d={ICONS.shield} size={12} /> Claim
            </a>
          </nav>
        </div>
      </header>
      <main class="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-20">
        {children}
      </main>
    </body>
  </html>
);

const FeedList = ({ items }: { items: FeedItem[] }) => {
  if (items.length === 0) {
    return (
      <div class="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground bg-card/50">
        No launches yet. Publish your first post on X to get listed.
      </div>
    );
  }

  return (
    <ul class="feed-list list-none m-0 p-0 grid gap-3">
      {items.map((item) => (
        <li>
          <a class="group block rounded-lg border border-border bg-card p-4 md:p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
             href={`/p/${item.handle}/${item.slug}`}
             style="--tw-shadow-color: oklch(0.55 0.2 270 / 0.05);">
            <div class="flex items-center justify-between gap-3">
              <strong class="text-base font-bold tracking-tight group-hover:text-primary transition-colors">{item.name}</strong>
              <span class="text-xs text-muted-foreground shrink-0">{formatJst(item.ingestedAt)}</span>
            </div>
            <p class="mt-2 text-sm text-muted-foreground line-clamp-2" style="white-space: pre-wrap;">{item.tagline ?? "No tagline yet."}</p>
            <div class="mt-3 flex items-center justify-between flex-wrap gap-2">
              <span class="text-xs text-muted-foreground">@{item.handle} / {item.slug}</span>
              <div class="flex items-center gap-2">
                <span class="stat-pill"><Icon d={ICONS.chevronUp} size={12} /> {item.upvotes}</span>
                <span class="stat-pill"><Icon d={ICONS.arrowUpRight} size={12} /> {item.clicks}</span>
                {item.isMakerPost ? <span class="badge">Official</span> : null}
              </div>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
};

const PostComposerDialog = () => {
  const defaultSlug = "your_product";
  const defaultText = buildPostTemplate("hashtag-only", defaultSlug);

  return (
    <>
      <dialog
        id="post-dialog"
        class="modal-dialog"
        data-campaign={CAMPAIGN_HASHTAG}
        data-prefix={PRODUCT_SLUG_PREFIX}
        data-default-slug={defaultSlug}
      >
        <div class="p-5 md:p-6 bg-card rounded-lg">
          <div class="flex items-center justify-between mb-1">
            <h2 class="text-lg font-bold tracking-tight m-0"><Icon d={ICONS.sparkles} size={18} className="inline -mt-0.5" /> Compose Post for X</h2>
            <button type="button" class="btn-secondary !p-2 !rounded-full" id="close-post-dialog">
              <Icon d={ICONS.x} size={16} />
            </button>
          </div>
          <p class="text-xs text-muted-foreground mb-4">Default is hashtag-only. Templates are optional and fully editable.</p>

          <div class="flex flex-wrap gap-2 mb-4">
            <button type="button" class="mode-btn active" data-mode="hashtag-only">
              Hashtag only
            </button>
            <button type="button" class="mode-btn" data-mode="short">
              Short template
            </button>
            <button type="button" class="mode-btn" data-mode="full">
              Full template
            </button>
          </div>

          <div class="field-group grid gap-1.5 mt-3">
            <label htmlFor="composer-slug" class="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{`Product ID (#${PRODUCT_SLUG_PREFIX}your_product)`}</label>
            <input id="composer-slug" defaultValue={defaultSlug} />
          </div>

          <div class="field-group grid gap-1.5 mt-3">
            <label htmlFor="composer-text" class="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Post text (editable)</label>
            <textarea id="composer-text" defaultValue={defaultText} />
          </div>

          <div class="mt-5 flex flex-wrap gap-3">
            <button type="button" class="btn-secondary" id="apply-template">
              Re-apply template
            </button>
            <button type="button" class="btn-secondary" id="copy-post-text">
              Copy
            </button>
            <a id="post-on-x" class="btn-primary" href={buildIntentUrl(defaultText)} target="_blank" rel="noreferrer">
              <Icon d={ICONS.send} size={14} /> Post on X
            </a>
          </div>
        </div>
      </dialog>
      <script src="/assets/post-composer.js" defer></script>
    </>
  );
};

const ClaimPage = ({ notice, error, handle, claimToken, verifyPostUrl }: ClaimPageProps) => {
  return (
    <section class="rounded-lg border border-border bg-card p-5 md:p-6 shadow-sm">
      <h1 class="text-xl font-bold tracking-tight m-0 flex items-center gap-2">
        <Icon d={ICONS.shield} size={20} /> Maker Claim
      </h1>
      <p class="text-xs text-muted-foreground mt-1">
        Verify owner identity by X handle. Generate a token, post once on X, then paste the post URL.
      </p>
      {notice ? <p class="notice-box mt-3">{notice}</p> : null}
      {error ? <p class="error-box mt-3">{error}</p> : null}

      <form method="post" action="/claim/start">
        <h2 class="section-heading text-lg font-bold tracking-tight mt-6 mb-3">Step 1. Generate token</h2>
        <div class="field-group grid gap-1.5 mt-3">
          <label htmlFor="claim-handle" class="text-xs text-muted-foreground font-semibold uppercase tracking-wide">X handle</label>
          <input id="claim-handle" name="handle" required defaultValue={handle ?? ""} />
        </div>
        <div class="mt-4 flex flex-wrap gap-3">
          <button type="submit" class="btn-primary">
            {claimToken ? "Regenerate token" : "Generate token"}
          </button>
        </div>
      </form>

      {claimToken ? (
        <>
          <div class="field-group grid gap-1.5 mt-3">
            <label htmlFor="active-claim-token" class="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Current claim token</label>
            <input id="active-claim-token" value={claimToken} readOnly />
          </div>
          <div class="mt-4 flex flex-wrap gap-3">
            <a
              class="btn-primary"
              href={buildIntentUrl(`#${CAMPAIGN_HASHTAG} ${claimToken}`)}
              target="_blank"
              rel="noreferrer"
            >
              <Icon d={ICONS.send} size={14} /> Post claim on X
            </a>
          </div>
        </>
      ) : null}

      <form method="post" action="/claim/verify">
        <h2 class="section-heading text-lg font-bold tracking-tight mt-6 mb-3">Step 2. Verify ownership</h2>
        <p class="text-xs text-muted-foreground">Tip: verification will use the latest pending token for this handle.</p>
        <div class="field-group grid gap-1.5 mt-3">
          <label htmlFor="verify-handle" class="text-xs text-muted-foreground font-semibold uppercase tracking-wide">X handle</label>
          <input id="verify-handle" name="handle" required defaultValue={handle ?? ""} />
        </div>
        {claimToken ? <input type="hidden" name="claimToken" value={claimToken} /> : null}
        <div class="field-group grid gap-1.5 mt-3">
          <label htmlFor="verify-post-url" class="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Claim post URL</label>
          <input id="verify-post-url" name="verifyPostUrl" required defaultValue={verifyPostUrl ?? ""} />
        </div>
        <div class="mt-4 flex flex-wrap gap-3">
          <button type="submit" class="btn-primary">
            <Icon d={ICONS.shield} size={14} /> Verify ownership
          </button>
        </div>
      </form>
    </section>
  );
};

const ProductEditPage = ({
  handle,
  slug,
  name,
  tagline,
  homepageUrl,
  repoUrl,
  notice,
  error
}: ProductEditPageProps) => {
  return (
    <section class="rounded-lg border border-border bg-card p-5 md:p-6 shadow-sm">
      <h1 class="text-xl font-bold tracking-tight m-0 flex items-center gap-2">
        <Icon d={ICONS.edit} size={20} /> Edit Product
      </h1>
      <p class="text-xs text-muted-foreground mt-1">
        Editing: @{handle} / {slug}
      </p>
      {notice ? <p class="notice-box mt-3">{notice}</p> : null}
      {error ? <p class="error-box mt-3">{error}</p> : null}

      <form method="post" action={`/p/${handle}/${slug}/edit`}>
        <div class="field-group grid gap-1.5 mt-3">
          <label htmlFor="edit-name" class="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Name</label>
          <input id="edit-name" name="name" required defaultValue={name} />
        </div>
        <div class="field-group grid gap-1.5 mt-3">
          <label htmlFor="edit-tagline" class="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Tagline</label>
          <textarea id="edit-tagline" name="tagline" defaultValue={tagline ?? ""} />
        </div>
        <div class="field-group grid gap-1.5 mt-3">
          <label htmlFor="edit-homepage" class="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Homepage URL (http/https)</label>
          <input id="edit-homepage" name="homepageUrl" defaultValue={homepageUrl ?? ""} />
        </div>
        <div class="field-group grid gap-1.5 mt-3">
          <label htmlFor="edit-repo" class="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Repo URL (http/https)</label>
          <input id="edit-repo" name="repoUrl" defaultValue={repoUrl ?? ""} />
        </div>
        <div class="mt-5 flex flex-wrap gap-3">
          <button type="submit" class="btn-primary">
            Save
          </button>
          <a class="btn-secondary" href={`/p/${handle}/${slug}`}>
            Back
          </a>
          <a class="btn-danger" href={`/owner/logout?next=${encodeURIComponent(`/p/${handle}/${slug}`)}`}>
            Clear edit session
          </a>
        </div>
      </form>
    </section>
  );
};

app.get("/og.png", async (c) => {
  const png = await generateOgPng();
  return new Response(png.buffer as ArrayBuffer, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=604800, immutable",
    },
  });
});

app.get("/assets/post-composer.js", (c) => {
  c.header("content-type", "application/javascript; charset=utf-8");
  c.header("cache-control", "public, max-age=600");
  return c.body(`(() => {
  const dialog = document.getElementById("post-dialog");
  if (!dialog) return;

  const openBtn = document.getElementById("open-post-dialog");
  const closeBtn = document.getElementById("close-post-dialog");
  const modeButtons = Array.from(dialog.querySelectorAll("[data-mode]"));
  const textArea = document.getElementById("composer-text");
  const slugInput = document.getElementById("composer-slug");
  const copyBtn = document.getElementById("copy-post-text");
  const applyBtn = document.getElementById("apply-template");
  const postLink = document.getElementById("post-on-x");

  if (!openBtn || !closeBtn || !textArea || !slugInput || !copyBtn || !applyBtn || !postLink) {
    return;
  }

  const campaign = (dialog.getAttribute("data-campaign") || "ShipSpark").replace(/^#/, "");
  const prefix = (dialog.getAttribute("data-prefix") || "ss_").replace(/^#/, "");
  const fallbackSlug = dialog.getAttribute("data-default-slug") || "your_product";
  let mode = "hashtag-only";
  let dirty = false;

  const sanitizeSlug = (value) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "");
    return (normalized || fallbackSlug).slice(0, 32);
  };

  const makeTemplate = (selectedMode, slug) => {
    const tags = "#" + campaign + " #" + prefix + slug;
    if (selectedMode === "hashtag-only") return tags;
    if (selectedMode === "short") return "name: Your Product\\nurl: https://example.com\\n" + tags;
    return "name: Your Product\\ntagline: One line value proposition\\nurl: https://example.com\\nrepo: https://github.com/owner/repo\\n" + tags;
  };

  const setMode = (nextMode) => {
    mode = nextMode;
    modeButtons.forEach((button) => {
      button.classList.toggle("active", button.getAttribute("data-mode") === mode);
    });
  };

  const syncPostLink = () => {
    postLink.href = "https://x.com/intent/tweet?text=" + encodeURIComponent(textArea.value);
  };

  const applyTemplate = () => {
    const slug = sanitizeSlug(slugInput.value);
    slugInput.value = slug;
    textArea.value = makeTemplate(mode, slug);
    dirty = false;
    syncPostLink();
  };

  setMode(mode);
  applyTemplate();

  openBtn.addEventListener("click", () => {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      return;
    }
    dialog.setAttribute("open", "true");
  });

  closeBtn.addEventListener("click", () => {
    if (typeof dialog.close === "function") {
      dialog.close();
      return;
    }
    dialog.removeAttribute("open");
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.getAttribute("data-mode");
      if (!selected) return;
      setMode(selected);
      applyTemplate();
    });
  });

  applyBtn.addEventListener("click", () => {
    applyTemplate();
  });

  textArea.addEventListener("input", () => {
    dirty = true;
    syncPostLink();
  });

  slugInput.addEventListener("input", () => {
    if (!dirty) {
      applyTemplate();
      return;
    }
    syncPostLink();
  });

  copyBtn.addEventListener("click", async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textArea.value);
      } else {
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
      }
      copyBtn.textContent = "Copied";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1200);
    } catch {
      copyBtn.textContent = "Copy failed";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1200);
    }
  });
})();

// Install block copy
(function() {
  var block = document.getElementById("install-copy");
  if (!block) return;
  block.addEventListener("click", function() {
    var code = block.querySelector("code");
    if (!code) return;
    var text = code.textContent || "";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        var hint = document.getElementById("install-copy-hint");
        if (hint) {
          hint.textContent = "copied!";
          setTimeout(function() { hint.textContent = "click to copy"; }, 1500);
        }
      });
    }
  });
})();`);
});

app.get("/healthz", (c) => c.json({ ok: true }));

app.get("/", async (c) => {
  let items: FeedItem[] = [];
  try {
    items = await getLatestFeed(c.env, 25);
  } catch (error) {
    console.error("failed to fetch latest feed", error);
  }
  const notice = c.req.query("notice") ?? undefined;
  const error = c.req.query("error") ?? undefined;

  return c.html(
    <Layout
      title={DEFAULT_TITLE}
      description={DEFAULT_DESCRIPTION}
      canonical={toAbsoluteUrl(c.req.url, "/")}
    >
      <section class="hero-section relative rounded-xl border border-border bg-card p-6 md:p-10 shadow-lg mb-6">
        <h1 class="text-3xl md:text-5xl font-extrabold tracking-tighter leading-tight"
             style="background: linear-gradient(135deg, var(--color-foreground), var(--color-primary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
          Post on X. Get listed automatically.
        </h1>
        <p class="mt-4 text-muted-foreground text-sm md:text-base font-light max-w-2xl leading-relaxed">
          Add the hashtags to your launch post. ShipSpark turns timeline posts into a searchable launch board.
        </p>

        <div class="install-block mt-6" id="install-copy" title="Click to copy">
          <span class="prompt">$</span>
          <code>#{CAMPAIGN_HASHTAG} #{PRODUCT_SLUG_PREFIX}your_product</code>
          <span class="copy-hint" id="install-copy-hint">click to copy</span>
        </div>
        <div class="mt-6 flex flex-wrap gap-3">
          <button type="button" class="btn-primary" id="open-post-dialog">
            <Icon d={ICONS.send} size={14} /> Post on X
          </button>
          <a class="btn-secondary" href="/claim">
            <Icon d={ICONS.shield} size={14} /> Claim ownership
          </a>
          <a class="btn-secondary" href={`/tag/${normalizeTag(CAMPAIGN_HASHTAG)}`}>
            Browse #{CAMPAIGN_HASHTAG}
          </a>
        </div>
      </section>

      <PostComposerDialog />

      <section class="rounded-lg border border-border bg-card p-5 md:p-6 shadow-sm mb-6">
        <h2 class="text-lg font-bold tracking-tight m-0 flex items-center gap-2">
          <Icon d={ICONS.link} size={18} /> Register Post URL
        </h2>
        <p class="text-xs text-muted-foreground mt-1">If auto-ingestion misses your post, paste the URL to import it manually.</p>
        {notice ? <p class="notice-box mt-3">{notice}</p> : null}
        {error ? <p class="error-box mt-3">{error}</p> : null}
        <form method="post" action="/submit/url">
          <div class="field-group grid gap-1.5 mt-3">
            <label htmlFor="quick-submit-x-url" class="text-xs text-muted-foreground font-semibold uppercase tracking-wide">X Post URL</label>
            <input
              id="quick-submit-x-url"
              name="xUrl"
              required
              placeholder="https://x.com/{handle}/status/{tweet_id}"
            />
          </div>
          <div class="mt-4 flex flex-wrap gap-3">
            <button type="submit" class="btn-primary">
              <Icon d={ICONS.arrowUpRight} size={14} /> Register URL
            </button>
          </div>
        </form>
      </section>

      <h2 class="section-heading text-xl font-bold tracking-tight mt-6 mb-3">Latest</h2>
      <FeedList items={items} />
    </Layout>
  );
});

app.post("/submit/url", async (c) => {
  const form = await c.req.formData();
  const xUrl = `${form.get("xUrl") ?? ""}`.trim();

  const fail = (message: string) => c.redirect(`/?error=${encodeURIComponent(message)}`);
  if (!xUrl) {
    return fail("Please enter a post URL.");
  }

  const parsed = parseTweetUrl(xUrl);
  if (!parsed) {
    return fail("Invalid post URL format.");
  }

  const bearer = c.env.X_BEARER_TOKEN?.trim();
  if (!bearer) {
    return fail("Cannot import because X_BEARER_TOKEN is not configured.");
  }

  const tweet = await fetchTweetForClaim(bearer, parsed.tweetId);
  if (!tweet) {
    return fail("Could not fetch post data from X API.");
  }

  if (tweet.authorHandle !== parsed.handle) {
    return fail("URL handle does not match post author handle.");
  }

  const result = await ingestLaunchPayload(c.env, {
    xUrl,
    rawText: tweet.text,
    authorHandle: tweet.authorHandle,
    authorName: tweet.authorName,
    authorUrl: `https://x.com/${tweet.authorHandle}`,
    isMakerPost: false
  });

  if (!result.ok) {
    const detail = result.required ? `${result.error}: ${result.required}` : result.error;
    return fail(detail);
  }

  return c.redirect(result.productPath);
});

app.get("/tag/:tag", async (c) => {
  const tag = normalizeTagParam(c.req.param("tag"));
  const sort = c.req.query("sort") === "hot" ? "hot" : "new";

  let items: FeedItem[] = [];
  try {
    items = await getTagFeed(c.env, tag, sort, 50);
  } catch (error) {
    console.error("failed to fetch tag feed", error);
  }

  return c.html(
    <Layout
      title={`#${tag} | ShipSpark`}
      description={`New and hot launches for #${tag}`}
      canonical={toAbsoluteUrl(c.req.url, `/tag/${tag}`)}
    >
      <section class="hero-section relative rounded-xl border border-border bg-card p-6 md:p-10 shadow-lg mb-6">
        <h1 class="text-3xl md:text-5xl font-extrabold tracking-tighter leading-tight"
             style="background: linear-gradient(135deg, var(--color-foreground), var(--color-primary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
          Launches tagged #{tag}
        </h1>
        <p class="mt-4 text-muted-foreground text-sm md:text-base font-light max-w-2xl leading-relaxed">
          Posts are polled every 15 minutes. Switch between New and Hot ranking.
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          <a class={sort === "new" ? "btn-primary" : "btn-secondary"} href={`/tag/${tag}?sort=new`}>
            New
          </a>
          <a class={sort === "hot" ? "btn-primary" : "btn-secondary"} href={`/tag/${tag}?sort=hot`}>
            Hot
          </a>
        </div>
      </section>
      <FeedList items={items} />
    </Layout>
  );
});

app.get("/owner/logout", async (c) => {
  deleteCookie(c, OWNER_SESSION_COOKIE, { path: "/" });
  const next = c.req.query("next");
  if (next && next.startsWith("/")) {
    return c.redirect(next);
  }
  return c.redirect("/");
});

app.get("/claim", async (c) => {
  await expirePendingClaims(c.env);

  return c.html(
    <Layout
      title="Maker Claim | ShipSpark"
      description="Verify ownership and unlock product editing."
      canonical={toAbsoluteUrl(c.req.url, "/claim")}
    >
      <ClaimPage
        notice={c.req.query("notice") ?? undefined}
        error={c.req.query("error") ?? undefined}
        handle={c.req.query("handle") ?? undefined}
        claimToken={c.req.query("claimToken") ?? undefined}
        verifyPostUrl={c.req.query("verifyPostUrl") ?? undefined}
      />
    </Layout>
  );
});

app.post("/claim/start", async (c) => {
  await expirePendingClaims(c.env);
  const form = await c.req.formData();
  const handle = normalizeHandle(`${form.get("handle") ?? ""}`);

  const redirectParams = new URLSearchParams({ handle });
  const fail = (message: string) => c.redirect(`/claim?${redirectParams.toString()}&error=${encodeURIComponent(message)}`);

  if (!isValidHandle(handle)) {
    return fail("Invalid handle format.");
  }

  const db = getDb(c.env.DB);
  const productRows = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.xHandle, handle))
    .orderBy(desc(products.updatedAt))
    .limit(1);

  if (productRows.length === 0) {
    return fail("No product found for this handle. Import at least one launch first.");
  }

  const productId = productRows[0].id;
  await db
    .update(claims)
    .set({ status: "expired" })
    .where(and(eq(claims.xHandle, handle), eq(claims.status, "pending")));

  let token = makeClaimToken();
  let inserted = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await db.insert(claims).values({
        id: crypto.randomUUID(),
        productId,
        xHandle: handle,
        claimToken: token,
        status: "pending",
        verificationLaunchId: null,
        expiresAt: NOW() + CLAIM_TTL_MS,
        createdAt: NOW(),
        verifiedAt: null
      });
      inserted = true;
      break;
    } catch {
      token = makeClaimToken();
    }
  }

  if (!inserted) {
    return fail("Failed to generate claim token.");
  }

  const params = new URLSearchParams({
    handle,
    claimToken: token,
    notice: "Claim token generated. Post it on X and run verification."
  });
  return c.redirect(`/claim?${params.toString()}`);
});

app.post("/claim/verify", async (c) => {
  await expirePendingClaims(c.env);
  const form = await c.req.formData();
  const handle = normalizeHandle(`${form.get("handle") ?? ""}`);
  const requestedClaimToken = `${form.get("claimToken") ?? ""}`.trim();
  const verifyPostUrl = `${form.get("verifyPostUrl") ?? ""}`.trim();

  const baseParams = new URLSearchParams({ handle, verifyPostUrl });
  if (requestedClaimToken) {
    baseParams.set("claimToken", requestedClaimToken);
  }
  const fail = (message: string) =>
    c.redirect(`/claim?${baseParams.toString()}&error=${encodeURIComponent(message)}`);

  if (!isValidHandle(handle)) {
    return fail("Invalid handle format.");
  }

  const parsedPost = parseTweetUrl(verifyPostUrl);
  if (!parsedPost) {
    return fail("Invalid post URL format.");
  }
  if (parsedPost.handle !== handle) {
    return fail("Post URL handle does not match.");
  }

  const db = getDb(c.env.DB);

  const claimRows = requestedClaimToken
    ? await db
        .select({
          id: claims.id,
          claimToken: claims.claimToken,
          expiresAt: claims.expiresAt,
          status: claims.status
        })
        .from(claims)
        .where(
          and(
            eq(claims.xHandle, handle),
            eq(claims.claimToken, requestedClaimToken),
            eq(claims.status, "pending")
          )
        )
        .limit(1)
    : await db
        .select({
          id: claims.id,
          claimToken: claims.claimToken,
          expiresAt: claims.expiresAt,
          status: claims.status
        })
        .from(claims)
        .where(and(eq(claims.xHandle, handle), eq(claims.status, "pending")))
        .orderBy(desc(claims.createdAt))
        .limit(1);
  if (claimRows.length === 0) {
    return fail("No valid pending claim found.");
  }
  const claimToken = claimRows[0].claimToken;
  if (claimRows[0].expiresAt < NOW()) {
    await db.update(claims).set({ status: "expired" }).where(eq(claims.id, claimRows[0].id));
    return fail("Claim token has expired.");
  }

  const bearer = c.env.X_BEARER_TOKEN?.trim();
  if (!bearer) {
    return fail("Cannot verify because X_BEARER_TOKEN is not configured.");
  }

  const tweet = await fetchTweetForClaim(bearer, parsedPost.tweetId);
  if (!tweet) {
    return fail("Could not fetch post data from X API.");
  }
  if (tweet.authorHandle !== handle) {
    return fail("Post author handle does not match.");
  }
  if (!tweet.text.includes(claimToken)) {
    return fail("Claim token is not included in the post text.");
  }

  const hashtags = extractHashtags(tweet.text);
  if (!hashtags.includes(normalizeTag(CAMPAIGN_HASHTAG))) {
    return fail(`Required hashtag is missing. Required: #${CAMPAIGN_HASHTAG}`);
  }

  await db
    .update(claims)
    .set({
      status: "verified",
      verificationLaunchId: null,
      verifiedAt: NOW()
    })
    .where(eq(claims.id, claimRows[0].id));

  await db
    .update(products)
    .set({
      ownerHandle: handle,
      updatedAt: NOW()
    })
    .where(eq(products.xHandle, handle));

  await db
    .update(launches)
    .set({ isMakerPost: true })
    .where(sql`${launches.xUrl} like ${`https://x.com/${handle}/status/%`}`);

  const ownerSessionReady = await setOwnerSessionHandle(c, handle);
  const noticeMessage = ownerSessionReady
    ? "Claim verified. Your posts are now official and edit access is enabled in this browser."
    : "Claim verified. Set SESSION_SECRET to enable browser-based edit sessions.";

  return c.redirect(
    `/claim?${new URLSearchParams({
      handle,
      claimToken,
      verifyPostUrl,
      notice: noticeMessage
    }).toString()}`
  );
});

app.get("/p/:handle/:slug/edit", async (c) => {
  const handle = normalizeHandle(c.req.param("handle"));
  const slug = c.req.param("slug").toLowerCase();
  const db = getDb(c.env.DB);

  const product = await db
    .select({
      id: products.id,
      handle: products.xHandle,
      slug: products.slug,
      name: products.name,
      tagline: products.tagline,
      homepageUrl: products.homepageUrl,
      repoUrl: products.repoUrl
    })
    .from(products)
    .where(and(eq(products.xHandle, handle), eq(products.slug, slug)))
    .limit(1);

  if (product.length === 0) {
    return c.html(
      <Layout title="Not Found | ShipSpark" canonical={toAbsoluteUrl(c.req.url, c.req.path)}>
        <div class="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground bg-card/50">The specified product was not found.</div>
      </Layout>,
      404
    );
  }

  const current = product[0];
  const ownerSessionHandle = await getOwnerSessionHandle(c);
  const canEdit =
    ownerSessionHandle === handle && (await hasVerifiedOwnerClaim(c.env, handle));
  if (!canEdit) {
    return c.html(
      <Layout
        title="Edit Unauthorized | ShipSpark"
        description="Editing requires a verified claim session."
        canonical={toAbsoluteUrl(c.req.url, `/p/${handle}/${slug}/edit`)}
      >
        <section class="rounded-lg border border-border bg-card p-5 md:p-6 shadow-sm">
          <h1 class="text-xl font-bold tracking-tight m-0">You do not have edit access</h1>
          <p class="text-xs text-muted-foreground mt-1">
            Use the same browser where this handle completed claim verification. If not verified yet, start claim below.
          </p>
          <div class="mt-4 flex flex-wrap gap-3">
            <a class="btn-primary" href={`/claim?handle=${handle}`}>
              Open claim page
            </a>
            <a class="btn-secondary" href={`/p/${handle}/${slug}`}>
              Open product page
            </a>
          </div>
        </section>
      </Layout>,
      403
    );
  }

  return c.html(
    <Layout
      title={`Edit ${current.name} | ShipSpark`}
      description={`Edit page for ${current.name}`}
      canonical={toAbsoluteUrl(c.req.url, `/p/${handle}/${slug}/edit`)}
    >
      <ProductEditPage
        handle={current.handle}
        slug={current.slug}
        name={current.name}
        tagline={current.tagline}
        homepageUrl={current.homepageUrl}
        repoUrl={current.repoUrl}
        notice={c.req.query("notice") ?? undefined}
        error={c.req.query("error") ?? undefined}
      />
    </Layout>
  );
});

app.post("/p/:handle/:slug/edit", async (c) => {
  const handle = normalizeHandle(c.req.param("handle"));
  const slug = c.req.param("slug").toLowerCase();
  const db = getDb(c.env.DB);

  const product = await db
    .select({
      id: products.id,
      handle: products.xHandle,
      slug: products.slug,
      name: products.name,
      tagline: products.tagline,
      homepageUrl: products.homepageUrl,
      repoUrl: products.repoUrl
    })
    .from(products)
    .where(and(eq(products.xHandle, handle), eq(products.slug, slug)))
    .limit(1);

  if (product.length === 0) {
    return c.html(
      <Layout title="Not Found | ShipSpark" canonical={toAbsoluteUrl(c.req.url, c.req.path)}>
        <div class="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground bg-card/50">The specified product was not found.</div>
      </Layout>,
      404
    );
  }

  const current = product[0];
  const ownerSessionHandle = await getOwnerSessionHandle(c);
  const canEdit =
    ownerSessionHandle === handle && (await hasVerifiedOwnerClaim(c.env, handle));
  if (!canEdit) {
    return c.html(
      <Layout title="Edit Unauthorized | ShipSpark" canonical={toAbsoluteUrl(c.req.url, `/p/${handle}/${slug}/edit`)}>
        <section class="rounded-lg border border-border bg-card p-5 md:p-6 shadow-sm">
          <h1 class="text-xl font-bold tracking-tight m-0">You do not have edit access</h1>
          <p class="text-xs text-muted-foreground mt-1">Please retry with a verified claim session.</p>
          <div class="mt-4 flex flex-wrap gap-3">
            <a class="btn-primary" href={`/claim?handle=${handle}`}>
              Open claim page
            </a>
          </div>
        </section>
      </Layout>,
      403
    );
  }

  const form = await c.req.formData();
  const name = sanitizeDisplayText(`${form.get("name") ?? ""}`);
  const taglineRaw = sanitizeDisplayText(`${form.get("tagline") ?? ""}`);
  const homepageRaw = `${form.get("homepageUrl") ?? ""}`;
  const repoRaw = `${form.get("repoUrl") ?? ""}`;

  const homepageParsed = parseOptionalHttpUrl(homepageRaw);
  const repoParsed = parseOptionalHttpUrl(repoRaw);

  if (!name) {
    return c.html(
      <Layout title={`Edit ${current.name} | ShipSpark`} canonical={toAbsoluteUrl(c.req.url, `/p/${handle}/${slug}/edit`)}>
        <ProductEditPage
          handle={handle}
          slug={slug}
          name={name}
          tagline={taglineRaw || null}
          homepageUrl={homepageRaw || null}
          repoUrl={repoRaw || null}
          error="Name is required."
        />
      </Layout>,
      400
    );
  }

  if (!homepageParsed.ok || !repoParsed.ok) {
    return c.html(
      <Layout title={`Edit ${current.name} | ShipSpark`} canonical={toAbsoluteUrl(c.req.url, `/p/${handle}/${slug}/edit`)}>
        <ProductEditPage
          handle={handle}
          slug={slug}
          name={name}
          tagline={taglineRaw || null}
          homepageUrl={homepageRaw || null}
          repoUrl={repoRaw || null}
          error="URLs must use http or https."
        />
      </Layout>,
      400
    );
  }

  await db
    .update(products)
    .set({
      name,
      tagline: taglineRaw || null,
      homepageUrl: homepageParsed.value,
      repoUrl: repoParsed.value,
      updatedAt: NOW()
    })
    .where(eq(products.id, current.id));

  return c.redirect(
    `/p/${handle}/${slug}/edit?notice=${encodeURIComponent("Updated successfully.")}`
  );
});

app.get("/p/:handle/:slug", async (c) => {
  const handle = normalizeHandle(c.req.param("handle"));
  const slug = c.req.param("slug").toLowerCase();
  const db = getDb(c.env.DB);

  const product = await db
    .select({
      id: products.id,
      handle: products.xHandle,
      slug: products.slug,
      name: products.name,
      tagline: products.tagline,
      homepageUrl: products.homepageUrl,
      repoUrl: products.repoUrl
    })
    .from(products)
    .where(and(eq(products.xHandle, handle), eq(products.slug, slug)))
    .limit(1);

  if (product.length === 0) {
    return c.html(
      <Layout title="Not Found | ShipSpark" canonical={toAbsoluteUrl(c.req.url, c.req.path)}>
        <div class="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground bg-card/50">
          Product not found. Check the handle and product ID.
        </div>
      </Layout>,
      404
    );
  }

  const current = product[0];
  const ownerSessionHandle = await getOwnerSessionHandle(c);
  const canEdit =
    ownerSessionHandle === handle && (await hasVerifiedOwnerClaim(c.env, handle));
  await bumpClicks(c.env, current.id);

  const launchRows = await db
    .select({
      id: launches.id,
      xUrl: launches.xUrl,
      rawText: launches.rawText,
      isMakerPost: launches.isMakerPost,
      ingestedAt: launches.ingestedAt
    })
    .from(launches)
    .where(eq(launches.productId, current.id))
    .orderBy(desc(launches.ingestedAt))
    .limit(20);

  const description =
    current.tagline ?? `SEO-friendly page for ${current.name} launch posts and X thread links.`;

  return c.html(
    <Layout
      title={`${current.name} | ShipSpark`}
      description={description}
      canonical={toAbsoluteUrl(c.req.url, `/p/${current.handle}/${current.slug}`)}
    >
      <section class="hero-section relative rounded-xl border border-border bg-card p-6 md:p-10 shadow-lg mb-6">
        <h1 class="text-3xl md:text-5xl font-extrabold tracking-tighter leading-tight"
             style="background: linear-gradient(135deg, var(--color-foreground), var(--color-primary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
          {current.name}
        </h1>
        <p class="mt-4 text-muted-foreground text-sm md:text-base font-light max-w-2xl leading-relaxed" style="white-space: pre-wrap;">{current.tagline ?? "No tagline yet."}</p>
        <div class="mt-6 flex flex-wrap gap-3">
          <a class="btn-secondary" href={`https://x.com/${current.handle}`} target="_blank" rel="noreferrer">
            <Icon d={ICONS.externalLink} size={14} /> @{current.handle}
          </a>
          {current.homepageUrl ? (
            <a class="btn-secondary" href={current.homepageUrl} target="_blank" rel="noreferrer">
              <Icon d={ICONS.link} size={14} /> Homepage
            </a>
          ) : null}
          {current.repoUrl ? (
            <a class="btn-secondary" href={current.repoUrl} target="_blank" rel="noreferrer">
              <Icon d={ICONS.link} size={14} /> Repo
            </a>
          ) : null}
          {canEdit ? (
            <a class="btn-primary" href={`/p/${current.handle}/${current.slug}/edit`}>
              <Icon d={ICONS.edit} size={14} /> Edit
            </a>
          ) : null}
        </div>
      </section>

      <h2 class="section-heading text-xl font-bold tracking-tight mt-6 mb-3">Launch Posts</h2>
      {launchRows.length === 0 ? (
        <div class="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground bg-card/50">
          No posts have been imported yet.
        </div>
      ) : (
        <ul class="list-none m-0 p-0 grid gap-3">
          {launchRows.map((launch) => (
            <li class="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div class="flex items-center justify-between gap-3">
                <span class="text-xs text-muted-foreground">{formatJst(launch.ingestedAt)}</span>
                {launch.isMakerPost ? <span class="badge">Official</span> : null}
              </div>
              <p class="mt-2 text-sm text-muted-foreground leading-relaxed" style="white-space: pre-wrap;">{launch.rawText}</p>
              <a class="btn-secondary mt-3 text-xs" href={launch.xUrl} target="_blank" rel="noreferrer">
                <Icon d={ICONS.externalLink} size={12} /> View on X
              </a>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
});

app.get("/sitemap.xml", async (c) => {
  const db = getDb(c.env.DB);
  const allProducts = await db.select({ handle: products.xHandle, slug: products.slug }).from(products).limit(5000);
  const origin = new URL(c.req.url).origin;

  const urls = [
    `${origin}/`,
    `${origin}/tag/${normalizeTag(CAMPAIGN_HASHTAG)}`,
    ...allProducts.map((item) => `${origin}/p/${item.handle}/${item.slug}`)
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${url}</loc></url>`)
    .join("\n")}\n</urlset>`;

  c.header("content-type", "application/xml; charset=utf-8");
  return c.body(xml);
});

app.get("/robots.txt", (c) => {
  const origin = new URL(c.req.url).origin;
  const robots = `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
  c.header("content-type", "text/plain; charset=utf-8");
  return c.body(robots);
});

app.post("/api/ingest", async (c) => {
  if (!isApiIngestAuthorized(c)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const payload = await c.req.json<IngestPayload>().catch(() => null);
  if (!payload) {
    return c.json({ error: "invalid json payload" }, 400);
  }

  const result = await ingestLaunchPayload(c.env, payload);
  if (!result.ok) {
    return new Response(JSON.stringify(result), {
      status: result.status,
      headers: {
        "content-type": "application/json; charset=utf-8"
      }
    });
  }

  return c.json(result);
});

app.post("/api/products/:productId/vote", async (c) => {
  const productId = c.req.param("productId");
  const db = getDb(c.env.DB);

  const target = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
  if (target.length === 0) {
    return c.json({ error: "product not found" }, 404);
  }

  const fingerprint = await buildVoteFingerprint(c);
  const voteDate = new Date().toISOString().slice(0, 10);
  const existing = await db
    .select({ id: votes.id })
    .from(votes)
    .where(and(eq(votes.productId, productId), eq(votes.fingerprint, fingerprint), eq(votes.voteDate, voteDate)))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ ok: true, accepted: false, reason: "already voted today" });
  }

  await db.insert(votes).values({
    id: crypto.randomUUID(),
    productId,
    fingerprint,
    voteDate,
    createdAt: NOW()
  });
  await ensureMetricRow(c.env, productId);
  await db
    .update(productMetrics)
    .set({
      upvoteCount: sql`${productMetrics.upvoteCount} + 1`,
      updatedAt: NOW()
    })
    .where(eq(productMetrics.productId, productId));

  return c.json({ ok: true, accepted: true });
});

app.post("/api/products/:productId/click", async (c) => {
  const productId = c.req.param("productId");
  const db = getDb(c.env.DB);
  const target = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
  if (target.length === 0) {
    return c.json({ error: "product not found" }, 404);
  }

  await bumpClicks(c.env, productId);
  return c.json({ ok: true });
});

const worker: ExportedHandler<Bindings> = {
  fetch: app.fetch,
  scheduled: async (event, env, ctx) => {
    ctx.waitUntil(runIngestionPolling(env, event.cron));
  }
};

export default worker;

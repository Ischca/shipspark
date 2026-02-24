import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    xHandle: text("x_handle").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline"),
    homepageUrl: text("homepage_url"),
    repoUrl: text("repo_url"),
    ownerHandle: text("owner_handle"),
    imageKey: text("image_key"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull()
  },
  (table) => ({
    uniqHandleSlug: uniqueIndex("products_handle_slug_unique").on(table.xHandle, table.slug)
  })
);

export const productMetrics = sqliteTable("product_metrics", {
  productId: text("product_id")
    .primaryKey()
    .references(() => products.id, { onDelete: "cascade" }),
  upvoteCount: integer("upvote_count", { mode: "number" }).notNull().default(0),
  clickCount: integer("click_count", { mode: "number" }).notNull().default(0),
  updatedAt: integer("updated_at", { mode: "number" }).notNull()
});

export const launches = sqliteTable(
  "launches",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    xUrl: text("x_url").notNull(),
    xPostId: text("x_post_id"),
    authorName: text("author_name"),
    authorUrl: text("author_url"),
    rawText: text("raw_text").notNull(),
    hashtags: text("hashtags").notNull(),
    isMakerPost: integer("is_maker_post", { mode: "boolean" }).notNull().default(false),
    ingestedAt: integer("ingested_at", { mode: "number" }).notNull()
  },
  (table) => ({
    uniqXUrl: uniqueIndex("launches_x_url_unique").on(table.xUrl)
  })
);

export const claims = sqliteTable(
  "claims",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    xHandle: text("x_handle").notNull(),
    claimToken: text("claim_token").notNull(),
    status: text("status").notNull(),
    verificationLaunchId: text("verification_launch_id").references(() => launches.id),
    expiresAt: integer("expires_at", { mode: "number" }).notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    verifiedAt: integer("verified_at", { mode: "number" })
  },
  (table) => ({
    uniqClaimToken: uniqueIndex("claims_token_unique").on(table.claimToken)
  })
);

export const votes = sqliteTable(
  "votes",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    voteDate: text("vote_date").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull()
  },
  (table) => ({
    uniqVote: uniqueIndex("votes_product_fingerprint_date_unique").on(
      table.productId,
      table.fingerprint,
      table.voteDate
    )
  })
);

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  fingerprint: text("fingerprint"),
  createdAt: integer("created_at", { mode: "number" }).notNull()
});

export const launchMedia = sqliteTable(
  "launch_media",
  {
    id: text("id").primaryKey(),
    launchId: text("launch_id")
      .notNull()
      .references(() => launches.id, { onDelete: "cascade" }),
    mediaKey: text("media_key").notNull(),
    type: text("type").notNull(),
    url: text("url").notNull(),
    previewUrl: text("preview_url"),
    width: integer("width"),
    height: integer("height"),
    createdAt: integer("created_at", { mode: "number" }).notNull()
  },
  (table) => ({
    launchIdx: index("launch_media_launch_id").on(table.launchId)
  })
);

export const ingestState = sqliteTable("ingest_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull()
});

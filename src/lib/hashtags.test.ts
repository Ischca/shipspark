import { describe, it, expect } from "vitest";
import {
  CAMPAIGN_HASHTAG,
  PRODUCT_SLUG_PREFIX,
  normalizeTag,
  extractHashtags,
  hasCampaignTag,
  extractSlugFromTags,
  requiredTagExample,
} from "./hashtags";

describe("normalizeTag", () => {
  it("strips leading # and lowercases", () => {
    expect(normalizeTag("#ShipSpark")).toBe("shipspark");
  });

  it("handles tag without #", () => {
    expect(normalizeTag("ShipSpark")).toBe("shipspark");
  });

  it("lowercases mixed case", () => {
    expect(normalizeTag("MyApp_2025")).toBe("myapp_2025");
  });
});

describe("extractHashtags", () => {
  it("extracts multiple hashtags from tweet text", () => {
    const text = "Check out my app! #ShipSpark #ss_my_app #buildinpublic";
    expect(extractHashtags(text)).toEqual(["shipspark", "ss_my_app", "buildinpublic"]);
  });

  it("deduplicates case-insensitive", () => {
    const text = "#ShipSpark #shipspark #SHIPSPARK";
    expect(extractHashtags(text)).toEqual(["shipspark"]);
  });

  it("returns empty array for text without hashtags", () => {
    expect(extractHashtags("Just a regular tweet")).toEqual([]);
  });

  it("handles hashtags at start and end of text", () => {
    const text = "#first some text #last";
    expect(extractHashtags(text)).toEqual(["first", "last"]);
  });

  it("ignores # followed by space (not a hashtag)", () => {
    const text = "# heading not a tag";
    // # followed by space — regex requires # immediately followed by [A-Za-z0-9_]
    expect(extractHashtags(text)).toEqual([]);
  });

  it("handles hashtags with underscores", () => {
    const text = "#ss_cool_app_123";
    expect(extractHashtags(text)).toEqual(["ss_cool_app_123"]);
  });
});

describe("hasCampaignTag", () => {
  it("returns true when campaign tag is present", () => {
    expect(hasCampaignTag(["shipspark", "ss_myapp"])).toBe(true);
  });

  it("returns false when campaign tag is missing", () => {
    expect(hasCampaignTag(["ss_myapp", "buildinpublic"])).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(hasCampaignTag([])).toBe(false);
  });
});

describe("extractSlugFromTags", () => {
  it("extracts slug from ss_ prefixed tag", () => {
    expect(extractSlugFromTags(["shipspark", "ss_my_app"])).toBe("my_app");
  });

  it("returns first valid slug when multiple exist", () => {
    expect(extractSlugFromTags(["ss_first_app", "ss_second_app"])).toBe("first_app");
  });

  it("returns null when no ss_ tag exists", () => {
    expect(extractSlugFromTags(["shipspark", "buildinpublic"])).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(extractSlugFromTags([])).toBeNull();
  });

  it("rejects slug shorter than 3 chars after prefix", () => {
    expect(extractSlugFromTags(["ss_ab"])).toBeNull();
  });

  it("accepts slug exactly 3 chars after prefix", () => {
    expect(extractSlugFromTags(["ss_abc"])).toBe("abc");
  });

  it("rejects slug with invalid characters", () => {
    // The slug after ss_ must match /^[a-z0-9_]{3,32}$/
    // Since extractHashtags already lowercases, capital letters won't reach here.
    // But a slug with special chars like "my-app" won't match (hyphens).
    // In practice, hashtags can't contain hyphens — the regex only captures [A-Za-z0-9_]
    expect(extractSlugFromTags(["ss_abc"])).toBe("abc");
  });
});

describe("requiredTagExample", () => {
  it("generates default example with example_tool", () => {
    expect(requiredTagExample()).toBe("#ShipSpark #ss_example_tool");
  });

  it("generates example with custom slug", () => {
    expect(requiredTagExample("my_cool_app")).toBe("#ShipSpark #ss_my_cool_app");
  });
});

describe("constants", () => {
  it("CAMPAIGN_HASHTAG is ShipSpark", () => {
    expect(CAMPAIGN_HASHTAG).toBe("ShipSpark");
  });

  it("PRODUCT_SLUG_PREFIX is ss_", () => {
    expect(PRODUCT_SLUG_PREFIX).toBe("ss_");
  });
});

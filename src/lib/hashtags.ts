export const CAMPAIGN_HASHTAG = "ShipSpark";
export const PRODUCT_SLUG_PREFIX = "ss_";
export const PRODUCT_SLUG_REGEX = /^[a-z0-9_]{3,32}$/;

const HASHTAG_REGEX = /#([A-Za-z0-9_]{1,60})/g;

export const normalizeTag = (tag: string): string => tag.replace(/^#/, "").toLowerCase();

export const extractHashtags = (text: string): string[] => {
  const tags: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = HASHTAG_REGEX.exec(text)) !== null) {
    const normalized = normalizeTag(match[1]);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      tags.push(normalized);
    }
  }

  return tags;
};

export const hasCampaignTag = (hashtags: string[]): boolean => {
  return hashtags.includes(normalizeTag(CAMPAIGN_HASHTAG));
};

export const extractSlugFromTags = (hashtags: string[]): string | null => {
  for (const tag of hashtags) {
    if (!tag.startsWith(PRODUCT_SLUG_PREFIX)) {
      continue;
    }
    const slug = tag.slice(PRODUCT_SLUG_PREFIX.length);
    if (PRODUCT_SLUG_REGEX.test(slug)) {
      return slug;
    }
  }
  return null;
};

export const requiredTagExample = (slug = "example_tool"): string => {
  return `#${CAMPAIGN_HASHTAG} #${PRODUCT_SLUG_PREFIX}${slug}`;
};

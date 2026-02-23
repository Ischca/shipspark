type ParsedFields = {
  name?: string;
  tagline?: string;
  homepageUrl?: string;
  repoUrl?: string;
};

const pickField = (pattern: RegExp, rawText: string): string | undefined => {
  const match = rawText.match(pattern);
  if (!match?.[1]) {
    return undefined;
  }
  return match[1].trim();
};

export const parseTemplateFields = (rawText: string): ParsedFields => {
  return {
    name: pickField(/^\s*(?:name|title)\s*:\s*(.+)$/im, rawText),
    tagline: pickField(/^\s*(?:tagline|one-liner|oneliner)\s*:\s*(.+)$/im, rawText),
    homepageUrl: pickField(/^\s*(?:url|homepage|site)\s*:\s*(https?:\/\/\S+)$/im, rawText),
    repoUrl: pickField(/^\s*(?:repo|github)\s*:\s*(https?:\/\/\S+)$/im, rawText)
  };
};

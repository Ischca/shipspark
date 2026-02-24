import { describe, it, expect } from "vitest";
import { parseTemplateFields } from "./parser";

describe("parseTemplateFields", () => {
  it("parses full template with all fields", () => {
    const text = [
      "name: My Awesome App",
      "tagline: Build things faster",
      "url: https://example.com",
      "repo: https://github.com/owner/repo",
      "#ShipSpark #ss_my_app",
    ].join("\n");

    const result = parseTemplateFields(text);
    expect(result).toEqual({
      name: "My Awesome App",
      tagline: "Build things faster",
      homepageUrl: "https://example.com",
      repoUrl: "https://github.com/owner/repo",
    });
  });

  it("parses name only", () => {
    const result = parseTemplateFields("name: Cool Tool\n#ShipSpark #ss_cool");
    expect(result.name).toBe("Cool Tool");
    expect(result.tagline).toBeUndefined();
    expect(result.homepageUrl).toBeUndefined();
    expect(result.repoUrl).toBeUndefined();
  });

  it("parses title as name alias", () => {
    const result = parseTemplateFields("title: My Product");
    expect(result.name).toBe("My Product");
  });

  it("parses one-liner as tagline alias", () => {
    const result = parseTemplateFields("one-liner: Quick description");
    expect(result.tagline).toBe("Quick description");
  });

  it("parses oneliner as tagline alias", () => {
    const result = parseTemplateFields("oneliner: Quick description");
    expect(result.tagline).toBe("Quick description");
  });

  it("parses homepage as url alias", () => {
    const result = parseTemplateFields("homepage: https://example.com");
    expect(result.homepageUrl).toBe("https://example.com");
  });

  it("parses site as url alias", () => {
    const result = parseTemplateFields("site: https://example.com");
    expect(result.homepageUrl).toBe("https://example.com");
  });

  it("parses github as repo alias", () => {
    const result = parseTemplateFields("github: https://github.com/user/repo");
    expect(result.repoUrl).toBe("https://github.com/user/repo");
  });

  it("returns all undefined for plain text without template", () => {
    const result = parseTemplateFields("Just a regular tweet #ShipSpark");
    expect(result).toEqual({
      name: undefined,
      tagline: undefined,
      homepageUrl: undefined,
      repoUrl: undefined,
    });
  });

  it("trims field values", () => {
    const result = parseTemplateFields("name:   Spaced Out App   ");
    expect(result.name).toBe("Spaced Out App");
  });

  it("is case-insensitive for field names", () => {
    const result = parseTemplateFields("Name: My App\nTagline: Tagline here\nURL: https://x.com\nRepo: https://github.com/x/y");
    expect(result.name).toBe("My App");
    expect(result.tagline).toBe("Tagline here");
    expect(result.homepageUrl).toBe("https://x.com");
    expect(result.repoUrl).toBe("https://github.com/x/y");
  });

  it("ignores non-http URLs for homepage", () => {
    const result = parseTemplateFields("url: ftp://example.com");
    expect(result.homepageUrl).toBeUndefined();
  });

  it("accepts http URLs", () => {
    const result = parseTemplateFields("url: http://example.com");
    expect(result.homepageUrl).toBe("http://example.com");
  });

  it("handles leading whitespace on lines", () => {
    const result = parseTemplateFields("  name: Indented App");
    expect(result.name).toBe("Indented App");
  });
});

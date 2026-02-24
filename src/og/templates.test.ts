import { describe, it, expect } from "vitest";
import { buildSiteOgSvg, buildProductOgSvg } from "./templates";

describe("buildSiteOgSvg", () => {
  const svg = buildSiteOgSvg();

  it("returns a valid SVG string", () => {
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("has correct dimensions", () => {
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
  });

  it("includes ShipSpark brand", () => {
    expect(svg).toContain("ShipSpark");
  });

  it("includes indie launch board subtitle", () => {
    expect(svg).toContain("indie launch board");
  });

  it("includes headline text", () => {
    expect(svg).toContain("Post on X.");
    expect(svg).toContain("Get listed automatically.");
  });

  it("includes #ShipSpark hashtag", () => {
    expect(svg).toContain("#ShipSpark");
  });

  it("includes #ss_your_product example", () => {
    expect(svg).toContain("#ss_your_product");
  });

  it("includes upvote & discover label", () => {
    expect(svg).toContain("upvote &amp; discover");
  });

  it("includes shipspark.net URL", () => {
    expect(svg).toContain("shipspark.net");
  });
});

describe("buildProductOgSvg", () => {
  it("renders product name", () => {
    const svg = buildProductOgSvg({ name: "TestProduct", tagline: null, handle: "testuser" });
    expect(svg).toContain("TestProduct");
  });

  it("renders handle with @", () => {
    const svg = buildProductOgSvg({ name: "Product", tagline: null, handle: "devuser" });
    expect(svg).toContain("@devuser");
  });

  it("renders tagline when provided", () => {
    const svg = buildProductOgSvg({
      name: "MyApp",
      tagline: "Build things faster",
      handle: "maker",
    });
    expect(svg).toContain("Build things faster");
  });

  it("omits tagline section when null", () => {
    const svg = buildProductOgSvg({ name: "MyApp", tagline: null, handle: "maker" });
    expect(svg).not.toContain("<!-- Tagline -->");
  });

  it("includes LISTED badge", () => {
    const svg = buildProductOgSvg({ name: "Product", tagline: null, handle: "user" });
    expect(svg).toContain("LISTED");
  });

  it("includes ShipSpark brand bar", () => {
    const svg = buildProductOgSvg({ name: "Product", tagline: null, handle: "user" });
    expect(svg).toContain("ShipSpark");
    expect(svg).toContain("indie launch board");
  });

  it("includes shipspark.net URL", () => {
    const svg = buildProductOgSvg({ name: "Product", tagline: null, handle: "user" });
    expect(svg).toContain("shipspark.net");
  });

  it("escapes XML special characters in name", () => {
    const svg = buildProductOgSvg({ name: "A & B <C>", tagline: null, handle: "user" });
    expect(svg).toContain("A &amp; B &lt;C&gt;");
    expect(svg).not.toContain("A & B <C>");
  });

  it("escapes XML special characters in tagline", () => {
    const svg = buildProductOgSvg({
      name: "Product",
      tagline: 'Say "hello" & <goodbye>',
      handle: "user",
    });
    expect(svg).toContain("Say &quot;hello&quot; &amp; &lt;goodbye&gt;");
  });

  it("truncates long product names", () => {
    const longName = "A".repeat(50);
    const svg = buildProductOgSvg({ name: longName, tagline: null, handle: "user" });
    // truncateText(name, 36) → 35 chars + ellipsis
    expect(svg).toContain("A".repeat(35) + "\u2026");
    expect(svg).not.toContain("A".repeat(50));
  });

  it("truncates long taglines", () => {
    const longTagline = "B".repeat(100);
    const svg = buildProductOgSvg({ name: "Prod", tagline: longTagline, handle: "user" });
    expect(svg).toContain("B".repeat(79) + "\u2026");
    expect(svg).not.toContain("B".repeat(100));
  });

  it("uses smaller font for long names", () => {
    const shortName = "Short";
    const longName = "A Very Long Product Name That Is Over 24";
    const svgShort = buildProductOgSvg({ name: shortName, tagline: null, handle: "u" });
    const svgLong = buildProductOgSvg({ name: longName, tagline: null, handle: "u" });
    expect(svgShort).toContain('font-size="60"');
    expect(svgLong).toContain('font-size="48"');
  });

  it("has correct SVG dimensions", () => {
    const svg = buildProductOgSvg({ name: "P", tagline: null, handle: "u" });
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
  });

  describe("with image", () => {
    const imageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

    it("renders image element when imageBase64 is provided", () => {
      const svg = buildProductOgSvg({
        name: "Product",
        tagline: null,
        handle: "user",
        imageBase64,
      });
      expect(svg).toContain("<image");
      expect(svg).toContain(`href="${imageBase64}"`);
    });

    it("applies clip-path for rounded corners", () => {
      const svg = buildProductOgSvg({
        name: "Product",
        tagline: null,
        handle: "user",
        imageBase64,
      });
      expect(svg).toContain("<clipPath");
      expect(svg).toContain('clip-path="url(#product-img-clip)"');
    });

    it("includes preserveAspectRatio for cover fit", () => {
      const svg = buildProductOgSvg({
        name: "Product",
        tagline: null,
        handle: "user",
        imageBase64,
      });
      expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
    });

    it("renders background rect with border for the image area", () => {
      const svg = buildProductOgSvg({
        name: "Product",
        tagline: null,
        handle: "user",
        imageBase64,
      });
      // Should have a background rect with border (the frame behind the image)
      expect(svg).toContain('rx="20"');
      expect(svg).toContain('stroke="#22d3ee"');
    });

    it("does not render image section when imageBase64 is undefined", () => {
      const svg = buildProductOgSvg({
        name: "Product",
        tagline: null,
        handle: "user",
      });
      expect(svg).not.toContain("<image");
      expect(svg).not.toContain("<clipPath");
    });
  });
});

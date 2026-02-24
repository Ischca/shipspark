import { describe, it, expect } from "vitest";
import { escapeXml, truncateText } from "./utils";

describe("escapeXml", () => {
  it("escapes ampersands", () => {
    expect(escapeXml("A & B")).toBe("A &amp; B");
  });

  it("escapes less-than", () => {
    expect(escapeXml("<tag>")).toBe("&lt;tag&gt;");
  });

  it("escapes greater-than", () => {
    expect(escapeXml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(escapeXml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeXml("it's")).toBe("it&apos;s");
  });

  it("escapes all special characters together", () => {
    expect(escapeXml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&apos;y&apos;&gt;&amp;&lt;/a&gt;"
    );
  });

  it("returns clean text unchanged", () => {
    expect(escapeXml("Hello World 123")).toBe("Hello World 123");
  });

  it("handles empty string", () => {
    expect(escapeXml("")).toBe("");
  });
});

describe("truncateText", () => {
  it("returns short text unchanged", () => {
    expect(truncateText("hello", 10)).toBe("hello");
  });

  it("returns text at exact length unchanged", () => {
    expect(truncateText("hello", 5)).toBe("hello");
  });

  it("truncates long text with ellipsis", () => {
    const result = truncateText("This is a long product name", 10);
    expect(result).toBe("This is a\u2026");
    expect(result.length).toBe(10);
  });

  it("uses unicode ellipsis (…)", () => {
    const result = truncateText("ABCDEFGH", 5);
    expect(result).toBe("ABCD\u2026");
    expect(result.endsWith("\u2026")).toBe(true);
  });

  it("handles single character max", () => {
    const result = truncateText("Hello", 1);
    expect(result).toBe("\u2026");
  });

  it("handles empty string", () => {
    expect(truncateText("", 10)).toBe("");
  });
});

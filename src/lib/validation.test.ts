import { describe, it, expect } from "vitest";
import {
  normalizeHandle,
  isValidHandle,
  isValidSlug,
  sanitizeDisplayText,
  normalizeTagParam,
} from "./validation";

describe("normalizeHandle", () => {
  it("trims whitespace", () => {
    expect(normalizeHandle("  user123  ")).toBe("user123");
  });

  it("lowercases", () => {
    expect(normalizeHandle("UserName")).toBe("username");
  });

  it("strips leading @", () => {
    expect(normalizeHandle("@user123")).toBe("user123");
  });

  it("handles @ with spaces", () => {
    expect(normalizeHandle("  @User  ")).toBe("user");
  });

  it("handles empty string", () => {
    expect(normalizeHandle("")).toBe("");
  });
});

describe("isValidHandle", () => {
  it("accepts lowercase alphanumeric with underscores", () => {
    expect(isValidHandle("user_123")).toBe(true);
  });

  it("accepts single character", () => {
    expect(isValidHandle("a")).toBe(true);
  });

  it("accepts 15 characters (max)", () => {
    expect(isValidHandle("a".repeat(15))).toBe(true);
  });

  it("rejects 16 characters (too long)", () => {
    expect(isValidHandle("a".repeat(16))).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidHandle("")).toBe(false);
  });

  it("rejects uppercase", () => {
    expect(isValidHandle("UserName")).toBe(false);
  });

  it("rejects hyphens", () => {
    expect(isValidHandle("user-name")).toBe(false);
  });

  it("rejects spaces", () => {
    expect(isValidHandle("user name")).toBe(false);
  });

  it("rejects dots", () => {
    expect(isValidHandle("user.name")).toBe(false);
  });
});

describe("isValidSlug", () => {
  it("accepts valid slug", () => {
    expect(isValidSlug("my_cool_app")).toBe(true);
  });

  it("accepts 3 characters (minimum)", () => {
    expect(isValidSlug("abc")).toBe(true);
  });

  it("accepts 32 characters (maximum)", () => {
    expect(isValidSlug("a".repeat(32))).toBe(true);
  });

  it("rejects 2 characters (too short)", () => {
    expect(isValidSlug("ab")).toBe(false);
  });

  it("rejects 33 characters (too long)", () => {
    expect(isValidSlug("a".repeat(33))).toBe(false);
  });

  it("rejects hyphens", () => {
    expect(isValidSlug("my-app")).toBe(false);
  });

  it("rejects uppercase", () => {
    expect(isValidSlug("MyApp")).toBe(false);
  });

  it("accepts underscores and digits", () => {
    expect(isValidSlug("app_2025_v1")).toBe(true);
  });
});

describe("sanitizeDisplayText", () => {
  it("returns clean text unchanged", () => {
    expect(sanitizeDisplayText("Hello World")).toBe("Hello World");
  });

  it("trims whitespace", () => {
    expect(sanitizeDisplayText("  hello  ")).toBe("hello");
  });

  it("strips zero-width spaces", () => {
    expect(sanitizeDisplayText("hello\u200Bworld")).toBe("helloworld");
  });

  it("strips control characters", () => {
    expect(sanitizeDisplayText("hello\u0000world")).toBe("helloworld");
  });

  it("normalizes NFKC", () => {
    // Full-width "Ａ" → "A"
    expect(sanitizeDisplayText("\uFF21")).toBe("A");
  });

  it("strips FEFF (BOM)", () => {
    expect(sanitizeDisplayText("\uFEFFhello")).toBe("hello");
  });
});

describe("normalizeTagParam", () => {
  it("strips # and lowercases", () => {
    expect(normalizeTagParam("#ShipSpark")).toBe("shipspark");
  });

  it("trims and lowercases", () => {
    expect(normalizeTagParam("  MyTag  ")).toBe("mytag");
  });

  it("handles empty string", () => {
    expect(normalizeTagParam("")).toBe("");
  });

  it("normalizes NFKC", () => {
    expect(normalizeTagParam("#\uFF21\uFF22\uFF23")).toBe("abc");
  });
});

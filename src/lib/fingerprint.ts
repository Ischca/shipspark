import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import type { HonoEnv } from "../types";

const VISITOR_COOKIE = "sn_vid";

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const hashString = async (value: string): Promise<string> => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
};

export const getOrSetVisitorId = (c: Context<HonoEnv>): string => {
  const existing = getCookie(c, VISITOR_COOKIE);
  if (existing) {
    return existing;
  }

  const created = crypto.randomUUID();
  const isSecure = new URL(c.req.url).protocol === "https:";

  setCookie(c, VISITOR_COOKIE, created, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isSecure,
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });

  return created;
};

export const buildVoteFingerprint = async (c: Context<HonoEnv>): Promise<string> => {
  const visitorId = getOrSetVisitorId(c);
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown-ip";
  const userAgent = c.req.header("User-Agent") ?? "unknown-ua";
  return hashString(`${visitorId}|${ip}|${userAgent}`);
};

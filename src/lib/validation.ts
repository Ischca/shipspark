const X_HANDLE_REGEX = /^[a-z0-9_]{1,15}$/;
const SLUG_REGEX = /^[a-z0-9_]{3,32}$/;
const INVISIBLE_OR_CONTROL_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g;

export const normalizeHandle = (value: string): string => value.trim().toLowerCase().replace(/^@/, "");

export const isValidHandle = (value: string): boolean => X_HANDLE_REGEX.test(value);

export const isValidSlug = (value: string): boolean => SLUG_REGEX.test(value);

export const sanitizeDisplayText = (value: string): string =>
  value.normalize("NFKC").replace(INVISIBLE_OR_CONTROL_REGEX, "").trim();

export const normalizeTagParam = (value: string): string =>
  value.normalize("NFKC").replace(/^#/, "").toLowerCase().trim();

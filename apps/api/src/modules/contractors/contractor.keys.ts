/** Server-owned duplicate keys. Pure, so they are testable and identical wherever they are computed. */

const SUFFIX_TOKENS = new Set(["pvt", "private", "ltd", "limited", "co", "company", "inc", "plc", "llc"]);

export function nameKeyOf(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token && !SUFFIX_TOKENS.has(token))
    .join(" ");
}

export const taxIdKeyOf = (taxId: string | undefined | null): string | undefined => {
  const key = (taxId ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return key || undefined;
};

export const emailKeyOf = (email: string | undefined | null): string | undefined => {
  const key = (email ?? "").trim().toLowerCase();
  return key || undefined;
};

export const registrationNumberOf = (value: string): string => value.trim().toUpperCase();

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

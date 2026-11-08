/**
 * METADATA search only: titles, document numbers, references, tags, file names and descriptions.
 * Document CONTENT search (extraction, chunking, embeddings) arrives with Batch 09/10 semantic retrieval. Nothing here claims otherwise.
 */

export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const DOC_NO = /^DOC-\d{4}-\d{6}$/i;
export const MAX_QUERY = 200;
const MAX_PATTERN = 60;

export function tokens(q: string): string[] {
  return [...new Set(q.normalize("NFC").toLowerCase().split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean))].slice(0, 8);
}

export type TextPlan =
  | { mode: "none" }
  | { mode: "docNo"; filter: Record<string, unknown> }
  | { mode: "text"; filter: Record<string, unknown>; prefix: Record<string, unknown> }
  | { mode: "prefix"; filter: Record<string, unknown> };

/** Anchored, escaped, length-capped prefix match. Never a user-supplied regex. */
export function prefixFilter(q: string): Record<string, unknown> {
  const pattern = `^${escapeRegex(q.trim().slice(0, MAX_PATTERN))}`;
  const rx = new RegExp(pattern, "i");
  return { $or: [{ title: rx }, { docNo: rx }, { reference: rx }] };
}

/**
 * `docNo` exact match always wins. Short queries (<= 3 characters) use the prefix path. Longer ones use MongoDB `$text` for relevance;
 * the service falls back to `prefix` when `$text` finds nothing.
 */
export function planText(raw: string | undefined): TextPlan {
  const q = (raw ?? "").normalize("NFC").trim().slice(0, MAX_QUERY);
  if (!q) return { mode: "none" };
  if (DOC_NO.test(q)) return { mode: "docNo", filter: { docNo: q.toUpperCase() } };
  const prefix = prefixFilter(q);
  if (q.length <= 3) return { mode: "prefix", filter: prefix };
  // Each term is quoted so $text treats operators (-, quotes) from the user as literal words.
  const terms = tokens(q).map((t) => `"${t.replace(/"/g, "")}"`).join(" ");
  return { mode: "text", filter: { $text: { $search: terms, $language: "none" } }, prefix };
}

export type Segment = { text: string; match: boolean };

/** Safe highlight segments (never HTML). Matching is case-insensitive on the escaped query tokens. */
export function highlightSegments(text: string | null | undefined, q: string | undefined): Segment[] {
  const value = text ?? "";
  const ts = tokens(q ?? "").filter((t) => t.length >= 1).map(escapeRegex);
  if (!value || !ts.length) return value ? [{ text: value, match: false }] : [];
  const rx = new RegExp(`(${ts.join("|")})`, "gi");
  const out: Segment[] = [];
  let last = 0;
  for (const m of value.matchAll(rx)) {
    const i = m.index ?? 0;
    if (!m[0]) continue;
    if (i > last) out.push({ text: value.slice(last, i), match: false });
    out.push({ text: m[0], match: true });
    last = i + m[0].length;
  }
  if (last < value.length) out.push({ text: value.slice(last), match: false });
  return out;
}

/** Asia/Colombo (UTC+05:30, no DST) day bounds for a `YYYY-MM-DD` string. */
export function colomboDay(day: string, end: boolean): Date {
  const start = new Date(`${day}T00:00:00.000+05:30`);
  return end ? new Date(start.getTime() + 86_400_000 - 1) : start;
}

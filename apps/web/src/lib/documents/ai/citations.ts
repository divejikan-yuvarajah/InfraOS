import type { Citation, Coverage, ExtractField, ExtractValue, TemplateInfo } from "./rag-types";

/** Splits server-built answer text into plain text and citation markers. Markers look like `[1][3]`. Model text is never interpreted as markup. */
export type AnswerPart = { type: "text"; text: string } | { type: "cite"; ns: number[] };

export function splitAnswer(text: string): AnswerPart[] {
  const parts: AnswerPart[] = [];
  const re = /(?:\[\d{1,4}\])+/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push({ type: "text", text: text.slice(last, m.index) });
    parts.push({ type: "cite", ns: [...m[0].matchAll(/\[(\d{1,4})\]/g)].map((x) => Number(x[1])) });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}

export const pageLabel = (c: Pick<Citation, "pageStart" | "pageEnd">): { kind: "none" } | { kind: "one"; n: number } | { kind: "range"; a: number; b: number } =>
  c.pageStart === null ? { kind: "none" } : c.pageEnd !== null && c.pageEnd !== c.pageStart ? { kind: "range", a: c.pageStart, b: c.pageEnd } : { kind: "one", n: c.pageStart };

/** How much of the scope was searched. `partial` drives the coverage notice. */
export function coverageState(c: Coverage | null): { searched: number; total: number; missing: number; percent: number; partial: boolean } {
  if (!c) return { searched: 0, total: 0, missing: 0, percent: 0, partial: false };
  const total = c.documentsInScope;
  return { searched: c.documentsSearched, total, missing: c.documentsNotAiReady, percent: total ? Math.round((c.documentsSearched / total) * 100) : 0, partial: c.documentsNotAiReady > 0 || c.truncatedScope };
}

export const statusTone = (s: string): "success" | "pending" | "critical" | "neutral" | "active" =>
  s === "ANSWERED" ? "success" : s === "PARTIAL" ? "pending" : s === "FAILED" ? "critical" : s === "PASSAGES_ONLY" ? "active" : "neutral";

/** Plain-text export of an answer with its numbered sources (no markup, no model HTML). */
export function answerAsText(text: string, citations: Citation[]): string {
  const src = citations.map((c) => `[${c.n}] ${c.docNo ?? ""} ${c.title ?? ""}${c.pageStart !== null ? `, p.${c.pageStart}${c.pageEnd && c.pageEnd !== c.pageStart ? `-${c.pageEnd}` : ""}` : ""}${c.section ? `, ${c.section}` : ""}${c.quote ? ` — "${c.quote}"` : ""}`.trim());
  return [text, "", ...src].join("\n").trim();
}

/** Typed value as text for display. Currency uses Intl with the minor-unit integer from the server; nothing is computed by the model. */
export function formatValue(v: ExtractValue, locale: string): string {
  const t = v.typed;
  if (!t) return v.rawText;
  switch (t.type) {
    case "MONEY": return new Intl.NumberFormat(locale, { style: "currency", currency: t.currency ?? "LKR" }).format((t.amountMinor ?? 0) / 100);
    case "DATE": return t.iso ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${t.iso}T00:00:00Z`)) : v.rawText;
    case "PERCENT": return `${t.value}%`;
    case "DURATION": return `${t.value} ${String(t.unit ?? "").toLowerCase()}${Number(t.value) === 1 ? "" : "s"}`;
    default: return t.text ?? v.rawText;
  }
}

/** Fields that "Accept all strong matches" may accept: found, every value STRONG, not contradicting the record. */
export function strongMatchKeys(fields: ExtractField[], diffs: Record<string, { state: string }>, decided: Record<string, { decision: string }>): string[] {
  return fields.filter((f) => f.status === "FOUND" && f.values.length > 0 && f.values.every((v) => v.strength === "STRONG") && diffs[f.key]?.state !== "DIFFERS" && (!decided[f.key] || decided[f.key]!.decision === "PENDING")).map((f) => f.key);
}

export const groupFields = (fields: ExtractField[], tpl: TemplateInfo | undefined): { group: string; fields: ExtractField[] }[] => {
  void tpl;
  const order = ["found", "ambiguous", "missing"] as const;
  const g = (f: ExtractField) => (f.status === "FOUND" ? "found" : f.status === "AMBIGUOUS" ? "ambiguous" : "missing");
  return order.map((group) => ({ group, fields: fields.filter((f) => g(f) === group) })).filter((x) => x.fields.length);
};

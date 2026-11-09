/** Text helpers shared by verification, rerank and redaction. ZWJ (U+200D) and ZWNJ (U+200C) are significant in Sinhala/Tamil and are never stripped. */

const INVISIBLE = /[\u200b\u200e\u200f\u2060\ufeff\u00ad]/g;
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** For verbatim comparison: NFC, unify quotes/dashes, drop invisible characters (except ZWJ/ZWNJ), collapse whitespace. Case is preserved. */
export function normaliseForMatch(text: string): string {
  return text
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u2033]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** User input: strip control characters and collapse runs of whitespace. */
export function cleanInput(text: string): string {
  return text.normalize("NFC").replace(CONTROL, "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
}

const TOKEN = /[\p{L}\p{N}\p{M}\u200c\u200d]+(?:\.[\p{N}]+)*/gu;
/** Lowercases Latin only (Sinhala/Tamil have no case); keeps clause numbers such as 4.2 and currency tokens such as lkr. */
export function tokenize(text: string): string[] {
  return (text.normalize("NFC").toLowerCase().match(TOKEN) ?? []).filter((t) => t.length > 0);
}

/** Strips URLs, markdown links/images and HTML so model prose is inert plain text. */
export function sanitiseModelText(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[link removed]")
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[*_`#]{1,3}/g, "")
    .trim();
}

export const truncate = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

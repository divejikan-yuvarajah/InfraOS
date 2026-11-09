/**
 * Deterministic minimisation of personal identifiers before text leaves for the model provider (BR-AI-006).
 * Sri Lankan NIC (old 9 digits + V/X, new 12 digits), e-mail addresses and phone numbers. Money and clause numbers are untouched:
 * 12-digit matches must not sit inside a number group (commas/decimals), and phones need a 0 or +94 prefix with the usual grouping.
 */
const NIC_OLD = /(?<![\w])\d{9}[VvXx](?![\w])/g;
const NIC_NEW = /(?<!\d)(?<!\d[,.])\d{12}(?!\d)(?![,.]\d)/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const PHONE = /(?<!\d)(?<!\d[,.])(?:\+94[\s-]?|0)\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{4}(?!\d)(?![,.]\d)/g;

export type Redaction = { text: string; count: number };

export function redactText(input: string): Redaction {
  let count = 0;
  const swap = (re: RegExp, label: string) => (s: string) => s.replace(re, () => { count += 1; return label; });
  const text = [swap(EMAIL, "[EMAIL]"), swap(NIC_OLD, "[NIC]"), swap(NIC_NEW, "[NIC]"), swap(PHONE, "[PHONE]")].reduce((s, fn) => fn(s), input);
  return { text, count };
}

import type { AuthLocale } from "@/lib/auth/types";

import { formatLkr, percentFromBp, ppFromTenths } from "./money";
import type { Copy } from "./messages";
import type { Basis, Flag, Gate, Intelligence, PortfolioRow } from "./types";

export const fill = (template: string, params: Record<string, string | number | null | undefined>): string => template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ""));

/** Translated gate sentence: the server sends numbers (cents), the browser words and formats them. */
export function gateText(copy: Copy, gate: Gate, locale: AuthLocale): string {
  const table = copy.gates.text[gate.key] as Record<string, string> | undefined;
  const template = table?.[gate.status];
  if (!template) return gate.message;
  const v = gate.values;
  const basis = typeof v.basis === "string" ? copy.basis[v.basis as Basis] : "";
  return fill(template, { over: typeof v.overByMinor === "number" ? formatLkr(v.overByMinor, locale) : "", basis });
}

/** Translated flag reason with the real numbers from the API params. */
export function flagText(copy: Copy, flag: Pick<Flag, "code" | "params">, locale: AuthLocale, ctx?: { basis?: Basis }): { label: string; reason: string } {
  const t = copy.flags.code[flag.code];
  if (!t) return { label: flag.code, reason: "" };
  const p = flag.params;
  const num = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : 0);
  return {
    label: t.label,
    reason: fill(t.reason, {
      over: formatLkr(num("overByMinor"), locale), pct: percentFromBp(num("utilizationBp")), gap: ppFromTenths(num("gapTenths")).replace(/^[+−]/, ""),
      basis: copy.basis[(typeof p.basis === "string" ? p.basis : ctx?.basis ?? "NONE") as Basis], days: num("days"), amount: formatLkr(num("unallocatedMinor"), locale),
      category: typeof p.category === "string" ? copy.category[p.category as keyof Copy["category"]] ?? p.category : "",
    }),
  };
}

/** Map an API failure to a translated sentence from the given error table; never echoes server text. */
export function failureText(status: number, kind: string | null, table: Record<string, string>, copy: Copy, vars: Record<string, string> = {}): string {
  if (status === 401) return copy.common.signedOut;
  if (status === 403 && kind && table[kind]) return fill(table[kind]!, vars);
  if (status === 403) return copy.common.forbidden;
  if (status === 404) return copy.common.notFound;
  if (kind && table[kind]) return fill(table[kind]!, vars);
  if (status === 503) return copy.common.unavailable;
  return copy.common.errorGeneric;
}

export type QuadrantPoint = { id: string; code: string; title: string; x: number; y: number; basis: Basis; severity: "HIGH" | "MEDIUM" | "NONE" };

/** Plot data: x = physical %, y = financial %, both 0..100. A project without a progress figure is not plotted (no invented position). */
export function quadrantPoints(rows: PortfolioRow[]): QuadrantPoint[] {
  return rows
    .filter((r) => r.physicalBp !== null && r.financialBp !== null && r.basis !== "NONE")
    .map((r) => ({
      id: r.id, code: r.code, title: r.title, x: Math.min(100, (r.physicalBp as number) / 100), y: Math.min(100, (r.financialBp as number) / 100), basis: r.basis,
      severity: (r.flags.some((f) => f.severity === "HIGH") ? "HIGH" : r.flags.some((f) => f.severity === "MEDIUM") ? "MEDIUM" : "NONE") as QuadrantPoint["severity"],
    }));
}

/** True when the point sits in the "spending ahead" zone (financial above physical by at least 10 points). */
export const spendingAhead = (p: { x: number; y: number }): boolean => p.y - p.x >= 10;

export const intelAvailable = (i: Intelligence): i is Extract<Intelligence, { available: true }> => i.available;

export type PayStep = { key: "requested" | "approved" | "paid" | "rejected" | "cancelled" | "reversed"; state: "done" | "current" | "todo" | "branch" };
/** Stepper model: Requested, Approved, Paid with the terminal branches rendered explicitly. */
export function stepsFor(status: string): PayStep[] {
  const main = ["requested", "approved", "paid"] as const;
  const reached = status === "PENDING" ? 0 : status === "APPROVED" ? 1 : status === "PAID" ? 2 : status === "REVERSED" ? 2 : status === "REJECTED" ? 0 : status === "CANCELLED" ? 0 : 0;
  const steps: PayStep[] = main.map((key, i) => ({ key, state: i < reached ? "done" : i === reached && !["REJECTED", "CANCELLED", "REVERSED", "PAID"].includes(status) ? "current" : i === reached && status === "PAID" ? "done" : i === reached ? "done" : "todo" }));
  if (status === "REJECTED") steps.push({ key: "rejected", state: "branch" });
  if (status === "CANCELLED") steps.push({ key: "cancelled", state: "branch" });
  if (status === "REVERSED") steps.push({ key: "reversed", state: "branch" });
  return steps;
}

export const DATE_PRESETS = ["month", "quarter", "year", "all"] as const;
/** Preset to inclusive yyyy-mm-dd bounds (UTC). Financial year is the Sri Lankan calendar year. */
export function presetRange(preset: (typeof DATE_PRESETS)[number], now = new Date()): { dateFrom?: string; dateTo?: string } {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const day = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === "month") return { dateFrom: day(new Date(Date.UTC(y, m, 1))), dateTo: day(now) };
  if (preset === "quarter") return { dateFrom: day(new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1))), dateTo: day(now) };
  if (preset === "year") return { dateFrom: day(new Date(Date.UTC(y, 0, 1))), dateTo: day(now) };
  return {};
}

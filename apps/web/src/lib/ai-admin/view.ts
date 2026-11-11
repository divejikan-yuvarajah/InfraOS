import { ApiError } from "@/lib/api/client";
import type { AuthLocale } from "@/lib/auth/types";

import type { AiAdminCopy } from "./messages-en";
import type { LiteFeatureStatus } from "./types";

const AI_ACCESS_ROLES = new Set([
  "SUPER_ADMIN",
  "GOV_ADMIN",
  "AGENCY_OFFICER",
  "PROJECT_MANAGER",
  "INSPECTOR",
]);

const AI_MANAGE_ROLES = new Set(["SUPER_ADMIN", "GOV_ADMIN"]);

export function hasAnyAiAccess(roleKey: string | null | undefined): boolean {
  return Boolean(roleKey && AI_ACCESS_ROLES.has(roleKey));
}

export function canUseCopilot(roleKey: string | null | undefined): boolean {
  return hasAnyAiAccess(roleKey);
}

export function canManageAi(roleKey: string | null | undefined): boolean {
  return Boolean(roleKey && AI_MANAGE_ROLES.has(roleKey));
}

export function canExportAuditCsv(roleKey: string | null | undefined): boolean {
  return canManageAi(roleKey);
}

export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`,
  );
}

export function formatCountdownSeconds(seconds: number, copy: AiAdminCopy): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  if (clamped < 60) return fillTemplate(copy.time.seconds, { s: clamped });
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return fillTemplate(copy.time.minutesSeconds, { m, s });
}

export function formatNumber(n: number, locale: AuthLocale): string {
  const tag = locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK";
  return new Intl.NumberFormat(tag).format(n);
}

export function formatDateTime(iso: string | null | undefined, locale: AuthLocale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const tag = locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK";
  return new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function formatCurrencyMinor(minor: number | null | undefined, locale: AuthLocale): string {
  if (minor === null || minor === undefined) return "—";
  const tag = locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK";
  return new Intl.NumberFormat(tag, { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(minor / 100);
}

export type MappedAiFailure = {
  code: string;
  message: string;
  retryAfterSeconds?: number;
  resetsAt?: string;
};

export function mapAiFailure(error: unknown, copy: AiAdminCopy, locale: AuthLocale): MappedAiFailure {
  let code = "GENERIC";
  let retryAfterSeconds: number | undefined;
  let resetsAt: string | undefined;

  if (error instanceof ApiError) {
    const details = (error.details && typeof error.details === "object" ? error.details : {}) as Record<string, unknown>;
    if (typeof error.code === "string" && error.code in copy.failures) {
      code = error.code;
    } else if (typeof details.reason === "string" && details.reason in copy.failures) {
      code = details.reason;
    } else if (error.status === 429) {
      code = "AI_RATE_LIMITED";
    } else if (error.status === 503) {
      code = "AI_UNAVAILABLE";
    }
    if (typeof details.retryAfterSeconds === "number" && Number.isFinite(details.retryAfterSeconds)) {
      retryAfterSeconds = Math.max(1, Math.round(details.retryAfterSeconds));
    }
    if (typeof details.resetsAt === "string") {
      resetsAt = details.resetsAt;
    }
  } else if (error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string") {
    const candidate = (error as { code: string }).code;
    if (candidate in copy.failures) code = candidate;
  }

  const key = code as keyof AiAdminCopy["failures"];
  let message: string = copy.failures[key] ?? copy.failures.GENERIC;
  if (code === "AI_RATE_LIMITED") {
    message = fillTemplate(message, {
      countdown: formatCountdownSeconds(retryAfterSeconds ?? 60, copy),
    });
  } else if (code === "AI_BUDGET_EXCEEDED") {
    message = fillTemplate(message, {
      reset: resetsAt ? formatDateTime(resetsAt, locale) : "00:00",
    });
  }

  return { code, message, retryAfterSeconds, resetsAt };
}

export function statusChipTone(status: LiteFeatureStatus | "available" | "degraded" | "unavailable" | "disabled"): "success" | "pending" | "critical" | "neutral" {
  if (status === "available") return "success";
  if (status === "degraded") return "pending";
  if (status === "unavailable") return "critical";
  return "neutral";
}


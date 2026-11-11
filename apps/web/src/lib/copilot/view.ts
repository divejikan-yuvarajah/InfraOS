import type { CopilotMessages } from "./messages-en";
import type { CopilotPageContext, CopilotSuggestionDto } from "./types";

export type TextSegment =
  | { kind: "text"; value: string }
  | { kind: "cite"; nums: number[] };

/**
 * Splits plain-text model output into plain prose segments and numeric `[n]` citation chips.
 * Never interprets markdown links, HTML tags, or external URLs.
 */
export function splitCitationSegments(text: string): TextSegment[] {
  if (!text) return [];
  const out: TextSegment[] = [];
  const re = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) {
      out.push({ kind: "text", value: text.slice(lastIdx, match.index) });
    }
    const nums = match[1]!
      .split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0 && n <= 200);
    if (nums.length > 0) {
      out.push({ kind: "cite", nums });
    } else {
      out.push({ kind: "text", value: match[0] });
    }
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    out.push({ kind: "text", value: text.slice(lastIdx) });
  }
  return out;
}

/** Validates that a link returned by the server is strictly an internal application path. */
export function isSafeInternalLink(link: string | undefined | null): link is string {
  if (!link || typeof link !== "string") return false;
  const trimmed = link.trim();
  return trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("://");
}

export function suggestionTitle(item: CopilotSuggestionDto, copy: CopilotMessages): string {
  const map = copy.suggestions as Record<string, string>;
  return map[item.labelKey] ?? item.prompt;
}

export function formatContextSummary(ctx: CopilotPageContext, copy: CopilotMessages): string {
  const typeLabel = copy.pageTypes[ctx.type] ?? copy.pageTypes.OTHER;
  if (ctx.recordId) {
    return `${typeLabel} · #${ctx.recordId.slice(-6)}`;
  }
  return typeLabel;
}

export type CopilotUiPrefs = {
  open: boolean;
  wide: boolean;
  lastThreadId?: string;
};

const STORAGE_KEY = "infraos:copilot:ui:v1";

/** Persists drawer UI state only — never message content, prompts, answers, or secrets. */
export function loadCopilotUiPrefs(): CopilotUiPrefs {
  if (typeof window === "undefined") return { open: false, wide: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { open: false, wide: false };
    const parsed = JSON.parse(raw) as Partial<CopilotUiPrefs>;
    const lastThreadId =
      typeof parsed.lastThreadId === "string" && /^[a-f0-9-]{36}$/.test(parsed.lastThreadId)
        ? parsed.lastThreadId
        : undefined;
    return {
      open: Boolean(parsed.open),
      wide: Boolean(parsed.wide),
      ...(lastThreadId ? { lastThreadId } : {}),
    };
  } catch {
    return { open: false, wide: false };
  }
}

export function saveCopilotUiPrefs(prefs: CopilotUiPrefs): void {
  if (typeof window === "undefined") return;
  try {
    const clean: CopilotUiPrefs = {
      open: Boolean(prefs.open),
      wide: Boolean(prefs.wide),
      ...(prefs.lastThreadId && /^[a-f0-9-]{36}$/.test(prefs.lastThreadId)
        ? { lastThreadId: prefs.lastThreadId }
        : {}),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // ignore storage quota errors
  }
}


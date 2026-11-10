import type {
  RiskBasis,
  RiskFactorCategory,
  RiskLevel,
  RiskResolutionStatus,
  RiskSeverity,
  RiskSufficiency,
} from "./types";

export interface LevelConfig {
  label: string;
  glyph: string;
  colorClass: string;
  badgeClass: string;
  borderClass: string;
  bgClass: string;
  hex: string;
}

export const LEVEL_CONFIG: Record<RiskLevel, LevelConfig> = {
  LOW: {
    label: "Low",
    glyph: "○",
    colorClass: "text-emerald-700 dark:text-emerald-300",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    borderClass: "border-emerald-500",
    bgClass: "bg-emerald-500",
    hex: "#10b981",
  },
  MODERATE: {
    label: "Moderate",
    glyph: "◐",
    colorClass: "text-amber-700 dark:text-amber-300",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    borderClass: "border-amber-500",
    bgClass: "bg-amber-500",
    hex: "#f59e0b",
  },
  HIGH: {
    label: "High",
    glyph: "▲",
    colorClass: "text-orange-700 dark:text-orange-300",
    badgeClass: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
    borderClass: "border-orange-500",
    bgClass: "bg-orange-500",
    hex: "#f97316",
  },
  CRITICAL: {
    label: "Critical",
    glyph: "◆",
    colorClass: "text-rose-700 dark:text-rose-300",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    borderClass: "border-rose-600",
    bgClass: "bg-rose-600",
    hex: "#e11d48",
  },
  NOT_ASSESSABLE: {
    label: "Not Assessable",
    glyph: "?",
    colorClass: "text-slate-600 dark:text-slate-400",
    badgeClass: "bg-slate-100 text-slate-700 border-dashed border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700",
    borderClass: "border-slate-400",
    bgClass: "bg-slate-400",
    hex: "#94a3b8",
  },
};

export const SEVERITY_CONFIG: Record<RiskSeverity, { label: string; glyph: string; badgeClass: string }> = {
  INFO: {
    label: "Info",
    glyph: "ℹ",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800",
  },
  LOW: {
    label: "Low",
    glyph: "○",
    badgeClass: LEVEL_CONFIG.LOW.badgeClass,
  },
  MODERATE: {
    label: "Moderate",
    glyph: "◐",
    badgeClass: LEVEL_CONFIG.MODERATE.badgeClass,
  },
  HIGH: {
    label: "High",
    glyph: "▲",
    badgeClass: LEVEL_CONFIG.HIGH.badgeClass,
  },
  CRITICAL: {
    label: "Critical",
    glyph: "◆",
    badgeClass: LEVEL_CONFIG.CRITICAL.badgeClass,
  },
};

export const SUFFICIENCY_CONFIG: Record<RiskSufficiency, { label: string; pips: number; badgeClass: string }> = {
  SUFFICIENT: {
    label: "Sufficient",
    pips: 3,
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
  LIMITED: {
    label: "Limited Data",
    pips: 2,
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
  },
  INSUFFICIENT: {
    label: "Insufficient Data",
    pips: 1,
    badgeClass: "bg-rose-50 text-rose-800 border-dashed border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800",
  },
};

export const BASIS_CONFIG: Record<RiskBasis, { label: string; badgeClass: string; isHollow: boolean }> = {
  VERIFIED: {
    label: "Verified",
    badgeClass: "bg-teal-50 text-teal-800 border-teal-200 font-medium",
    isHollow: false,
  },
  RECORDED: {
    label: "Recorded",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
    isHollow: false,
  },
  REPORTED: {
    label: "Reported (Unverified)",
    badgeClass: "bg-slate-50 text-slate-600 border-dashed border-slate-300",
    isHollow: true,
  },
  MIXED: {
    label: "Mixed Basis",
    badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
    isHollow: false,
  },
};

export const RESOLUTION_CONFIG: Record<
  RiskResolutionStatus | "REOPENED",
  { label: string; badgeClass: string }
> = {
  OPEN: {
    label: "Unacknowledged",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
  ACKNOWLEDGED: {
    label: "Acknowledged",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  IN_PROGRESS: {
    label: "In Progress",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  RESOLVED: {
    label: "Resolved",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  DISMISSED: {
    label: "Dismissed",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
  },
  REOPENED: {
    label: "Reopened",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200 font-semibold",
  },
};

export const CATEGORY_LABELS: Record<RiskFactorCategory, string> = {
  DELAY: "Delay Risk",
  PROGRESS: "Progress & Site",
  BUDGET: "Budget & Payments",
  SCHEDULE: "Schedule & Coordination",
  COORDINATION: "RoadSync & Clash",
  OTHER: "Other Factors",
};

export function formatDaysAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

/**
 * "Site Plan" design language (docs/design/04-direction.md).
 * Pure mapping logic for the route-line status language, lifecycle rail,
 * dual progress and honesty chips. No data is invented here: every output
 * is derived from a status or a number the API already returned.
 */

/** Node shapes on the route line. Shape + colour + text, never colour alone. */
export type NodeShape = "dash" | "ring" | "half" | "filled" | "diamond" | "check" | "cross";
export type NodeTone = "neutral" | "pending" | "hold" | "active" | "critical" | "success";
export type StatusNodeVisual = { shape: NodeShape; tone: NodeTone };

const PROJECT_NODES: Record<string, StatusNodeVisual> = {
  DRAFT: { shape: "dash", tone: "neutral" },
  SUBMITTED: { shape: "ring", tone: "pending" },
  UNDER_REVIEW: { shape: "ring", tone: "pending" },
  REJECTED: { shape: "cross", tone: "critical" },
  APPROVED: { shape: "filled", tone: "success" },
  ACTIVE: { shape: "filled", tone: "active" },
  ON_HOLD: { shape: "half", tone: "hold" },
  DELAYED: { shape: "diamond", tone: "critical" },
  COMPLETED: { shape: "check", tone: "success" },
  CANCELLED: { shape: "cross", tone: "neutral" },
};

const WORK_NODES: Record<string, StatusNodeVisual> = {
  DRAFT: { shape: "dash", tone: "neutral" },
  SUBMITTED: { shape: "ring", tone: "pending" },
  PLANNED: { shape: "ring", tone: "pending" },
  APPROVED: { shape: "filled", tone: "success" },
  ACTIVE: { shape: "filled", tone: "active" },
  COMPLETED: { shape: "check", tone: "success" },
  CANCELLED: { shape: "cross", tone: "neutral" },
};

export type StatusDomain = "project" | "work";

export function statusNode(domain: StatusDomain, status: string): StatusNodeVisual {
  const table = domain === "project" ? PROJECT_NODES : WORK_NODES;
  return table[status] ?? { shape: "dash", tone: "neutral" };
}

export function statusText(status: string): string {
  const spaced = status.replaceAll("_", " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/* ---------- lifecycle rail ---------- */

/** Main path only. Off-path states are shown as a branch flag, never as fake steps. */
export const PROJECT_MAIN_PATH = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "ACTIVE", "COMPLETED"] as const;
// HOLD and MARK_DELAYED only leave ACTIVE (lifecycle.policy.ts), so ACTIVE is a safe anchor.
const OFF_PATH_ANCHOR: Record<string, (typeof PROJECT_MAIN_PATH)[number]> = {
  ON_HOLD: "ACTIVE",
  DELAYED: "ACTIVE",
};

export type RailStep = { status: string; state: "done" | "current" | "upcoming" };
export type LifecycleRailModel = { steps: RailStep[]; branch: string | null; terminated: boolean };

/**
 * Derived from the current status alone. "done" means "the main path got past this node",
 * which every status after it implies; no dates or history are claimed.
 * CANCELLED has no known anchor (a project can be cancelled from several states), so no
 * step is marked done or current for it. REJECTED marks only Draft and Submitted as passed.
 */
export function lifecycleRail(status: string): LifecycleRailModel {
  const path = PROJECT_MAIN_PATH as readonly string[];
  if (status === "CANCELLED") {
    return { steps: path.map((s) => ({ status: s, state: "upcoming" as const })), branch: "CANCELLED", terminated: true };
  }
  // REJECTED leaves SUBMITTED or UNDER_REVIEW (review.policy.ts): only "submitted" is certain.
  if (status === "REJECTED") {
    return { steps: path.map((s, i) => ({ status: s, state: i <= 1 ? ("done" as const) : ("upcoming" as const) })), branch: "REJECTED", terminated: true };
  }
  const anchor = path.includes(status) ? status : OFF_PATH_ANCHOR[status];
  if (!anchor) return { steps: path.map((s) => ({ status: s, state: "upcoming" as const })), branch: null, terminated: false };
  const at = path.indexOf(anchor);
  return {
    steps: path.map((s, i) => ({ status: s, state: i < at ? "done" : i === at ? "current" : "upcoming" })),
    branch: path.includes(status) ? null : status,
    terminated: status === "REJECTED",
  };
}

/* ---------- dual progress ---------- */

/**
 * `value` is the real figure (financial may exceed 100 on an overrun); `fill` is the bar width, capped at 100.
 * `over` is true when the real figure is above 100, so the UI can say so instead of showing a full bar as "100%".
 */
export type ProgressTrack = { kind: "physical" | "financial"; value: number | null; fill: number; over: boolean; label: string; honesty: HonestyKind };
const whole = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.round(n)) : null);

/**
 * Physical progress is always "reported"; financial is always "provisional".
 * A missing value is "unavailable", and a financial figure the viewer's role may not read is "withheld".
 */
export function dualProgress(
  physical: number | null | undefined,
  financial: number | null | undefined,
  options: { financialWithheld?: boolean } = {},
): [ProgressTrack, ProgressTrack] {
  const p = whole(physical);
  const f = options.financialWithheld ? null : whole(financial);
  const financialHonesty: HonestyKind = options.financialWithheld ? "withheld" : f === null ? "unavailable" : "provisional";
  return [
    {
      kind: "physical",
      value: p === null ? null : Math.min(100, p),
      fill: p === null ? 0 : Math.min(100, p),
      over: false,
      label: p === null ? "Physical progress unavailable" : `Reported ${Math.min(100, p)}%`,
      honesty: p === null ? "unavailable" : "reported",
    },
    {
      kind: "financial",
      value: f,
      fill: f === null ? 0 : Math.min(100, f),
      over: f !== null && f > 100,
      label: options.financialWithheld ? "Financial progress withheld for your role" : f === null ? "Financial progress unavailable" : `Provisional ${f}%`,
      honesty: financialHonesty,
    },
  ];
}

/* ---------- honesty chips ---------- */

export type HonestyKind = "provisional" | "reported" | "unavailable" | "withheld" | "demo";

export const HONESTY_COPY: Record<HonestyKind, { label: string; hint: string }> = {
  provisional: { label: "Provisional", hint: "Stored record, not a bank settlement or audited figure." },
  reported: { label: "Reported", hint: "Reported by the project team. A reported 100% does not complete a project." },
  unavailable: { label: "Unavailable", hint: "This data is not available in this view yet." },
  withheld: { label: "Withheld", hint: "Hidden for your role or scope." },
  demo: { label: "Demo data", hint: "Demonstration system. Not official government data." },
};

/** Maps dashboard coverage values to an honesty chip, or null when the data is complete. */
export function coverageHonesty(coverage: string | undefined | null): HonestyKind | null {
  if (coverage === "unavailable") return "unavailable";
  if (coverage === "withheld") return "withheld";
  return null;
}

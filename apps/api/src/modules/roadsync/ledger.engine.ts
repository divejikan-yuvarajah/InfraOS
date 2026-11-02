/**
 * Step 77 pure ledger engine: canonical hashing, chain verification, read-time redaction and the time machine.
 * Tamper-EVIDENT, not tamper-proof: it detects edits made without recomputing the chain. No I/O here.
 */
import { createHash } from "node:crypto";

export type Visibility = "participants" | "agency" | "national";
export type LedgerActor = { type: "user" | "system"; userId?: string; agencyId?: string; role?: string; onBehalfOfAgencyId?: string };
export type StateAfter = { recordStatus: string; severity: { score: number; band: string } | null; coordinationState: string | null; resolutionState: string | null; requestStatus?: string | null; amendmentStatus?: string | null; participantsStance?: { agencyId: string; stance: string }[] };
export type Entry = {
  conflictId: string; seq: number; at: Date | string; recordedAt: Date | string; entityType: string; entityId: string; entityNo: string | null; action: string;
  actor: LedgerActor; data: Record<string, unknown>; visibility: Visibility; visibilityAgencyId: string | null; stateAfter: StateAfter; prevHash: string; hash: string;
};

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const genesisHash = (conflictId: string) => sha256(`${conflictId}genesis`);

/** Stable key order, no whitespace, Dates as ISO strings. */
export function canonical(v: unknown): string {
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

export function entryHash(e: Omit<Entry, "hash" | "recordedAt">): string {
  const { seq, at, conflictId, entityType, entityId, action, actor, data, visibility, visibilityAgencyId, stateAfter, prevHash } = e;
  return sha256(canonical({ seq, at: new Date(at), conflictId: String(conflictId), entityType, entityId, action, actor, data, visibility, visibilityAgencyId, stateAfter, prevHash }));
}

export type Verify = { ok: true; count: number; headHash: string | null } | { ok: false; count: number; headHash: string | null; firstBrokenSeq: number | null; reason: "hash_mismatch" | "seq_gap" | "head_mismatch" };

/** Recomputes every hash and prevHash, checks seq continuity and that the stored head matches the last entry. */
export function verifyChain(conflictId: string, entries: Entry[], head: { seq: number; hash: string } | null | undefined): Verify {
  let prev = genesisHash(conflictId);
  let expected = 1;
  for (const e of entries) {
    if (e.seq !== expected) return { ok: false, count: entries.length, headHash: null, firstBrokenSeq: expected, reason: "seq_gap" };
    if (e.prevHash !== prev || entryHash(e) !== e.hash) return { ok: false, count: entries.length, headHash: null, firstBrokenSeq: e.seq, reason: "hash_mismatch" };
    prev = e.hash;
    expected += 1;
  }
  const last = entries.at(-1);
  if (head && (!last || head.seq !== last.seq || head.hash !== last.hash)) return { ok: false, count: entries.length, headHash: last?.hash ?? null, firstBrokenSeq: head.seq, reason: "head_mismatch" };
  return { ok: true, count: entries.length, headHash: last?.hash ?? null };
}

// ---------- redaction ----------

export type ViewerCtx = { national: boolean; agencyId: string; scopeIds: ReadonlySet<string> };
export const visibleTo = (e: Pick<Entry, "visibility" | "visibilityAgencyId">, v: ViewerCtx) =>
  v.national || e.visibility === "participants" || (e.visibility === "agency" && Boolean(e.visibilityAgencyId) && (e.visibilityAgencyId === v.agencyId || v.scopeIds.has(e.visibilityAgencyId!)));

export type RedactedRow = { kind: "entry"; entry: Entry & { short: string; actorLabel: { agencyId: string | null; role: string | null; person: boolean } } } | { kind: "hidden"; fromSeq: number; toSeq: number; count: number };

/** The chain stays contiguous: hidden entries collapse into a marker that keeps seq numbers and never their content. */
export function redact(entries: Entry[], v: ViewerCtx): RedactedRow[] {
  const out: RedactedRow[] = [];
  for (const e of entries) {
    if (!visibleTo(e, v)) {
      const last = out.at(-1);
      if (last?.kind === "hidden") { last.toSeq = e.seq; last.count += 1; } else out.push({ kind: "hidden", fromSeq: e.seq, toSeq: e.seq, count: 1 });
      continue;
    }
    const own = !e.actor.agencyId || v.national || e.actor.agencyId === v.agencyId || v.scopeIds.has(e.actor.agencyId);
    const { userId, ...actorRest } = e.actor;
    out.push({ kind: "entry", entry: { ...e, actor: own ? e.actor : actorRest, hash: v.national ? e.hash : "", prevHash: v.national ? e.prevHash : "", short: e.hash.slice(0, 8), actorLabel: { agencyId: e.actor.agencyId ?? null, role: e.actor.role ?? null, person: own && Boolean(userId) } } });
  }
  return out;
}

// ---------- time machine ----------

export type Snapshot = { at: string; seq: number | null; state: StateAfter | null; nearby: number[] };
/** Latest stateAfter at or before `at`, taken from the visible entries only. Pure over the ledger. */
export function stateAt(entries: Entry[], at: Date, v: ViewerCtx): Snapshot {
  const visible = entries.filter((e) => visibleTo(e, v));
  const upto = visible.filter((e) => new Date(e.at).getTime() <= at.getTime());
  const last = upto.at(-1) ?? null;
  const idx = last ? visible.indexOf(last) : -1;
  return { at: at.toISOString(), seq: last?.seq ?? null, state: last?.stateAfter ?? null, nearby: visible.slice(Math.max(0, idx - 3), idx + 4).map((e) => e.seq) };
}

import mongoose, { type ClientSession } from "mongoose";
import { AuditLog } from "../audit/models/audit-log.model.js";

const oid = (v: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(String(v));

export type RiskAuditAction =
  | "risk.assessment_requested"
  | "risk.assessment_completed"
  | "risk.resolution_updated"
  | "risk.narrative_generated"
  | "risk.bulk_assessment_started"
  | "risk.exported";

export interface WriteRiskAuditOptions {
  action: RiskAuditAction;
  resourceId: string | mongoose.Types.ObjectId;
  actorUserId?: string | null;
  agencyId?: string | mongoose.Types.ObjectId | null;
  status?: string;
  reason?: string;
  requestId?: string;
}

/**
 * Audit logging for Risk module (§4.2):
 * - User-initiated and terminal outcomes only.
 * - Snapshot keys strictly from allowlist (status, reason, agencyId).
 * - No free text, project names or sensitive content.
 */
export async function writeRiskAudit(
  session: ClientSession | undefined,
  opts: WriteRiskAuditOptions,
): Promise<void> {
  const snap: Record<string, unknown> = {};
  if (opts.status) snap.status = opts.status;
  if (opts.reason) snap.reason = opts.reason.slice(0, 100);
  if (opts.agencyId) snap.agencyId = oid(opts.agencyId);

  const rid = (opts.requestId ?? "").trim().slice(0, 100);

  await AuditLog.create(
    [
      {
        ...(opts.actorUserId ? { userId: oid(opts.actorUserId) } : {}),
        action: opts.action,
        resourceType: "PROJECT",
        resourceId: oid(opts.resourceId),
        ...(opts.agencyId ? { agencyId: oid(opts.agencyId) } : {}),
        ...(Object.keys(snap).length ? { newValue: snap } : {}),
        ...(/^[A-Za-z0-9_-]+$/.test(rid) ? { requestId: rid } : {}),
      },
    ],
    session ? { session } : {},
  );
}


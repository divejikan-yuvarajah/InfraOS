import mongoose, { type ClientSession } from "mongoose";
import type { AI_RAG_AUDIT_ACTIONS, AiAuditAction, AiGovernanceAuditAction } from "@infraos/shared-types";

import { AuditLog } from "../audit/models/audit-log.model.js";

const oid = (v: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(String(v));

function sanitizeReason(reason: string): string {
  let out = "";
  for (let idx = 0; idx < reason.length && out.length < 100; idx++) {
    const code = reason.charCodeAt(idx);
    out += code <= 31 || code === 127 || code === 36 ? "_" : reason[idx]!;
  }
  return out;
}

/**
 * User-initiated actions and terminal outcomes only (never per stage). Snapshot keys come from the audit allowlist (status, reason, agencyId);
 * `reason` carries a machine code, never free text, file names or content. `userId` is omitted for system-originated rows.
 */
export async function writeAiAudit(session: ClientSession | undefined, i: {
  action: AiAuditAction | (typeof AI_RAG_AUDIT_ACTIONS)[number] | AiGovernanceAuditAction;
  resourceType?: "DOCUMENT" | "INSPECTION" | "AGENCY" | "SYSTEM";
  resourceId: string | mongoose.Types.ObjectId;
  agencyId?: string | mongoose.Types.ObjectId | null;
  actorUserId?: string | null;
  status?: string;
  reason?: string;
  requestId?: string;
}): Promise<void> {
  const cleanStatus = i.status && /^[A-Z_]{1,40}$/.test(i.status) ? i.status : undefined;
  const cleanReason = i.reason ? sanitizeReason(i.reason) : undefined;
  const snap = {
    ...(cleanStatus ? { status: cleanStatus } : {}),
    ...(cleanReason ? { reason: cleanReason } : {}),
    ...(i.agencyId ? { agencyId: oid(i.agencyId) } : {}),
  };
  const rid = (i.requestId ?? "").trim().slice(0, 100);
  await AuditLog.create([{
    ...(i.actorUserId ? { userId: oid(i.actorUserId) } : {}),
    action: i.action,
    resourceType: i.resourceType ?? "DOCUMENT",
    resourceId: oid(i.resourceId),
    ...(i.agencyId ? { agencyId: oid(i.agencyId) } : {}),
    ...(Object.keys(snap).length ? { newValue: snap } : {}),
    ...(/^[A-Za-z0-9_-]+$/.test(rid) ? { requestId: rid } : {}),
  }], session ? { session } : {});
}

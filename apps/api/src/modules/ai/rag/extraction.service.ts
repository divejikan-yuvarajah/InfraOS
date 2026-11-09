import mongoose from "mongoose";
import { z } from "zod";
import { EXTRACTION_DECISIONS, EXTRACTION_TEMPLATE_KEYS, extractionTemplate } from "@infraos/shared-types";

import { Agency } from "../../agencies/models/agency.model.js";
import { ContractorAssignment } from "../../contractors/models/contractor-assignment.model.js";
import { Contractor } from "../../contractors/models/contractor.model.js";
import { capsOf, docContext, needPerm, type DCtx, type DocRow } from "../../documents/document.common.js";
import { patchDocument } from "../../documents/document.service.js";
import { projectReadFilter } from "../../identity/authorization/resource-scope.js";
import { Project } from "../../projects/models/project.model.js";
import { writeAiAudit } from "../ai.audit.js";
import { AiArtifact, type AiArtifactDocument } from "./artifact.model.js";
import { aiReadiness, artifactDto, getArtifact, listArtifacts, requestArtifact } from "./artifact.service.js";
import { diffField, type DiffRecords, type FieldDiff } from "./extraction-diff.js";
import type { FieldOut } from "./extraction.runner.js";
import { RagFlow } from "./http.js";
import { normaliseValue, type TypedValue } from "./values.js";

const oid = (v: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(String(v));
type Actor = NonNullable<Express.Request["actor"]>;

export const extractionBody = z.object({ template: z.enum(EXTRACTION_TEMPLATE_KEYS), regenerate: z.boolean().optional() }).strict();
export const reviewBody = z.object({
  version: z.number().int().min(0),
  decisions: z.array(z.object({ fieldKey: z.string().max(60), decision: z.enum(EXTRACTION_DECISIONS), editedValue: z.string().trim().min(1).max(1500).optional() }).strict()).min(1).max(40),
}).strict();
export const applyBody = z.object({ fieldKeys: z.array(z.string().max(60)).min(1).max(10) }).strict();

type Decision = { decision: string; editedValue?: string | null };
const decisionsOf = (a: AiArtifactDocument): Record<string, Decision> => {
  const raw = a.review?.fields as unknown;
  if (!raw) return {};
  const entries = raw instanceof Map ? [...raw.entries()] : Object.entries(raw as Record<string, Decision>);
  return Object.fromEntries(entries.map(([k, v]) => [k, { decision: (v as Decision).decision, editedValue: (v as Decision).editedValue ?? null }]));
};

/** Typed value of the reviewed value: an edit (parsed by the same deterministic parser) wins, otherwise the first extracted value. */
function reviewedValue(field: FieldOut, dec: Decision | undefined): { raw: string; typed: TypedValue | null } | null {
  if (dec?.decision === "REJECTED") return null;
  if (dec?.decision === "EDITED" && dec.editedValue) return { raw: dec.editedValue, typed: normaliseValue(field.type, dec.editedValue).typed };
  const v = field.values[0];
  return v ? { raw: v.rawText, typed: v.typed } : null;
}

async function diffRecords(d: DCtx, doc: DocRow): Promise<DiffRecords> {
  const canFinance = d.ctx.has("finance.budget.read");
  const canContractor = d.ctx.has("contractor.read");
  let project: DiffRecords["project"] = null;
  let contractor: DiffRecords["contractor"] = null;
  if (doc.projectId) {
    // only records the viewer may read: an unreadable project is indistinguishable from no record
    const p = await Project.findOne({ $and: [projectReadFilter(d.ctx.scope), { _id: doc.projectId }] }).select("title startDate plannedEndDate budget agencyId").lean();
    if (p) {
      const agency = await Agency.findById(p.agencyId).select("name").lean();
      project = { id: String(p._id), title: p.title, startDate: p.startDate ?? null, plannedEndDate: p.plannedEndDate ?? null, budgetMinor: p.budget?.amountMinor ?? null, agencyName: agency?.name ?? null };
      if (canContractor) {
        const asg = await ContractorAssignment.findOne({ projectId: p._id, role: "PRIMARY", status: "ACTIVE" }).select("contractorId").lean();
        const c = asg ? await Contractor.findById(asg.contractorId).select("name").lean() : null;
        if (c && asg) contractor = { id: String(asg.contractorId), name: c.name };
      }
    }
  }
  return { project, contractor, canFinance, canContractor };
}

const METADATA_MAP: Record<string, "reference" | "documentDate" | "expiresAt" | "title"> = {};
for (const key of EXTRACTION_TEMPLATE_KEYS) for (const f of extractionTemplate(key)!.fields) if (f.metadata && f.metadata !== "tags") METADATA_MAP[f.key] = f.metadata;
const display = (t: TypedValue | null, raw: string): string => (t?.type === "DATE" ? t.iso : t?.type === "STRING" ? t.text : raw);

export const listExtractions = (actor: Actor, docId: string) => listArtifacts(actor, docId, "EXTRACTION");

export async function createExtraction(actor: Actor, docId: string, body: z.infer<typeof extractionBody>, requestId: string) {
  const r = await requestArtifact(actor, docId, { kind: "EXTRACTION", template: body.template, language: "en", regenerate: body.regenerate }, requestId);
  return { status: r.status, data: artifactDto(r.artifact, r.doc.currentVersionNo ?? null, { result: r.artifact.status === "READY" }) };
}

export async function readExtraction(actor: Actor, docId: string, artifactId: string) {
  const { doc, row } = await getArtifact(actor, docId, artifactId, "EXTRACTION");
  const d = await docContext(actor);
  const fields = ((row.result as { fields?: FieldOut[] } | null)?.fields ?? []) as FieldOut[];
  const decisions = decisionsOf(row);
  const canReview = d.ctx.has("document.update") && capsOf(d, doc).canEdit && row.status === "READY";
  const records = row.status === "READY" || row.status === "STALE" ? await diffRecords(d, doc) : null;
  const diffs: Record<string, FieldDiff> = {};
  const preview: { fieldKey: string; metadataField: string; before: string | null; after: string }[] = [];
  if (records) {
    for (const f of fields) {
      const rv = reviewedValue(f, decisions[f.key]);
      diffs[f.key] = diffField(f.key, rv?.typed ?? null, records);
      const meta = METADATA_MAP[f.key];
      const dec = decisions[f.key]?.decision;
      if (meta && rv && (dec === "ACCEPTED" || dec === "EDITED")) {
        const before = meta === "reference" ? doc.reference ?? null : meta === "title" ? doc.title ?? null : meta === "documentDate" ? doc.documentDate?.toISOString().slice(0, 10) ?? null : doc.expiresAt?.toISOString().slice(0, 10) ?? null;
        const after = display(rv.typed, rv.raw);
        if ((meta === "documentDate" || meta === "expiresAt") && rv.typed?.type !== "DATE") continue; // an unparsed date is never applied
        preview.push({ fieldKey: f.key, metadataField: meta, before, after });
      }
    }
  }
  const total = fields.filter((f) => f.status !== "NOT_FOUND").length;
  const decided = fields.filter((f) => f.status !== "NOT_FOUND" && decisions[f.key] && decisions[f.key]!.decision !== "PENDING").length;
  return {
    data: {
      ...artifactDto(row, doc.currentVersionNo ?? null, { result: true }), readiness: aiReadiness(doc), canReview, version: row.version,
      review: { status: row.review?.status ?? "IN_REVIEW", decisions, decided, total }, diffs, metadataPreview: preview,
      recordLinks: { project: records?.project ? { type: "PROJECT", id: records.project.id } : null, contractor: records?.contractor ? { type: "CONTRACTOR", id: records.contractor.id } : null },
    },
  };
}

export async function saveReview(actor: Actor, docId: string, artifactId: string, body: z.infer<typeof reviewBody>, requestId: string) {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.ask");
  needPerm(d.ctx, "document.update");
  const { doc, row } = await getArtifact(actor, docId, artifactId, "EXTRACTION");
  if (!capsOf(d, doc).canEdit) throw new RagFlow(404, "NOT_FOUND");
  if (row.status !== "READY") throw new RagFlow(409, "AI_ARTIFACT_NOT_READY");
  if (row.version !== body.version) throw new RagFlow(409, "CONFLICT", { reason: "stale" });
  const fields = new Map((((row.result as { fields?: FieldOut[] } | null)?.fields ?? []) as FieldOut[]).map((f) => [f.key, f]));
  const set: Record<string, unknown> = {};
  const seen = new Set<string>();
  for (const dec of body.decisions) {
    const field = fields.get(dec.fieldKey);
    if (!field || seen.has(dec.fieldKey)) throw new RagFlow(400, "VALIDATION_ERROR");
    seen.add(dec.fieldKey);
    if (dec.decision === "EDITED") {
      if (!dec.editedValue) throw new RagFlow(400, "VALIDATION_ERROR", { field: dec.fieldKey });
      if (field.type !== "STRING" && field.type !== "LIST" && !normaliseValue(field.type, dec.editedValue).typed) throw new RagFlow(400, "VALIDATION_ERROR", { field: dec.fieldKey, reason: "INVALID_VALUE" });
    } else if (dec.editedValue) throw new RagFlow(400, "VALIDATION_ERROR", { field: dec.fieldKey });
    if (dec.decision === "ACCEPTED" && field.values.length === 0) throw new RagFlow(400, "VALIDATION_ERROR", { field: dec.fieldKey, reason: "NOTHING_TO_ACCEPT" });
    set[`review.fields.${dec.fieldKey}`] = { decision: dec.decision, ...(dec.editedValue ? { editedValue: dec.editedValue } : {}), decidedBy: oid(actor.userId), decidedAt: new Date() };
  }
  const merged = { ...decisionsOf(row), ...Object.fromEntries(body.decisions.map((x) => [x.fieldKey, { decision: x.decision }])) };
  const open = [...fields.values()].filter((f) => f.status !== "NOT_FOUND" && (!merged[f.key] || merged[f.key]!.decision === "PENDING")).length;
  set["review.status"] = open === 0 ? "REVIEWED" : "IN_REVIEW";
  const res = await AiArtifact.updateOne({ _id: row._id, version: row.version, status: "READY" }, { $set: set, $inc: { version: 1 } });
  if (res.matchedCount !== 1) throw new RagFlow(409, "CONFLICT", { reason: "stale" });
  await writeAiAudit(undefined, { action: "ai.extraction_reviewed", resourceId: doc._id, agencyId: String(doc.agencyId), actorUserId: actor.userId, status: open === 0 ? "REVIEWED" : "IN_REVIEW", reason: `decided:${body.decisions.length}`, requestId }).catch(() => undefined);
  return readExtraction(actor, docId, artifactId);
}

/**
 * The ONLY write an extraction can cause: DocTrace's own metadata (reference, document date, expiry, title) through the existing PATCH flow
 * (OCC + audit + scope checks). Project, finance, contractor, inspection and asset records are never touched here.
 */
export async function applyMetadata(actor: Actor, docId: string, artifactId: string, body: z.infer<typeof applyBody>, requestId: string) {
  const d = await docContext(actor);
  needPerm(d.ctx, "document.update");
  const { doc, row } = await getArtifact(actor, docId, artifactId, "EXTRACTION");
  if (row.status !== "READY" || row.versionNo !== doc.currentVersionNo) throw new RagFlow(409, "AI_ARTIFACT_NOT_READY");
  const fields = new Map((((row.result as { fields?: FieldOut[] } | null)?.fields ?? []) as FieldOut[]).map((f) => [f.key, f]));
  const decisions = decisionsOf(row);
  const patch: Record<string, unknown> = {};
  const applied: string[] = [];
  for (const key of new Set(body.fieldKeys)) {
    const meta = METADATA_MAP[key];
    const field = fields.get(key);
    const dec = decisions[key]?.decision;
    if (!meta || !field || (dec !== "ACCEPTED" && dec !== "EDITED")) throw new RagFlow(400, "VALIDATION_ERROR", { field: key, reason: "NOT_APPLICABLE" });
    const rv = reviewedValue(field, decisions[key]);
    if (!rv) throw new RagFlow(400, "VALIDATION_ERROR", { field: key });
    if (meta === "documentDate" || meta === "expiresAt") {
      if (rv.typed?.type !== "DATE") throw new RagFlow(400, "VALIDATION_ERROR", { field: key, reason: "NOT_A_DATE" });
      patch[meta] = new Date(`${rv.typed.iso}T00:00:00.000Z`);
    } else patch[meta] = display(rv.typed, rv.raw).slice(0, meta === "title" ? 200 : 100);
    applied.push(key);
  }
  const out = await patchDocument(actor, docId, { version: doc.version ?? 0, ...patch } as never, requestId);
  if (!out.ok) throw new RagFlow(out.status === 404 ? 404 : 409, out.status === 404 ? "NOT_FOUND" : "CONFLICT", { reason: "stale" });
  await writeAiAudit(undefined, { action: "ai.extraction_applied_to_metadata", resourceId: doc._id, agencyId: String(doc.agencyId), actorUserId: actor.userId, status: "APPLIED", reason: applied.join(",").slice(0, 100), requestId }).catch(() => undefined);
  return { data: { applied, metadataFields: applied.map((k) => METADATA_MAP[k]) } };
}

import { createHash } from "node:crypto";

import type mongoose from "mongoose";

import { Document } from "../../../modules/documents/models/document.model.js";
import { getEvidenceStorage, storageKeyFor } from "../../../modules/inspections/evidence-storage.js";
import { checklistFor } from "../../../modules/inspections/inspection-checklists.js";
import { CHECKLIST_VERSION, type InspectionType } from "../../../modules/inspections/inspection.constants.js";
import { InspectionEvidence } from "../../../modules/inspections/models/inspection-evidence.model.js";
import { Inspection } from "../../../modules/inspections/models/inspection.model.js";
import { ProgressVerification } from "../../../modules/inspections/models/progress-verification.model.js";
import { ProgressReport } from "../../../modules/projects/models/progress-report.model.js";
import { Project } from "../../../modules/projects/models/project.model.js";
import { d } from "../helpers/dates.js";
import type { DemoProjectCode } from "./catalog.js";
import { ctxId, type DemoContext } from "./context.js";

type Id = mongoose.Types.ObjectId;

/** A 1x1 PNG. Every synthetic evidence image is this placeholder plus a unique label, never a real photo. */
const PLACEHOLDER_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

type Defect = { key: string; title: string; severity: "MINOR" | "MAJOR" | "CRITICAL"; location?: string; reworkRequired: boolean };
type Seed = {
  no: string; project: DemoProjectCode; type: InspectionType; status: "SCHEDULED" | "IN_PROGRESS" | "SUBMITTED" | "VERIFIED" | "REQUIRES_REVIEW" | "REJECTED" | "CANCELLED";
  date: string; priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT"; purpose: string; contractors?: string[];
  measured?: number; fail?: string[]; defects?: Defect[]; discrepancyNote?: string; decision?: { kind: "APPROVED" | "REVISION_REQUESTED" | "REJECTED"; note?: string; comments?: { itemKey: string; comment: string }[] };
  photos?: number; followUpOf?: string; cancelReason?: string; verify?: { claimed: number | null };
};

/**
 * Synthetic inspections: every status and type, one overdue, one with reviewer comments, one rejected with a follow-up, plus verification records.
 * Numbers use a reserved INS-2026-9000nn range so the real INS counter is never consumed and re-seeding is idempotent.
 * PFAC is the spending-ahead project: its approved verification (30% against 45% reported) makes the Batch 05 conclusions CONFIRMED.
 */
const SEEDS: Seed[] = [
  { no: "INS-2026-900001", project: "INF-PFAC-001", type: "PROGRESS_VERIFICATION", status: "VERIFIED", date: "2026-03-20T04:00:00.000Z", priority: "HIGH", purpose: "Verify claimed progress on the delayed project (Synthetic)", contractors: ["SYNTH/BETA-001", "SYNTH/GAMMA-001"],
    measured: 30, discrepancyNote: "Less work is complete on site than the progress report states (Synthetic).", defects: [{ key: "base_course_thin", title: "Base course thinner than specified (Synthetic)", severity: "MAJOR", location: "Chainage 0+400", reworkRequired: true }], photos: 2, decision: { kind: "APPROVED", note: "Measurements are consistent with the photos (Synthetic)." }, verify: { claimed: 45 } },
  { no: "INS-2026-900002", project: "INF-ROAD-001", type: "QUALITY", status: "VERIFIED", date: "2026-02-20T04:00:00.000Z", purpose: "Surface quality check (Synthetic)", contractors: ["SYNTH/ALPHA-001"],
    defects: [{ key: "edge_crack", title: "Minor edge cracking (Synthetic)", severity: "MINOR", location: "Chainage 1+100", reworkRequired: false }], photos: 1, decision: { kind: "APPROVED", note: "No action beyond monitoring (Synthetic)." } },
  { no: "INS-2026-900003", project: "INF-ROAD-001", type: "SAFETY", status: "SUBMITTED", date: "2026-03-30T04:00:00.000Z", purpose: "Traffic management and signage review (Synthetic)", contractors: ["SYNTH/ALPHA-001"], photos: 1 },
  { no: "INS-2026-900004", project: "INF-WATER-001", type: "PROGRESS_VERIFICATION", status: "REQUIRES_REVIEW", date: "2026-03-25T04:00:00.000Z", purpose: "Pipe laying progress (Synthetic)", contractors: ["SYNTH/BETA-001"], measured: 20, photos: 0,
    decision: { kind: "REVISION_REQUESTED", note: "Please add photos of the trench and re-check quantities (Synthetic).", comments: [{ itemKey: "quantities_measured", comment: "Quantities do not match the photo count (Synthetic)." }] } },
  { no: "INS-2026-900005", project: "INF-PFAC-001", type: "QUALITY", status: "REJECTED", date: "2026-03-05T04:00:00.000Z", purpose: "Concrete quality check (Synthetic)", contractors: ["SYNTH/BETA-001"], fail: ["materials_compliant"],
    defects: [{ key: "mix_out_of_spec", title: "Concrete mix outside the specification (Synthetic)", severity: "CRITICAL", reworkRequired: true }], photos: 1, decision: { kind: "REJECTED", note: "Report is incomplete and the findings need a fresh inspection (Synthetic)." } },
  { no: "INS-2026-900006", project: "INF-PFAC-001", type: "FOLLOW_UP", status: "SCHEDULED", date: "2026-12-05T04:00:00.000Z", priority: "URGENT", purpose: "Follow-up to the rejected quality inspection (Synthetic)", followUpOf: "INS-2026-900005" },
  { no: "INS-2026-900007", project: "INF-DRAINAGE-001", type: "MILESTONE", status: "IN_PROGRESS", date: "2026-11-06T04:00:00.000Z", purpose: "Milestone check on drainage works (Synthetic)", contractors: ["SYNTH/GAMMA-001"] },
  { no: "INS-2026-900008", project: "INF-ROAD-001", type: "FINAL_HANDOVER", status: "SCHEDULED", date: "2026-12-12T04:00:00.000Z", priority: "HIGH", purpose: "Pre-handover inspection (Synthetic)" },
  { no: "INS-2026-900009", project: "INF-BRIDGE-001", type: "QUALITY", status: "CANCELLED", date: "2026-02-10T04:00:00.000Z", purpose: "Bridge deck quality check (Synthetic)", cancelReason: "Project completed before the visit took place (Synthetic)." },
  { no: "INS-2026-900010", project: "INF-ROAD-001", type: "PROGRESS_VERIFICATION", status: "SCHEDULED", date: "2026-11-20T04:00:00.000Z", priority: "NORMAL", purpose: "Routine progress verification (Synthetic)" },
];

const REPORT_TEXT = "Synthetic inspection narrative for demonstration only.";

function reportFor(s: Seed, projectMilestones: Id[]) {
  const failed = new Set(s.fail ?? []);
  return {
    revision: 1, checklistVersion: CHECKLIST_VERSION,
    checklist: checklistFor(s.type).map((i) => failed.has(i.key) ? { key: i.key, result: "FAIL" as const, note: "Did not meet the requirement (Synthetic)." } : { key: i.key, result: "PASS" as const }),
    siteObservations: REPORT_TEXT, workCompletionObservations: REPORT_TEXT, safetyObservations: REPORT_TEXT,
    defects: s.defects ?? [], followUpChecks: [], recommendations: "Continue monitoring (Synthetic).", followUpRequired: Boolean(s.defects?.some((x) => x.reworkRequired)),
    ...(s.measured !== undefined ? { measuredProgress: s.measured } : {}),
    milestoneAssessments: s.measured !== undefined && projectMilestones[0] ? [{ milestoneId: projectMilestones[0], verifiedProgress: s.measured }] : [],
    ...(s.discrepancyNote ? { discrepancyNote: s.discrepancyNote } : {}), inspectorDeclaration: true,
  };
}

export async function seedDemoInspections(context: DemoContext): Promise<{ inspections: number; evidence: number; verifications: number }> {
  const inspector = ctxId(context.users as unknown as Map<string, Id>, "INSPECTOR");
  const reviewer = ctxId(context.users as unknown as Map<string, Id>, "AGENCY_OFFICER");
  const manager = ctxId(context.users as unknown as Map<string, Id>, "PROJECT_MANAGER");
  const storage = getEvidenceStorage();
  const ids = new Map<string, Id>();
  let evidence = 0, verifications = 0;

  // Reported claims are real append-only records, so the claim side of every comparison is a ProgressReport, never a made-up number.
  for (const [code, pct] of [["INF-PFAC-001", 45], ["INF-ROAD-001", 75]] as const) {
    const projectId = ctxId(context.projects as unknown as Map<string, Id>, code);
    if (!(await ProgressReport.exists({ projectId }))) await ProgressReport.create({ projectId, sequence: 1, reportedPercent: pct, previousPercent: 0, note: "Synthetic progress report for the demo.", reporterUserId: manager, reportedAt: d("2026-03-01T06:00:00.000Z") });
  }

  for (const s of SEEDS) {
    const projectId = ctxId(context.projects as unknown as Map<string, Id>, s.project);
    const project = await Project.findById(projectId).select("agencyId geometry").lean();
    if (!project) continue;
    const milestoneIds = ((await (await import("../../../modules/projects/models/milestone.model.js")).Milestone.find({ projectId }).select("_id").limit(1).lean()).map((m) => m._id)) as Id[];
    const date = d(s.date);
    const submitted = ["SUBMITTED", "VERIFIED", "REQUIRES_REVIEW", "REJECTED"].includes(s.status);
    const report = s.status === "SCHEDULED" || s.status === "CANCELLED" ? undefined : reportFor(s, milestoneIds);
    const submittedAt = new Date(date.getTime() + 4 * 3_600_000);
    const decisionAt = new Date(date.getTime() + 28 * 3_600_000);
    const set: Record<string, unknown> = {
      projectId, agencyId: project.agencyId, inspectorId: inspector, inspectionDate: date, inspectionType: s.type, purpose: s.purpose, priority: s.priority ?? "NORMAL", durationMinutes: 120, status: s.status, scheduledBy: manager,
      assignmentHistory: [{ inspectorId: inspector, assignedBy: manager, assignedAt: new Date(date.getTime() - 7 * 86_400_000) }], notes: "Synthetic inspection for the demo.", version: 1,
      contractorIdsAtInspection: submitted ? (s.contractors ?? []).map((c) => ctxId(context.contractors, c)) : [],
      ...(s.followUpOf && ids.has(s.followUpOf) ? { followUpOfId: ids.get(s.followUpOf) } : {}),
      ...(s.status === "CANCELLED" ? { cancelReason: s.cancelReason, cancelledBy: manager, completedAt: date } : {}),
      ...(s.status !== "SCHEDULED" && s.status !== "CANCELLED" ? { startedAt: date } : {}),
      ...(report ? { report } : {}),
      ...(submitted ? { submittedAt, submissions: [{ no: 1, submittedAt, submittedBy: inspector, reportSnapshot: report, ...(s.decision ? { decision: { decision: s.decision.kind, by: reviewer, at: decisionAt, ...(s.decision.note ? { note: s.decision.note } : {}), itemComments: s.decision.comments ?? [] } } : {}) }] } : {}),
      ...(s.decision ? { reviewedBy: reviewer, reviewedAt: decisionAt } : {}),
      ...(s.status === "VERIFIED" || s.status === "REJECTED" ? { completedAt: decisionAt } : {}),
      ...(s.status === "VERIFIED" && s.measured !== undefined ? { physicalProgress: s.measured } : {}),
    };
    const row = await Inspection.findOneAndUpdate({ inspectionNo: s.no }, { $set: set }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
    ids.set(s.no, row._id as Id);

    for (let n = 1; n <= (s.photos ?? 0); n += 1) {
      const bytes = Buffer.concat([PLACEHOLDER_PNG, Buffer.from(`synthetic-${s.no}-${n}`)]);
      const sha = createHash("sha256").update(bytes).digest("hex");
      const evidenceId = (await InspectionEvidence.findOne({ inspectionId: row._id, sha256: sha }).select("_id").lean())?._id ?? new (await import("mongoose")).default.Types.ObjectId();
      const key = storageKeyFor(String(row._id), String(evidenceId), "full");
      if (storage) await storage.put(key, bytes, "image/png");
      const doc = await Document.findOneAndUpdate({ projectId, fileName: `${s.no}-${n}.png` }, { $set: { documentType: "SITE_EVIDENCE", uploadedBy: inspector, mimeType: "image/png", sizeBytes: bytes.length, visibility: "INTERNAL", storageKey: key }, $setOnInsert: { projectId, fileName: `${s.no}-${n}.png` } }, { upsert: true, new: true, runValidators: true });
      await InspectionEvidence.findOneAndUpdate({ _id: evidenceId }, { $set: {
        inspectionId: row._id, projectId, agencyId: project.agencyId, documentId: doc._id, caption: `(Synthetic placeholder) ${s.purpose}`, capturedAt: new Date(date.getTime() + 3_600_000), uploadedAt: new Date(date.getTime() + 3_700_000), uploadedBy: inspector,
        sha256: sha, mimeType: "image/png", width: 1, height: 1, sizeBytes: bytes.length, status: "ACTIVE", ...(s.fail?.[0] && n === 1 ? { checklistItemKey: s.fail[0] } : {}), ...(s.defects?.[0] && n === 1 ? { defectKey: s.defects[0].key } : {}),
      } }, { upsert: true, runValidators: true, setDefaultsOnInsert: true });
      await Inspection.updateOne({ _id: row._id }, { $addToSet: { evidence: doc._id } }, { timestamps: false });
      evidence += 1;
    }

    if (s.verify && s.measured !== undefined) {
      const claimed = s.verify.claimed;
      await ProgressVerification.collection.updateOne({ inspectionId: row._id }, { $setOnInsert: {
        projectId, agencyId: project.agencyId, inspectionId: row._id, submissionNo: 1, verifiedPercent: s.measured, claimedPercent: claimed, discrepancyPp: claimed === null ? null : s.measured - claimed,
        milestones: [], inspectorId: inspector, reviewerId: reviewer, asOf: date, status: "ACTIVE", note: s.discrepancyNote ?? null, contractorIds: (s.contractors ?? []).map((c) => ctxId(context.contractors, c)), createdAt: decisionAt,
      } }, { upsert: true });
      verifications += 1;
    }
  }

  // The earlier synthetic VERIFIED inspection on the road project (68% against 75% reported) becomes a real verification record too.
  const roadId = ctxId(context.projects as unknown as Map<string, Id>, "INF-ROAD-001");
  const roadVerified = await Inspection.findOne({ projectId: roadId, status: "VERIFIED", physicalProgress: 68, inspectionNo: { $exists: false } }).lean()
    ?? await Inspection.findOne({ projectId: roadId, status: "VERIFIED", physicalProgress: 68 }).lean();
  if (roadVerified) {
    const project = await Project.findById(roadId).select("agencyId").lean();
    await ProgressVerification.collection.updateOne({ inspectionId: roadVerified._id }, { $setOnInsert: {
      projectId: roadId, agencyId: project!.agencyId, inspectionId: roadVerified._id, submissionNo: 1, verifiedPercent: 68, claimedPercent: 75, discrepancyPp: -7, milestones: [], inspectorId: inspector, reviewerId: reviewer,
      asOf: roadVerified.inspectionDate, status: "ACTIVE", note: null, contractorIds: [ctxId(context.contractors, "SYNTH/ALPHA-001")], createdAt: new Date(roadVerified.inspectionDate.getTime() + 28 * 3_600_000),
    } }, { upsert: true });
    verifications += 1;
  }

  // Project cache = the latest ACTIVE verification per project.
  for (const code of ["INF-ROAD-001", "INF-PFAC-001"] as const) {
    const projectId = ctxId(context.projects as unknown as Map<string, Id>, code);
    const latest = await ProgressVerification.findOne({ projectId, status: "ACTIVE" }).sort({ asOf: -1 }).lean();
    if (latest) await Project.updateOne({ _id: projectId }, { $set: { verifiedProgress: { percent: latest.verifiedPercent, asOf: latest.asOf, verificationId: latest._id } } }, { timestamps: false });
  }
  return { inspections: SEEDS.length, evidence, verifications };
}

import { createHash } from "node:crypto";

import mongoose from "mongoose";

import { backfillAssets } from "../../../modules/assets/asset.backfill.js";
import { inTransaction } from "../../../modules/assets/asset.common.js";
import { refreshAssetCaches } from "../../../modules/assets/asset-cache.js";
import { AssetConditionAssessment } from "../../../modules/assets/models/asset-condition-assessment.model.js";
import { AssetConversion } from "../../../modules/assets/models/asset-conversion.model.js";
import { Asset } from "../../../modules/assets/models/asset.model.js";
import { MaintenanceEvidence } from "../../../modules/assets/models/maintenance-evidence.model.js";
import { MaintenanceRecord } from "../../../modules/assets/models/maintenance-record.model.js";
import { maintenanceKey } from "../../../modules/assets/maintenance-evidence.service.js";
import { ContractorAssignment } from "../../../modules/contractors/models/contractor-assignment.model.js";
import { Document } from "../../../modules/documents/models/document.model.js";
import { ProjectPayment } from "../../../modules/finance/models/project-payment.model.js";
import { getEvidenceStorage } from "../../../modules/inspections/evidence-storage.js";
import { checklistFor } from "../../../modules/inspections/inspection-checklists.js";
import { Inspection } from "../../../modules/inspections/models/inspection.model.js";
import { ProgressVerification } from "../../../modules/inspections/models/progress-verification.model.js";
import { Project } from "../../../modules/projects/models/project.model.js";
import { d } from "../helpers/dates.js";
import { GEO_BRIDGE_POINT, GEO_ROAD_CORRIDOR } from "../helpers/geometry.js";
import { lkr } from "../helpers/money.js";
import { DEMO_LIFECYCLE_PROJECT_CODES } from "./catalog.js";
import { ctxId, type DemoContext } from "./context.js";

type Id = mongoose.Types.ObjectId;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const PROJECTS = [
  { code: "INF-ROAD-002", title: "Ring Road Section Upgrade (Demo)", type: "ROAD", note: "completed and verified, not yet converted: shows the conversion wizard with warnings" },
  { code: "INF-ROAD-003", title: "Lakeside Road Extension (Demo)", type: "ROAD", note: "already converted into a road and a drainage asset" },
  { code: "INF-DRAINAGE-002", title: "Harbour Link Drainage Works (Demo)", type: "DRAINAGE", note: "conversion request waiting for approval" },
] as const;

/**
 * Synthetic asset-lifecycle story (every description ends with "(Synthetic)"). Fixed numbers in a reserved 9000nn range keep re-seeding
 * idempotent and never consume the real AST / MNT / CNV counters.
 */
export async function seedDemoAssets(context: DemoContext): Promise<{ projects: number; assets: number; assessments: number; maintenance: number; conversions: number }> {
  const asId = (m: Map<string, Id>, k: string) => ctxId(m, k);
  const pm = asId(context.users as unknown as Map<string, Id>, "PROJECT_MANAGER");
  const officer = asId(context.users as unknown as Map<string, Id>, "AGENCY_OFFICER");
  const inspector = asId(context.users as unknown as Map<string, Id>, "INSPECTOR");
  const rda = ctxId(context.agencies, "DEMO_RDA");
  const alpha = ctxId(context.contractors, "SYNTH/ALPHA-001");
  const pid = new Map<string, Id>();

  for (const p of PROJECTS) {
    const doc = await Project.findOneAndUpdate({ projectCode: p.code }, { $set: {
      title: p.title, description: `${p.title}: ${p.note} (Synthetic)`, projectType: p.type, agencyId: rda, managerId: pm, contractorId: alpha, geometry: GEO_ROAD_CORRIDOR, startDate: d("2025-06-01T00:00:00.000Z"),
      plannedEndDate: d("2026-03-31T00:00:00.000Z"), actualEndDate: d("2026-03-28T00:00:00.000Z"), budget: lkr(400_000_000_00), physicalProgress: 100, financialProgress: 92, status: "COMPLETED", createdBy: pm,
    }, $setOnInsert: { projectCode: p.code } }, { upsert: true, new: true, runValidators: true });
    pid.set(p.code, doc._id as Id);
    // A real 100% approved verification plus an approved final-handover inspection per project.
    const insp = await Inspection.findOneAndUpdate({ inspectionNo: `INS-2026-9001${PROJECTS.indexOf(p) + 1}0` }, { $set: {
      projectId: doc._id, agencyId: rda, inspectorId: inspector, inspectionDate: d("2026-03-26T04:00:00.000Z"), inspectionType: "FINAL_HANDOVER", purpose: "Final handover inspection (Synthetic)", priority: "NORMAL", durationMinutes: 120, status: "VERIFIED",
      scheduledBy: pm, notes: "Synthetic inspection for the demo.", version: 1, physicalProgress: 100, startedAt: d("2026-03-26T04:00:00.000Z"), submittedAt: d("2026-03-26T09:00:00.000Z"), reviewedBy: officer, reviewedAt: d("2026-03-27T04:00:00.000Z"), completedAt: d("2026-03-27T04:00:00.000Z"),
      contractorIdsAtInspection: [alpha], assignmentHistory: [{ inspectorId: inspector, assignedBy: pm, assignedAt: d("2026-03-19T04:00:00.000Z") }],
      submissions: [{ no: 1, submittedAt: d("2026-03-26T09:00:00.000Z"), submittedBy: inspector, reportSnapshot: {
        revision: 1, checklistVersion: "k1", checklist: checklistFor("FINAL_HANDOVER").map((i) => ({ key: i.key, result: "PASS" as const })), siteObservations: "Works are complete (Synthetic).", measuredProgress: 100, inspectorDeclaration: true,
        defects: p.code === "INF-ROAD-002" ? [{ key: "edge_settlement", title: "Edge settlement near the culvert (Synthetic)", severity: "MAJOR", reworkRequired: true }] : [], followUpChecks: [], milestoneAssessments: [], followUpRequired: false,
      }, decision: { decision: "APPROVED", by: officer, at: d("2026-03-27T04:00:00.000Z"), note: "Approved (Synthetic).", itemComments: [] } }],
    } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
    await ProgressVerification.collection.updateOne({ inspectionId: insp._id }, { $setOnInsert: {
      projectId: doc._id, agencyId: rda, inspectionId: insp._id, submissionNo: 1, verifiedPercent: 100, claimedPercent: 100, discrepancyPp: 0, milestones: [], inspectorId: inspector, reviewerId: officer, asOf: d("2026-03-26T04:00:00.000Z"),
      status: "ACTIVE", note: null, contractorIds: [alpha], createdAt: d("2026-03-27T04:00:00.000Z"),
    } }, { upsert: true });
    await ContractorAssignment.findOneAndUpdate({ projectId: doc._id, contractorId: alpha, startDate: d("2025-06-01T00:00:00.000Z") }, { $set: { agencyId: rda, role: "PRIMARY", status: p.code === "INF-ROAD-002" ? "ACTIVE" : "ENDED", assignedBy: pm, ...(p.code === "INF-ROAD-002" ? {} : { endDate: d("2026-03-28T00:00:00.000Z"), endedBy: pm, endReason: "Works completed (Synthetic)." }) }, $setOnInsert: { projectId: doc._id, contractorId: alpha, startDate: d("2025-06-01T00:00:00.000Z") } }, { upsert: true });
  }
  // Project A: an unpaid retention payment (a WARN gate in the wizard).
  const aId = pid.get("INF-ROAD-002")!;
  await ProjectPayment.findOneAndUpdate({ paymentNo: "PAY-DEMO-0101" }, { $set: { projectId: aId, agencyId: rda, contractorId: alpha, amount: lkr(50_000_000_00), paymentType: "RETENTION", status: "PENDING", invoiceReference: "SYN-INV-RET-001", description: "Retention release (Synthetic)", date: d("2026-04-01T00:00:00.000Z"), requestedAt: d("2026-04-01T00:00:00.000Z"), createdBy: pm, dupActive: true }, $setOnInsert: { paymentNo: "PAY-DEMO-0101" } }, { upsert: true });

  // Project B: an approved conversion that produced a road and a drainage asset.
  const bId = pid.get("INF-ROAD-003")!;
  const handover = { handoverDate: d("2026-04-05T00:00:00.000Z"), handoverNote: "Handed over to the road agency (Synthetic).", defectsLiabilityEndsOn: d("2027-06-30T00:00:00.000Z"), documentIds: [], conditionAtHandover: "UNKNOWN" as const };
  const conv = await AssetConversion.findOneAndUpdate({ conversionNo: "CNV-2026-900001" }, { $set: {
    projectId: bId, agencyId: rda, status: "APPROVED", requestedBy: pm, requestedAt: d("2026-04-02T04:00:00.000Z"), decidedBy: officer, decidedAt: d("2026-04-04T04:00:00.000Z"), decisionNote: "Approved (Synthetic).", receivingAgencyId: rda, handover,
    proposedAssets: [{ key: "road", assetType: "ROAD", name: "Lakeside Road (Synthetic)", geometrySource: "PROJECT" }, { key: "drain", assetType: "DRAINAGE", name: "Lakeside Side Drain (Synthetic)", geometrySource: "NONE" }], gateResults: [], version: 1,
  }, $setOnInsert: { conversionNo: "CNV-2026-900001" } }, { upsert: true, new: true, runValidators: true });
  const mkAsset = (no: string, name: string, over: Record<string, unknown>) => Asset.findOneAndUpdate({ assetNo: no }, { $set: { name, agencyId: rda, operationalStatus: "IN_SERVICE", version: 0, ...over }, $setOnInsert: { assetNo: no } }, { upsert: true, new: true, runValidators: true });
  const road = await mkAsset("AST-2026-900001", "Lakeside Road (Synthetic)", { sourceProjectId: bId, origin: "CONVERSION", conversionId: conv._id, assetType: "ROAD", geometry: GEO_ROAD_CORRIDOR, constructionAgencyId: rda, handoverAt: handover.handoverDate, defectsLiabilityEndsOn: handover.defectsLiabilityEndsOn, commissionedAt: handover.handoverDate, condition: "UNKNOWN", monitoringIntervalDays: 365, location: { district: "Colombo", locality: "Lakeside" } });
  const drain = await mkAsset("AST-2026-900002", "Lakeside Side Drain (Synthetic)", { sourceProjectId: bId, origin: "CONVERSION", conversionId: conv._id, assetType: "DRAINAGE", constructionAgencyId: rda, handoverAt: handover.handoverDate, defectsLiabilityEndsOn: handover.defectsLiabilityEndsOn, commissionedAt: handover.handoverDate, condition: "UNKNOWN", monitoringIntervalDays: 365, location: { district: "Colombo", locality: "Lakeside" } });
  await AssetConversion.updateOne({ _id: conv._id }, { $set: { createdAssetIds: [road._id, drain._id] } });
  // The drain gets one early assessment that is now too old to count: its condition component is unavailable.
  // Project C: a conversion request waiting for a GOV_ADMIN (the requester is the project manager).
  await AssetConversion.findOneAndUpdate({ conversionNo: "CNV-2026-900002" }, { $set: {
    projectId: pid.get("INF-DRAINAGE-002")!, agencyId: rda, status: "PENDING_APPROVAL", requestedBy: pm, requestedAt: d("2026-10-20T04:00:00.000Z"), receivingAgencyId: rda,
    handover: { handoverDate: d("2026-10-18T00:00:00.000Z"), handoverNote: "Awaiting approval (Synthetic).", documentIds: [], conditionAtHandover: "UNKNOWN" },
    proposedAssets: [{ key: "harbour_drain", assetType: "DRAINAGE", name: "Harbour Link Drain (Synthetic)", geometrySource: "PROJECT" }], gateResults: [], version: 0,
  }, $setOnInsert: { conversionNo: "CNV-2026-900002" } }, { upsert: true, new: true, runValidators: true });

  // The existing demo bridge: three assessments over time (EXCELLENT, GOOD, POOR) with open issues, plus maintenance.
  const bridgeProject = ctxId(context.projects as unknown as Map<string, Id>, "INF-BRIDGE-001");
  const bridge = await Asset.findOne({ sourceProjectId: bridgeProject, name: "Demo Riverside Bridge Asset" });
  const culvert = await mkAsset("AST-2026-900003", "Old Culvert (Synthetic, legacy)", { sourceProjectId: bridgeProject, origin: "LEGACY", assetType: "DRAINAGE", geometry: GEO_BRIDGE_POINT, commissionedAt: d("2023-01-01T00:00:00.000Z"), condition: "FAIR", monitoringIntervalDays: 365, constructionAgencyId: rda, location: { district: "Colombo", locality: "Demo riverside" } });
  let assessments = 0, maintenance = 0;
  if (bridge) {
    await Asset.updateOne({ _id: bridge._id }, { $set: { monitoringIntervalDays: 180, operationalStatus: "IN_SERVICE" }, $unset: { healthScore: 1 } });
    const bridgeInsp = await Inspection.findOneAndUpdate({ inspectionNo: "INS-2026-900120" }, { $set: {
      projectId: bridgeProject, agencyId: rda, assetId: bridge._id, inspectorId: inspector, inspectionDate: d("2026-03-10T04:00:00.000Z"), inspectionType: "ASSET_CONDITION", purpose: "Condition survey of the bridge (Synthetic)", priority: "NORMAL", durationMinutes: 120, status: "VERIFIED",
      scheduledBy: pm, notes: "Synthetic inspection for the demo.", version: 1, startedAt: d("2026-03-10T04:00:00.000Z"), submittedAt: d("2026-03-10T09:00:00.000Z"), reviewedBy: officer, reviewedAt: d("2026-03-11T04:00:00.000Z"), completedAt: d("2026-03-11T04:00:00.000Z"),
      assignmentHistory: [{ inspectorId: inspector, assignedBy: pm, assignedAt: d("2026-03-03T04:00:00.000Z") }],
      submissions: [{ no: 1, submittedAt: d("2026-03-10T09:00:00.000Z"), submittedBy: inspector, reportSnapshot: { revision: 1, checklistVersion: "k1", checklist: checklistFor("ASSET_CONDITION").map((i) => ({ key: i.key, result: "PASS" as const })), siteObservations: "Bridge is in good condition (Synthetic).", conditionRating: "GOOD", inspectorDeclaration: true, defects: [], followUpChecks: [], milestoneAssessments: [], followUpRequired: false }, decision: { decision: "APPROVED", by: officer, at: d("2026-03-11T04:00:00.000Z"), note: "Approved (Synthetic).", itemComments: [] } }],
    } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
    const sets: { asset: Id; at: string; condition: string; basis: string; inspection?: Id; issues: { key: string; title: string; severity: string; status: string }[]; note: string }[] = [
      { asset: bridge._id as Id, at: "2025-12-20T04:00:00.000Z", condition: "EXCELLENT", basis: "MANUAL_ENTRY", issues: [], note: "Handover survey: no defects noted (Synthetic)." },
      { asset: bridge._id as Id, at: "2026-03-10T04:00:00.000Z", condition: "GOOD", basis: "INSPECTION_VERIFIED", inspection: bridgeInsp._id as Id, issues: [{ key: "joint_wear", title: "Expansion joint wear (Synthetic)", severity: "MINOR", status: "OPEN" }], note: "Verified condition survey (Synthetic)." },
      { asset: bridge._id as Id, at: "2026-08-15T04:00:00.000Z", condition: "POOR", basis: "MANUAL_ENTRY", issues: [{ key: "joint_wear", title: "Expansion joint wear (Synthetic)", severity: "MAJOR", status: "OPEN" }, { key: "deck_cracks", title: "Deck cracking after the floods (Synthetic)", severity: "MAJOR", status: "OPEN" }], note: "Post-flood survey found deck cracking and worn joints (Synthetic)." },
      { asset: culvert._id as Id, at: "2024-02-01T04:00:00.000Z", condition: "FAIR", basis: "MANUAL_ENTRY", issues: [], note: "Routine survey from some time ago, now too old to count (Synthetic)." },
    ];
    const ids: Id[] = [];
    for (const s of sets) {
      const res = await AssetConditionAssessment.collection.findOneAndUpdate({ assetId: s.asset, assessedAt: d(s.at) }, { $setOnInsert: {
        assetId: s.asset, agencyId: rda, assessedAt: d(s.at), condition: s.condition, basis: s.basis, ...(s.inspection ? { inspectionId: s.inspection } : {}), observations: s.note, issues: s.issues, assessedBy: s.basis === "INSPECTION_VERIFIED" ? inspector : officer,
        ...(s.inspection ? { reviewedBy: officer } : {}), status: "SUPERSEDED", maintenanceRefs: [], createdAt: d(s.at) } }, { upsert: true, returnDocument: "after" });
      ids.push(res!._id as Id);
      assessments += 1;
    }
    // Newest per asset is ACTIVE; older ones are SUPERSEDED and point at it.
    const latestByAsset = new Map<string, Id>([[String(bridge._id), ids[2]!], [String(culvert._id), ids[3]!]]);
    for (const [k, latest] of latestByAsset) {
      await AssetConditionAssessment.collection.updateOne({ _id: latest }, { $set: { status: "ACTIVE" }, $unset: { supersededBy: "" } });
      await AssetConditionAssessment.collection.updateMany({ assetId: new mongoose.Types.ObjectId(k), _id: { $ne: latest } }, { $set: { status: "SUPERSEDED", supersededBy: latest } });
    }
    // Maintenance: an overdue preventive job (recurs every 180 days), a waiting request, and a completed corrective job with an actual cost and one photo.
    const mk = async (no: string, over: Record<string, unknown>) => MaintenanceRecord.findOneAndUpdate({ maintenanceNo: no }, { $set: { assetId: bridge._id, agencyId: rda, requestedBy: pm, version: 0, ...over }, $setOnInsert: { maintenanceNo: no } }, { upsert: true, new: true, runValidators: true });
    await mk("MNT-2026-900001", { title: "Bridge bearing inspection and greasing (Synthetic)", maintenanceType: "PREVENTIVE", priority: "NORMAL", origin: "PLANNED", status: "SCHEDULED", scheduledDate: d("2026-09-01T04:00:00.000Z"), requestedAt: d("2026-07-01T04:00:00.000Z"), recurrenceDays: 180, tasks: [{ key: "inspect", title: "Inspect bearings", done: false }, { key: "grease", title: "Grease bearings", done: false }], estimatedCost: lkr(300_000_00) });
    await mk("MNT-2026-900002", { title: "Repair deck cracks (Synthetic)", maintenanceType: "CORRECTIVE", priority: "HIGH", origin: "REQUEST", status: "REQUESTED", scheduledDate: d("2026-11-20T04:00:00.000Z"), requestedAt: d("2026-09-20T04:00:00.000Z"), linkedIssueKeys: ["deck_cracks"], estimatedCost: lkr(1_200_000_00), description: "Cracks found after the floods (Synthetic)." });
    const done = await mk("MNT-2026-900003", { title: "Patch joint seal (Synthetic)", maintenanceType: "CORRECTIVE", priority: "NORMAL", origin: "REQUEST", status: "COMPLETED", scheduledDate: d("2026-06-10T04:00:00.000Z"), completedDate: d("2026-06-12T04:00:00.000Z"), startedAt: d("2026-06-11T04:00:00.000Z"), requestedAt: d("2026-05-28T04:00:00.000Z"), decidedBy: officer, decidedAt: d("2026-06-01T04:00:00.000Z"), completedBy: officer, completionNotes: "Joint seal replaced and tested (Synthetic).", outcome: "RESOLVED", estimatedCost: lkr(400_000_00), cost: lkr(450_000_00), tasks: [{ key: "seal", title: "Replace the seal", done: true }] });
    maintenance = 3;
    const storage = getEvidenceStorage();
    const bytes = Buffer.concat([PNG, Buffer.from("synthetic-maintenance-MNT-2026-900003")]);
    const sha = createHash("sha256").update(bytes).digest("hex");
    const evId = (await MaintenanceEvidence.findOne({ maintenanceId: done._id, sha256: sha }).select("_id").lean())?._id ?? new mongoose.Types.ObjectId();
    const key = maintenanceKey(String(done._id), String(evId), "full");
    if (storage) await storage.put(key, bytes, "image/png");
    const doc = await Document.findOneAndUpdate({ projectId: bridgeProject, fileName: "MNT-2026-900003-1.png" }, { $set: { documentType: "SITE_EVIDENCE", uploadedBy: officer, mimeType: "image/png", sizeBytes: bytes.length, visibility: "INTERNAL", storageKey: key }, $setOnInsert: { projectId: bridgeProject, fileName: "MNT-2026-900003-1.png" } }, { upsert: true, new: true, runValidators: true });
    await MaintenanceEvidence.findOneAndUpdate({ _id: evId }, { $set: { maintenanceId: done._id, assetId: bridge._id, agencyId: rda, documentId: doc._id, caption: "(Synthetic placeholder) joint seal repair", capturedAt: d("2026-06-12T03:00:00.000Z"), uploadedAt: d("2026-06-12T03:30:00.000Z"), uploadedBy: officer, sha256: sha, mimeType: "image/png", width: 1, height: 1, sizeBytes: bytes.length, status: "ACTIVE" } }, { upsert: true, runValidators: true, setDefaultsOnInsert: true });
  }
  await backfillAssets(true);
  for (const a of await Asset.find({ $or: [{ assetNo: /^AST-2026-9000/ }, ...(bridge ? [{ _id: bridge._id }] : [])] }).select("_id").lean()) await inTransaction((s) => refreshAssetCaches(a._id as Id, s));
  return { projects: PROJECTS.length, assets: 3 + (bridge ? 1 : 0), assessments, maintenance, conversions: 2 };
}

export { DEMO_LIFECYCLE_PROJECT_CODES };

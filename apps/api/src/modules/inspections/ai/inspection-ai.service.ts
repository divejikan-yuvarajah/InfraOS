import { createHash } from "node:crypto";
import mongoose from "mongoose";

import { env } from "../../../config/env.js";
import { AuditLog } from "../../audit/models/audit-log.model.js";
import { Project } from "../../projects/models/project.model.js";
import { Milestone } from "../../projects/models/milestone.model.js";
import { ProgressVerification } from "../models/progress-verification.model.js";
import { Inspection, type InspectionDocument } from "../models/inspection.model.js";
import { InspectionEvidence, type InspectionEvidenceDocument } from "../models/inspection-evidence.model.js";
import { InspectionAiAnalysis, nextAnalysisNo, type InspectionAiAnalysisDocument } from "./models/inspection-ai-analysis.model.js";
import { getEvidenceStorage, storageKeyFor } from "../evidence-storage.js";
import { checkGate, recordGate, loadEffectiveSettings } from "../../ai/governance/ai-gate.js";
import { runDeterministicQualityChecks } from "./quality-checks.js";
import { verifyVisionOutput } from "./vision-verify.js";
import { aiClient } from "../../ai/ai-client.js";
import type { AuthenticatedActor } from "../../identity/auth/require-authenticated.js";

export class InspectionAiFlowError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
  }
}

async function streamToBuffer(readable: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function computeContextHash(params: {
  inspectionId: string;
  evidenceHashes: string[];
  claimedProgress?: number | null;
  milestoneIds?: string[];
}): string {
  const sortedHashes = [...params.evidenceHashes].sort();
  const sortedMilestones = [...(params.milestoneIds ?? [])].sort();
  const raw = `${params.inspectionId}:${sortedHashes.join(",")}:${params.claimedProgress ?? 0}:${sortedMilestones.join(",")}`;
  return createHash("sha256").update(raw).digest("hex");
}

export type InspectionRoleCheck = {
  isInspector: boolean;
  isReviewer: boolean;
  eligible: boolean;
  reason?: string;
};

export function checkInspectionRole(
  inspection: InspectionDocument,
  actor: AuthenticatedActor,
  permissions: readonly string[],
): InspectionRoleCheck {
  const isAssignedInspector =
    inspection.inspectorId?.toString() === actor.userId && permissions.includes("inspection.submit");
  const hasReviewerPerm = permissions.includes("inspection.verify") || permissions.includes("inspection.reject");

  // A reviewer cannot be the submitter of the latest report submission
  const lastSub = inspection.submissions?.[inspection.submissions.length - 1];
  const isSubmitter = lastSub?.submittedBy?.toString() === actor.userId;
  const isReviewer = hasReviewerPerm && !isSubmitter;

  // Assigned inspector can analyze during IN_PROGRESS or REQUIRES_REVIEW
  if (isAssignedInspector) {
    if (inspection.status === "IN_PROGRESS" || inspection.status === "REQUIRES_REVIEW") {
      return { isInspector: true, isReviewer: false, eligible: true };
    }
    return {
      isInspector: true,
      isReviewer: false,
      eligible: false,
      reason: `Inspector analysis only allowed during IN_PROGRESS or REQUIRES_REVIEW (current status: ${inspection.status})`,
    };
  }

  // Reviewer can analyze as a second look during SUBMITTED
  if (isReviewer) {
    if (inspection.status === "SUBMITTED") {
      return { isInspector: false, isReviewer: true, eligible: true };
    }
    return {
      isInspector: false,
      isReviewer: true,
      eligible: false,
      reason: `Reviewer analysis only allowed during SUBMITTED (current status: ${inspection.status})`,
    };
  }

  return {
    isInspector: false,
    isReviewer: false,
    eligible: false,
    reason: "You must be the assigned inspector or an independent reviewer to run evidence analysis",
  };
}

export async function getVisionEligibility(actor: AuthenticatedActor, inspectionId: string, permissions: readonly string[]) {
  if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
    throw new InspectionAiFlowError(404, "NOT_FOUND");
  }

  const inspection = await Inspection.findById(inspectionId);
  if (!inspection) throw new InspectionAiFlowError(404, "NOT_FOUND");

  // Scope check
  if (actor.roleKey !== "SUPER_ADMIN" && inspection.agencyId?.toString() !== actor.agencyId) {
    throw new InspectionAiFlowError(404, "NOT_FOUND");
  }

  const settings = await loadEffectiveSettings(actor.agencyId);
  const visionEnabled = settings.featureToggles.vision;

  const roleCheck = checkInspectionRole(inspection, actor, permissions);

  // Load active evidence
  const evidenceRows = await InspectionEvidence.find({
    inspectionId: inspection._id,
    status: "ACTIVE",
  }).sort({ capturedAt: 1 }).limit(50).lean();

  const selectableEvidence = evidenceRows.map((e) => ({
    evidenceId: e._id.toString(),
    sha256: e.sha256,
    capturedAt: e.capturedAt,
    uploadedAt: e.uploadedAt,
    sitePresence: e.sitePresence,
    checklistItemKey: e.checklistItemKey,
    defectKey: e.defectKey,
    width: e.width,
    height: e.height,
  }));

  // Load project milestones for preview
  const milestones = await Milestone.find({
    projectId: inspection.projectId,
  }).select("_id title").lean();

  const qualityPreview = runDeterministicQualityChecks({
    inspectionDate: inspection.inspectionDate,
    evidence: evidenceRows,
    milestones: milestones.map((m) => ({ _id: m._id.toString(), title: m.title })),
  });

  return {
    visionEnabled,
    eligible: roleCheck.eligible && visionEnabled,
    role: roleCheck.isInspector ? "INSPECTOR" : roleCheck.isReviewer ? "REVIEWER" : "NONE",
    ineligibleReason: !visionEnabled ? "Vision analysis is disabled by system policy" : roleCheck.reason,
    selectableEvidence,
    qualityPreview,
    estimatedCostUnits: 10 + 2 * Math.min(6, selectableEvidence.length),
    maxImages: 6,
  };
}

export async function requestVisionAnalysis(
  actor: AuthenticatedActor,
  inspectionId: string,
  input: { evidenceIds: string[]; acknowledgedProvider: boolean },
  permissions: readonly string[],
  requestId: string,
) {
  if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
    throw new InspectionAiFlowError(404, "NOT_FOUND");
  }

  const inspection = await Inspection.findById(inspectionId);
  if (!inspection) throw new InspectionAiFlowError(404, "NOT_FOUND");

  if (actor.roleKey !== "SUPER_ADMIN" && inspection.agencyId?.toString() !== actor.agencyId) {
    throw new InspectionAiFlowError(404, "NOT_FOUND");
  }

  const roleCheck = checkInspectionRole(inspection, actor, permissions);
  if (!roleCheck.eligible) {
    throw new InspectionAiFlowError(403, "FORBIDDEN", { reason: roleCheck.reason });
  }

  if (!input.acknowledgedProvider) {
    throw new InspectionAiFlowError(400, "PROVIDER_ACKNOWLEDGEMENT_REQUIRED", {
      message: "Explicit acknowledgement of third-party provider processing is required for vision analysis",
    });
  }

  if (!Array.isArray(input.evidenceIds) || input.evidenceIds.length === 0 || input.evidenceIds.length > 6) {
    throw new InspectionAiFlowError(400, "VALIDATION_ERROR", {
      message: "Between 1 and 6 evidence photos must be selected",
    });
  }

  // Feature toggle and gate check
  const costUnits = 10 + 2 * input.evidenceIds.length;
  const gate = await checkGate({
    actor,
    agencyId: inspection.agencyId?.toString(),
    feature: "vision",
    tier: "VISION",
    estimate: { inputTokens: 1200, outputTokens: 800, images: input.evidenceIds.length, costUnits },
  });

  if (!gate.allow) {
    if (gate.deny.code === "FEATURE_DISABLED") {
      throw new InspectionAiFlowError(403, "FEATURE_DISABLED", { message: gate.deny.message });
    }
    if (gate.deny.code === "AI_BUDGET_EXCEEDED") {
      throw new InspectionAiFlowError(429, "AI_BUDGET_EXCEEDED", { resetsAt: gate.deny.resetsAt });
    }
    if (gate.deny.code === "AI_RATE_LIMITED") {
      throw new InspectionAiFlowError(429, "AI_RATE_LIMITED", { retryAfterSeconds: gate.deny.retryAfterSeconds });
    }
    throw new InspectionAiFlowError(503, "AI_UNAVAILABLE", { reason: gate.deny.code });
  }

  // Load and re-verify evidence documents
  const evidenceDocs = await InspectionEvidence.find({
    _id: { $in: input.evidenceIds.map((id) => new mongoose.Types.ObjectId(id)) },
    inspectionId: inspection._id,
    status: "ACTIVE",
  });

  if (evidenceDocs.length !== input.evidenceIds.length) {
    throw new InspectionAiFlowError(400, "INVALID_EVIDENCE", {
      message: "One or more selected evidence photos are not active or not linked to this inspection",
    });
  }

  // Check context hash for existing analysis
  const evidenceHashes = evidenceDocs.map((e) => e.sha256);
  const contextHash = computeContextHash({
    inspectionId,
    evidenceHashes,
    claimedProgress: inspection.report?.measuredProgress ?? inspection.claimedProgressAtSchedule,
    milestoneIds: inspection.milestoneIds?.map((m) => m.toString()),
  });

  const existingAnalysis = await InspectionAiAnalysis.findOne({
    inspectionId: inspection._id,
    contextHash,
    status: { $in: ["QUEUED", "RUNNING", "READY"] },
  }).sort({ createdAt: -1 });

  if (existingAnalysis) {
    return {
      status: existingAnalysis.status === "READY" ? 200 : 202,
      analysis: existingAnalysis,
      cached: true,
    };
  }

  const analysisNo = await nextAnalysisNo();
  const storage = getEvidenceStorage();

  // Load project & milestones for context
  const project = await Project.findById(inspection.projectId).lean();
  const milestones = await Milestone.find({
    projectId: inspection.projectId,
  }).lean();

  const prevVerif = await ProgressVerification.findOne({
    projectId: inspection.projectId,
  }).sort({ verifiedAt: -1 }).lean();

  const qualityChecks = runDeterministicQualityChecks({
    inspectionDate: inspection.inspectionDate,
    evidence: evidenceDocs,
    milestones: milestones.map((m) => ({ _id: m._id.toString(), title: m.title })),
  });

  const analysisRow = await InspectionAiAnalysis.create({
    analysisNo,
    inspectionId: inspection._id,
    projectId: inspection.projectId,
    agencyId: inspection.agencyId,
    requestedBy: new mongoose.Types.ObjectId(actor.userId),
    requestedByRole: roleCheck.isInspector ? "INSPECTOR" : "REVIEWER",
    evidence: evidenceDocs.map((e) => ({
      evidenceId: e._id,
      sha256: e.sha256,
      capturedAt: e.capturedAt,
      sitePresence: e.sitePresence,
    })),
    contextHash,
    status: "RUNNING",
    qualityChecks,
    promptVersion: "vision.v1",
    usage: { inputTokens: 0, outputTokens: 0, images: evidenceDocs.length },
    inspectorReview: { status: "PENDING", decisions: {} },
  });

  await AuditLog.create({
    action: "ai.vision_analysis_requested",
    actorUserId: new mongoose.Types.ObjectId(actor.userId),
    resourceType: "Inspection",
    resourceId: inspection._id,
    agencyId: inspection.agencyId,
    afterSnapshot: { analysisNo, evidenceCount: evidenceDocs.length, status: "RUNNING" },
    metadata: { requestId },
  }).catch(() => undefined);

  // Read images and convert to base64 data URLs
  const imageInputs: Array<{ n: number; dataUrl: string }> = [];
  try {
    for (let i = 0; i < evidenceDocs.length; i++) {
      const doc = evidenceDocs[i]!;
      const key = storageKeyFor(inspectionId, doc._id.toString(), "full");
      if (storage) {
        const stream = storage.open(key);
        const buf = await streamToBuffer(stream);
        const actualHash = createHash("sha256").update(buf).digest("hex");
        if (actualHash !== doc.sha256) {
          throw new Error(`Hash mismatch for evidence ${doc._id}`);
        }
        imageInputs.push({
          n: i + 1,
          dataUrl: `data:${doc.mimeType};base64,${buf.toString("base64")}`,
        });
      } else {
        // Fallback for tests or local mode without GridFS storage
        imageInputs.push({
          n: i + 1,
          dataUrl: `data:image/jpeg;base64,${Buffer.from("dummy-image-bytes").toString("base64")}`,
        });
      }
    }
  } catch (err) {
    analysisRow.status = "FAILED";
    analysisRow.errorCode = "EVIDENCE_READ_ERROR";
    await analysisRow.save();
    return { status: 202, analysis: analysisRow };
  }

  // Call FastAPI /v1/llm/vision-analyze
  const allowedPercentages: number[] = [];
  if (inspection.claimedProgressAtSchedule != null) allowedPercentages.push(inspection.claimedProgressAtSchedule);
  if (inspection.report?.measuredProgress != null) allowedPercentages.push(inspection.report.measuredProgress);
  if (prevVerif?.verifiedPercent != null) allowedPercentages.push(prevVerif.verifiedPercent);
  for (const m of milestones) {
    if (m.progress != null) allowedPercentages.push(m.progress);
  }

  const contextData = {
    projectType: (project as any)?.projectType ?? "ROAD",
    inspectionType: inspection.inspectionType ?? "PROGRESS_VERIFICATION",
    milestones: milestones.map((m) => ({
      title: m.title.slice(0, 200),
      plannedStart: m.plannedStart?.toISOString(),
      plannedEnd: m.plannedEnd?.toISOString(),
      reportedProgress: m.progress ?? null,
    })),
    claimedProgress: inspection.report?.measuredProgress ?? inspection.claimedProgressAtSchedule ?? null,
    previousVerifiedProgress: prevVerif ? { percent: prevVerif.verifiedPercent, asOf: prevVerif.asOf?.toISOString() } : null,
    inspectionDate: inspection.inspectionDate.toISOString(),
  };

  try {
    const response = await aiClient().visionAnalyze({
      images: imageInputs,
      context: contextData,
      maxOutputTokens: 2000,
    });

    const verifiedResult = verifyVisionOutput({
      raw: response.output as any,
      imageCount: imageInputs.length,
      allowedPercentages,
    });

    analysisRow.status = "READY";
    analysisRow.result = verifiedResult as any;
    analysisRow.set("model", response.model);
    analysisRow.usage = {
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      images: imageInputs.length,
    };
    await analysisRow.save();

    await recordGate({
      actor,
      agencyId: inspection.agencyId?.toString(),
      feature: "vision",
      tier: "VISION",
      model: response.model,
      actual: {
        status: "OK",
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        images: imageInputs.length,
        latencyMs: 1000,
        costUnits,
      },
    }).catch(() => undefined);

    await AuditLog.create({
      action: "ai.vision_analysis_completed",
      actorUserId: new mongoose.Types.ObjectId(actor.userId),
      resourceType: "Inspection",
      resourceId: inspection._id,
      agencyId: inspection.agencyId,
      afterSnapshot: { analysisNo, status: "READY", droppedStatements: verifiedResult.droppedStatements },
      metadata: { requestId },
    }).catch(() => undefined);

    return { status: 202, analysis: analysisRow };
  } catch (err: any) {
    // If AI service fails, analysisRow is marked FAILED; inspection workflow remains unaffected
    analysisRow.status = "FAILED";
    analysisRow.errorCode = err?.code ?? "AI_UNAVAILABLE";
    await analysisRow.save();

    await AuditLog.create({
      action: "ai.vision_analysis_failed",
      actorUserId: new mongoose.Types.ObjectId(actor.userId),
      resourceType: "Inspection",
      resourceId: inspection._id,
      agencyId: inspection.agencyId,
      afterSnapshot: { analysisNo, status: "FAILED", errorCode: analysisRow.errorCode },
      metadata: { requestId },
    }).catch(() => undefined);

    return { status: 202, analysis: analysisRow };
  }
}

export async function listVisionAnalyses(actor: AuthenticatedActor, inspectionId: string) {
  if (!mongoose.Types.ObjectId.isValid(inspectionId)) throw new InspectionAiFlowError(404, "NOT_FOUND");
  const inspection = await Inspection.findById(inspectionId).select("agencyId");
  if (!inspection) throw new InspectionAiFlowError(404, "NOT_FOUND");
  if (actor.roleKey !== "SUPER_ADMIN" && inspection.agencyId?.toString() !== actor.agencyId) {
    throw new InspectionAiFlowError(404, "NOT_FOUND");
  }

  const rows = await InspectionAiAnalysis.find({
    inspectionId: inspection._id,
  }).sort({ createdAt: -1 }).limit(20).lean();

  return { analyses: rows };
}

export async function getVisionAnalysis(actor: AuthenticatedActor, inspectionId: string, analysisId: string) {
  if (!mongoose.Types.ObjectId.isValid(inspectionId) || !mongoose.Types.ObjectId.isValid(analysisId)) {
    throw new InspectionAiFlowError(404, "NOT_FOUND");
  }

  const inspection = await Inspection.findById(inspectionId).select("agencyId");
  if (!inspection) throw new InspectionAiFlowError(404, "NOT_FOUND");
  if (actor.roleKey !== "SUPER_ADMIN" && inspection.agencyId?.toString() !== actor.agencyId) {
    throw new InspectionAiFlowError(404, "NOT_FOUND");
  }

  const row = await InspectionAiAnalysis.findOne({
    _id: new mongoose.Types.ObjectId(analysisId),
    inspectionId: inspection._id,
  });

  if (!row) throw new InspectionAiFlowError(404, "NOT_FOUND");

  return { analysis: row };
}

export async function reviewVisionAnalysis(
  actor: AuthenticatedActor,
  inspectionId: string,
  analysisId: string,
  input: { decisions: Record<string, { decision: "CONFIRMED" | "DISPUTED" | "NOT_RELEVANT"; comment?: string }> },
  permissions: readonly string[],
  requestId: string,
) {
  if (!mongoose.Types.ObjectId.isValid(inspectionId) || !mongoose.Types.ObjectId.isValid(analysisId)) {
    throw new InspectionAiFlowError(404, "NOT_FOUND");
  }

  const inspection = await Inspection.findById(inspectionId);
  if (!inspection) throw new InspectionAiFlowError(404, "NOT_FOUND");
  if (actor.roleKey !== "SUPER_ADMIN" && inspection.agencyId?.toString() !== actor.agencyId) {
    throw new InspectionAiFlowError(404, "NOT_FOUND");
  }

  // Only the assigned inspector can submit review decisions
  const isAssigned = inspection.inspectorId?.toString() === actor.userId && permissions.includes("inspection.submit");
  if (!isAssigned) {
    throw new InspectionAiFlowError(403, "FORBIDDEN", {
      message: "Only the assigned inspector can record review decisions on advisory AI analyses",
    });
  }

  const analysis = await InspectionAiAnalysis.findOne({
    _id: new mongoose.Types.ObjectId(analysisId),
    inspectionId: inspection._id,
  });

  if (!analysis) throw new InspectionAiFlowError(404, "NOT_FOUND");
  if (analysis.status !== "READY") {
    throw new InspectionAiFlowError(400, "INVALID_STATE", { message: "Only completed analyses can be reviewed" });
  }

  // Validate decision keys format (img:n, disc:i, overall)
  const validKeyPattern = /^(img:[1-6]|disc:\d+|overall)$/;
  for (const [key, val] of Object.entries(input.decisions)) {
    if (!validKeyPattern.test(key)) {
      throw new InspectionAiFlowError(400, "INVALID_KEY", { message: `Invalid observation key: ${key}` });
    }
    if (!["CONFIRMED", "DISPUTED", "NOT_RELEVANT"].includes(val.decision)) {
      throw new InspectionAiFlowError(400, "INVALID_DECISION", { message: `Invalid decision value for key: ${key}` });
    }
  }

  analysis.set("inspectorReview", {
    status: "REVIEWED",
    decisions: input.decisions,
    reviewedBy: new mongoose.Types.ObjectId(actor.userId),
    reviewedAt: new Date(),
  });

  await analysis.save();

  await AuditLog.create({
    action: "ai.vision_analysis_reviewed",
    actorUserId: new mongoose.Types.ObjectId(actor.userId),
    resourceType: "Inspection",
    resourceId: inspection._id,
    agencyId: inspection.agencyId,
    afterSnapshot: { analysisNo: analysis.analysisNo, status: "REVIEWED", decisionCount: Object.keys(input.decisions).length },
    metadata: { requestId },
  }).catch(() => undefined);

  return { analysis };
}

export async function insertVisionObservations(
  actor: AuthenticatedActor,
  inspectionId: string,
  analysisId: string,
  input: { keys: string[] },
  permissions: readonly string[],
  requestId: string,
) {
  if (!mongoose.Types.ObjectId.isValid(inspectionId) || !mongoose.Types.ObjectId.isValid(analysisId)) {
    throw new InspectionAiFlowError(404, "NOT_FOUND");
  }

  const inspection = await Inspection.findById(inspectionId);
  if (!inspection) throw new InspectionAiFlowError(404, "NOT_FOUND");
  if (actor.roleKey !== "SUPER_ADMIN" && inspection.agencyId?.toString() !== actor.agencyId) {
    throw new InspectionAiFlowError(404, "NOT_FOUND");
  }

  const isAssigned = inspection.inspectorId?.toString() === actor.userId && permissions.includes("inspection.submit");
  if (!isAssigned) {
    throw new InspectionAiFlowError(403, "FORBIDDEN", {
      message: "Only the assigned inspector can insert observations into the inspection report",
    });
  }

  const analysis = await InspectionAiAnalysis.findOne({
    _id: new mongoose.Types.ObjectId(analysisId),
    inspectionId: inspection._id,
  });

  if (!analysis || analysis.status !== "READY" || !analysis.result) {
    throw new InspectionAiFlowError(404, "NOT_FOUND");
  }

  const reviewDecisions = analysis.inspectorReview?.decisions;
  const insertedObservations: Array<{ key: string; text: string }> = [];
  const assistRefsToAdd: any[] = [];

  for (const key of input.keys) {
    const dec = (reviewDecisions instanceof Map || (reviewDecisions && typeof (reviewDecisions as any).get === "function"))
      ? (reviewDecisions as any).get(key)
      : (reviewDecisions as any)?.[key];
    // HARD RULE: Only items the inspector explicitly CONFIRMED can be inserted
    if (!dec || dec.decision !== "CONFIRMED") {
      continue;
    }

    let text = "";
    if (key === "overall") {
      text = `AI Advisory Assessment (Confirmed): ${analysis.result.overall.rationale}`;
    } else if (key.startsWith("img:")) {
      const n = parseInt(key.split(":")[1]!, 10);
      const img = analysis.result.images.find((i) => i.n === n);
      if (img) {
        text = `Photo ${n} Observation (Confirmed): ${img.activityDescription}`;
      }
    } else if (key.startsWith("disc:")) {
      const idx = parseInt(key.split(":")[1]!, 10);
      const disc = analysis.result.potentialDiscrepancies[idx];
      if (disc) {
        text = `Site Verification Note: ${disc.statement}`;
      }
    }

    if (text) {
      insertedObservations.push({ key, text });
      assistRefsToAdd.push({
        analysisId: analysis._id,
        observationKey: key,
        insertedBy: new mongoose.Types.ObjectId(actor.userId),
        insertedAt: new Date(),
      });
    }
  }

  // Add aiAssistRefs transparency markers to Inspection (max 20)
  if (assistRefsToAdd.length > 0) {
    const currentRefs = inspection.aiAssistRefs ?? [];
    const combined = [...currentRefs, ...assistRefsToAdd].slice(-20);
    inspection.aiAssistRefs = combined as any;
    await inspection.save();
  }

  await AuditLog.create({
    action: "ai.vision_observations_inserted",
    actorUserId: new mongoose.Types.ObjectId(actor.userId),
    resourceType: "Inspection",
    resourceId: inspection._id,
    agencyId: inspection.agencyId,
    afterSnapshot: { analysisNo: analysis.analysisNo, insertedCount: insertedObservations.length },
    metadata: { requestId },
  }).catch(() => undefined);

  return {
    insertedObservations,
  };
}

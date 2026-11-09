import mongoose, { type ClientSession } from "mongoose";
import type {
  RiskAssessmentDto,
  RiskAssessmentSummaryDto,
  RiskComparisonDto,
  RiskResolutionDto,
  RiskTriggerType,
} from "@infraos/shared-types";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import {
  projectReadFilter,
  resolveResourceScope,
} from "../identity/authorization/resource-scope.js";
import { Project } from "../projects/models/project.model.js";
import {
  computeEffectiveResolutionStatus,
  evaluateRisk,
} from "./engine/index.js";
import {
  nextAssessmentNo,
  RiskAssessment,
} from "./models/risk-assessment.model.js";
import { RiskResolution } from "./models/risk-resolution.model.js";
import { assembleRiskInputs, RiskAccessError } from "./risk-inputs.service.js";
import { writeRiskAudit } from "./risk.audit.js";
import { tierAssessmentEvidence, type ViewerPermissions } from "./risk-tiering.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function assessProject(
  actor: AuthenticatedActor,
  projectId: string,
  trigger: RiskTriggerType,
  now: Date = new Date(),
  options?: { force?: boolean; session?: ClientSession },
): Promise<{ assessment: RiskAssessmentDto; unchanged: boolean }> {
  // 1. Assemble inputs with scope checking
  const inputs = await assembleRiskInputs(actor, projectId, now, options?.session);
  const projectData = inputs.project.data!;
  const projectObjId = new mongoose.Types.ObjectId(projectId);

  // 2. Fetch latest previous assessment
  const latestDoc = await RiskAssessment.findOne({ projectId: projectObjId })
    .sort({ createdAt: -1 })
    .session(options?.session ?? null)
    .lean();

  // 3. Unchanged idempotency check (§4.7)
  const isUnchanged =
    latestDoc &&
    latestDoc.inputsHash &&
    !options?.force &&
    now.getTime() - new Date(latestDoc.createdAt).getTime() < DAY_MS;

  // Run pure engine
  const result = evaluateRisk(inputs, now, latestDoc as any);

  if (isUnchanged && latestDoc.inputsHash === result.inputsHash) {
    return {
      assessment: latestDoc as unknown as RiskAssessmentDto,
      unchanged: true,
    };
  }

  // 4. Atomic assessment sequence number
  const assessmentNo = await nextAssessmentNo(now);

  const performPersist = async (session: ClientSession) => {
    // Audit requested
    await writeRiskAudit(session, {
      action: "risk.assessment_requested",
      resourceId: projectObjId,
      actorUserId: actor.userId,
      agencyId: projectData.agencyId,
      status: projectData.status,
    });

    const [created] = await RiskAssessment.create(
      [
        {
          assessmentNo,
          projectId: projectObjId,
          agencyId: new mongoose.Types.ObjectId(projectData.agencyId),
          projectStatus: projectData.status,
          trigger,
          engineVersion: result.engineVersion,
          inputsHash: result.inputsHash,
          applicable: result.applicable,
          overallLevel: result.overallLevel,
          overallIndex: result.overallIndex,
          overallRisk: result.overallIndex, // backward compat index
          categories: result.categories,
          indicators: result.indicators,
          sourceFreshness: result.sourceFreshness,
          missingData: result.missingData,
          recommendations: result.recommendations,
          changes: result.changes,
          levelChange: result.levelChange,
          previousAssessmentId: latestDoc?._id,
          requestedBy: new mongoose.Types.ObjectId(actor.userId),
        },
      ],
      { session },
    );

    // Update Project cache in same transaction
    await Project.updateOne(
      { _id: projectObjId },
      {
        $set: {
          riskLevel: result.applicable ? result.overallLevel : null,
          riskAssessedAt: now,
          latestRiskAssessmentId: created!._id,
          riskScore:
            result.applicable && result.overallIndex !== undefined
              ? result.overallIndex
              : null,
        },
      },
      { session },
    );

    // Audit completed
    await writeRiskAudit(session, {
      action: "risk.assessment_completed",
      resourceId: projectObjId,
      actorUserId: actor.userId,
      agencyId: projectData.agencyId,
      status: result.overallLevel,
    });

    return created!;
  };

  let savedDoc: any;
  if (options?.session) {
    savedDoc = await performPersist(options.session);
  } else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        savedDoc = await performPersist(session);
      });
    } finally {
      await session.endSession();
    }
  }

  return {
    assessment: savedDoc.toObject() as unknown as RiskAssessmentDto,
    unchanged: false,
  };
}

export async function getProjectLatestAssessment(
  actor: AuthenticatedActor,
  projectId: string,
  viewerPermissions: ViewerPermissions,
): Promise<{
  assessment: RiskAssessmentDto | null;
  resolutions: RiskResolutionDto[];
  canAssess: boolean;
  canResolve: boolean;
}> {
  const scope = await resolveResourceScope(actor);
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new RiskAccessError(404, "NOT_FOUND", "Project not found");
  }

  const projectObjId = new mongoose.Types.ObjectId(projectId);
  const project = await Project.findOne({
    $and: [projectReadFilter(scope), { _id: projectObjId }],
  })
    .select("status agencyId")
    .lean();

  if (!project) {
    throw new RiskAccessError(404, "NOT_FOUND", "Project not found");
  }

  const latestDoc = await RiskAssessment.findOne({ projectId: projectObjId })
    .sort({ createdAt: -1 })
    .lean();

  const resolutions = await RiskResolution.find({ projectId: projectObjId })
    .sort({ decidedAt: -1 })
    .lean();

  let tieredAssessment: RiskAssessmentDto | null = null;
  if (latestDoc) {
    const resMap = new Map(resolutions.map((r) => [r.fingerprint, r]));
    const now = new Date();

    const withDisplayResolutions: RiskAssessmentDto = {
      ...(latestDoc as any),
      indicators: (latestDoc.indicators ?? []).map((ind: any) => {
        const res = resMap.get(ind.fingerprint);
        return {
          ...ind,
          displayResolutionStatus: computeEffectiveResolutionStatus(
            res as any,
            ind.severity,
            now,
          ),
        };
      }),
    };

    tieredAssessment = tierAssessmentEvidence(
      withDisplayResolutions,
      viewerPermissions,
    );
  }

  const canAssess = ["ACTIVE", "DELAYED", "ON_HOLD", "APPROVED"].includes(
    project.status,
  );
  const canResolve =
    scope.kind === "platform" ||
    (scope.kind === "agencies" &&
      scope.agencyIds.some((a) => a.toString() === project.agencyId.toString()));

  return {
    assessment: tieredAssessment,
    resolutions: resolutions as unknown as RiskResolutionDto[],
    canAssess,
    canResolve,
  };
}

export async function getProjectAssessmentById(
  actor: AuthenticatedActor,
  projectId: string,
  assessmentId: string,
  viewerPermissions: ViewerPermissions,
): Promise<RiskAssessmentDto> {
  const scope = await resolveResourceScope(actor);
  if (
    !mongoose.Types.ObjectId.isValid(projectId) ||
    !mongoose.Types.ObjectId.isValid(assessmentId)
  ) {
    throw new RiskAccessError(404, "NOT_FOUND", "Assessment not found");
  }

  const project = await Project.findOne({
    $and: [
      projectReadFilter(scope),
      { _id: new mongoose.Types.ObjectId(projectId) },
    ],
  }).lean();

  if (!project) {
    throw new RiskAccessError(404, "NOT_FOUND", "Project not found");
  }

  const doc = await RiskAssessment.findOne({
    _id: new mongoose.Types.ObjectId(assessmentId),
    projectId: new mongoose.Types.ObjectId(projectId),
  }).lean();

  if (!doc) {
    throw new RiskAccessError(404, "NOT_FOUND", "Assessment not found");
  }

  return tierAssessmentEvidence(doc as any, viewerPermissions);
}

export async function getProjectRiskHistory(
  actor: AuthenticatedActor,
  projectId: string,
  query: { limit?: number; cursor?: string },
): Promise<{ items: RiskAssessmentSummaryDto[]; nextCursor: string | null }> {
  const scope = await resolveResourceScope(actor);
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new RiskAccessError(404, "NOT_FOUND", "Project not found");
  }

  const project = await Project.findOne({
    $and: [
      projectReadFilter(scope),
      { _id: new mongoose.Types.ObjectId(projectId) },
    ],
  }).lean();

  if (!project) {
    throw new RiskAccessError(404, "NOT_FOUND", "Project not found");
  }

  const limit = Math.min(query.limit ?? 20, 50);
  const filter: Record<string, unknown> = {
    projectId: new mongoose.Types.ObjectId(projectId),
  };

  if (query.cursor) {
    const cursorDate = new Date(query.cursor);
    if (!isNaN(cursorDate.getTime())) {
      filter.createdAt = { $lt: cursorDate };
    }
  }

  const rows = await RiskAssessment.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .select(
      "assessmentNo overallLevel overallIndex trigger createdAt changes levelChange",
    )
    .lean();

  const hasNext = rows.length > limit;
  const pageRows = hasNext ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasNext && pageRows[pageRows.length - 1]?.createdAt
      ? pageRows[pageRows.length - 1]!.createdAt.toISOString()
      : null;

  const items: RiskAssessmentSummaryDto[] = pageRows.map((r: any) => ({
    id: r._id.toString(),
    assessmentNo: r.assessmentNo ?? "RSK-LEGACY",
    overallLevel: r.overallLevel,
    overallIndex: r.overallIndex,
    trigger: r.trigger,
    createdAt: r.createdAt.toISOString(),
    changesCount: r.changes?.length ?? 0,
    levelChange: r.levelChange ?? null,
  }));

  return { items, nextCursor };
}

export async function compareProjectAssessments(
  actor: AuthenticatedActor,
  projectId: string,
  fromId: string,
  toId: string,
  viewerPermissions: ViewerPermissions,
): Promise<RiskComparisonDto> {
  const [fromRaw, toRaw] = await Promise.all([
    getProjectAssessmentById(actor, projectId, fromId, viewerPermissions),
    getProjectAssessmentById(actor, projectId, toId, viewerPermissions),
  ]);

  const fromMap = new Map((fromRaw.indicators ?? []).map((i) => [i.fingerprint, i]));
  const toMap = new Map((toRaw.indicators ?? []).map((i) => [i.fingerprint, i]));

  const added: RiskAssessmentDto["indicators"] = [];
  const removed: RiskAssessmentDto["indicators"] = [];
  const escalated: RiskAssessmentDto["indicators"] = [];
  const deescalated: RiskAssessmentDto["indicators"] = [];

  for (const [fp, toInd] of toMap) {
    const fromInd = fromMap.get(fp);
    if (!fromInd) {
      added.push(toInd);
    } else if (toInd.points > fromInd.points) {
      escalated.push(toInd);
    } else if (toInd.points < fromInd.points) {
      deescalated.push(toInd);
    }
  }

  for (const [fp, fromInd] of fromMap) {
    if (!toMap.has(fp)) {
      removed.push(fromInd);
    }
  }

  const categoryDeltas = (toRaw.categories ?? []).map((toCat) => {
    const fromCat = (fromRaw.categories ?? []).find((c) => c.category === toCat.category);
    return {
      category: toCat.category,
      fromLevel: fromCat?.level ?? "NOT_ASSESSABLE",
      toLevel: toCat.level,
      deltaPoints: (toCat.index ?? 0) - (fromCat?.index ?? 0),
    };
  });

  return {
    fromAssessment: fromRaw,
    toAssessment: toRaw,
    levelChange: {
      from: fromRaw.overallLevel,
      to: toRaw.overallLevel,
    },
    indexDelta: (toRaw.overallIndex ?? 0) - (fromRaw.overallIndex ?? 0),
    addedIndicators: added,
    removedIndicators: removed,
    escalatedIndicators: escalated,
    deescalatedIndicators: deescalated,
    categoryDeltas,
  };
}


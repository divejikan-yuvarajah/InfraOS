import mongoose from "mongoose";
import type {
  RiskResolutionDto,
  RiskResolutionStatus,
} from "@infraos/shared-types";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import {
  projectWriteFilter,
  resolveResourceScope,
} from "../identity/authorization/resource-scope.js";
import { Project } from "../projects/models/project.model.js";
import { RiskAssessment } from "./models/risk-assessment.model.js";
import { RiskResolution } from "./models/risk-resolution.model.js";
import { RiskAccessError } from "./risk-inputs.service.js";
import { writeRiskAudit } from "./risk.audit.js";

export interface UpdateResolutionInput {
  status: RiskResolutionStatus;
  note?: string;
  reviewAt?: Date | string | null;
  assignedTo?: string | null;
  version: number;
}

export async function listProjectResolutions(
  actor: AuthenticatedActor,
  projectId: string,
): Promise<RiskResolutionDto[]> {
  const scope = await resolveResourceScope(actor);
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new RiskAccessError(404, "NOT_FOUND", "Project not found");
  }

  const projectObjId = new mongoose.Types.ObjectId(projectId);
  const project = await Project.findOne({
    _id: projectObjId,
  }).lean();

  if (!project) {
    throw new RiskAccessError(404, "NOT_FOUND", "Project not found");
  }

  const rows = await RiskResolution.find({ projectId: projectObjId })
    .sort({ decidedAt: -1 })
    .lean();

  return rows as unknown as RiskResolutionDto[];
}

export async function updateResolution(
  actor: AuthenticatedActor,
  projectId: string,
  fingerprint: string,
  input: UpdateResolutionInput,
): Promise<RiskResolutionDto> {
  const scope = await resolveResourceScope(actor);
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new RiskAccessError(404, "NOT_FOUND", "Project not found");
  }

  const projectObjId = new mongoose.Types.ObjectId(projectId);

  // Check write scope for project
  const project = await Project.findOne({
    $and: [projectWriteFilter(actor, scope), { _id: projectObjId }],
  }).lean();

  if (!project) {
    throw new RiskAccessError(
      404,
      "NOT_FOUND",
      "Project not found or outside authorized write scope",
    );
  }

  // Validation rules (§4.2): note is required >= 12 chars for DISMISSED and RESOLVED
  const note = (input.note ?? "").trim();
  if (
    (input.status === "DISMISSED" || input.status === "RESOLVED") &&
    note.length < 12
  ) {
    throw new RiskAccessError(
      400,
      "VALIDATION_ERROR",
      `A justification note of at least 12 characters is required to ${input.status.toLowerCase()} this risk indicator.`,
    );
  }

  // Get indicator severity from latest assessment
  const latestAssessment = await RiskAssessment.findOne({ projectId: projectObjId })
    .sort({ createdAt: -1 })
    .lean();

  const ind = latestAssessment?.indicators?.find((i) => i.fingerprint === fingerprint);
  const severityAtDecision = ind?.severity ?? "MODERATE";
  const indicatorCode = ind?.code ?? fingerprint.split(":")[0] ?? "UNKNOWN";

  const now = new Date();
  const reviewAtDate = input.reviewAt ? new Date(input.reviewAt) : null;
  const assignedToId =
    input.assignedTo && mongoose.Types.ObjectId.isValid(input.assignedTo)
      ? new mongoose.Types.ObjectId(input.assignedTo)
      : null;

  // Optimistic concurrency check
  let existing = await RiskResolution.findOne({
    projectId: projectObjId,
    fingerprint,
  });

  if (!existing) {
    // If client supplied version > 0 when record doesn't exist, OCC conflict
    if (input.version > 0) {
      throw new RiskAccessError(
        409,
        "VERSION_CONFLICT",
        "Resolution record was updated concurrently or does not exist",
      );
    }

    const created = await RiskResolution.create({
      projectId: projectObjId,
      agencyId: project.agencyId,
      fingerprint,
      indicatorCode,
      status: input.status,
      note,
      severityAtDecision,
      assessmentId: latestAssessment?._id,
      assignedTo: assignedToId,
      reviewAt: reviewAtDate,
      decidedBy: new mongoose.Types.ObjectId(actor.userId),
      decidedAt: now,
      version: 1,
      events: [
        {
          status: input.status,
          note,
          by: new mongoose.Types.ObjectId(actor.userId),
          at: now,
          assessmentId: latestAssessment?._id,
        },
      ],
    });

    await writeRiskAudit(undefined, {
      action: "risk.resolution_updated",
      resourceId: projectObjId,
      actorUserId: actor.userId,
      agencyId: project.agencyId,
      status: input.status,
      reason: `fingerprint:${fingerprint}`,
    });

    return created.toObject() as unknown as RiskResolutionDto;
  }

  // OCC check
  if (existing.version !== input.version) {
    throw new RiskAccessError(
      409,
      "VERSION_CONFLICT",
      `Resolution version conflict: current version is ${existing.version}, supplied was ${input.version}`,
    );
  }

  existing.status = input.status;
  existing.note = note;
  existing.severityAtDecision = severityAtDecision;
  existing.assessmentId = latestAssessment?._id ?? null;
  existing.assignedTo = assignedToId ?? null;
  existing.reviewAt = reviewAtDate ?? null;
  existing.decidedBy = new mongoose.Types.ObjectId(actor.userId);
  existing.decidedAt = now;
  existing.version = existing.version + 1;
  existing.events.push({
    status: input.status,
    note,
    by: new mongoose.Types.ObjectId(actor.userId),
    at: now,
    assessmentId: latestAssessment?._id,
  });

  await existing.save();

  await writeRiskAudit(undefined, {
    action: "risk.resolution_updated",
    resourceId: projectObjId,
    actorUserId: actor.userId,
    agencyId: project.agencyId,
    status: input.status,
    reason: `fingerprint:${fingerprint}`,
  });

  return existing.toObject() as unknown as RiskResolutionDto;
}


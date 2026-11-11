import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type {
  InsertedObservationDto,
  InspectionAiAnalysisView,
  QualityChecksOutputDto,
  ReviewDecisionsPayload,
  VisionEligibilityDto,
} from "./types";

function guard() {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}

function moved(atEpoch: number, tokenAtStart: string) {
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }
}

async function call<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ data: T }>(`/api/v1${path}`, {
    method,
    authenticated: true,
    ...(body !== undefined ? { body } : {}),
    ...(signal ? { signal } : {}),
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

type RawAnalysisRecord = Record<string, unknown>;

function normalizeQualityChecks(raw: unknown): QualityChecksOutputDto {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Partial<QualityChecksOutputDto>;
    return {
      checks: Array.isArray(obj.checks) ? obj.checks : [],
      coverage: {
        totalPhotos: obj.coverage?.totalPhotos ?? 0,
        milestonesWithEvidence: obj.coverage?.milestonesWithEvidence ?? 0,
        totalMilestones: obj.coverage?.totalMilestones ?? 0,
        uncoveredMilestones: Array.isArray(obj.coverage?.uncoveredMilestones)
          ? obj.coverage.uncoveredMilestones
          : [],
      },
      metadataNote:
        typeof obj.metadataNote === "string"
          ? obj.metadataNote
          : "Metadata can be inaccurate: device clocks and GPS readings are unverified.",
    };
  }
  return {
    checks: [],
    coverage: {
      totalPhotos: 0,
      milestonesWithEvidence: 0,
      totalMilestones: 0,
      uncoveredMilestones: [],
    },
    metadataNote: "Metadata can be inaccurate: device clocks and GPS readings are unverified.",
  };
}

/** Normalizes Mongo `_id` -> `id` and nested structures across single and list responses. */
export function normalizeAnalysis(raw: RawAnalysisRecord): InspectionAiAnalysisView {
  const rawId = typeof raw.id === "string" ? raw.id : raw._id ? String(raw._id) : "";
  const rev = (raw.inspectorReview && typeof raw.inspectorReview === "object"
    ? raw.inspectorReview
    : {}) as Record<string, unknown>;

  return {
    id: rawId,
    analysisNo: String(raw.analysisNo ?? ""),
    inspectionId: String(raw.inspectionId ?? ""),
    projectId: String(raw.projectId ?? ""),
    agencyId: String(raw.agencyId ?? ""),
    requestedBy: String(raw.requestedBy ?? ""),
    requestedByRole: raw.requestedByRole === "REVIEWER" ? "REVIEWER" : "INSPECTOR",
    evidence: Array.isArray(raw.evidence) ? (raw.evidence as InspectionAiAnalysisView["evidence"]) : [],
    contextHash: String(raw.contextHash ?? ""),
    status: (raw.status as InspectionAiAnalysisView["status"]) ?? "QUEUED",
    ...(typeof raw.errorCode === "string" ? { errorCode: raw.errorCode } : {}),
    ...(raw.result && typeof raw.result === "object"
      ? { result: raw.result as InspectionAiAnalysisView["result"] }
      : {}),
    qualityChecks: normalizeQualityChecks(raw.qualityChecks),
    ...(typeof raw.model === "string" ? { model: raw.model } : {}),
    ...(raw.usage && typeof raw.usage === "object"
      ? { usage: raw.usage as InspectionAiAnalysisView["usage"] }
      : {}),
    inspectorReview: {
      status: rev.status === "REVIEWED" ? "REVIEWED" : "PENDING",
      decisions:
        rev.decisions && typeof rev.decisions === "object" && !Array.isArray(rev.decisions)
          ? (rev.decisions as InspectionAiAnalysisView["inspectorReview"]["decisions"])
          : {},
      ...(rev.reviewedBy ? { reviewedBy: String(rev.reviewedBy) } : {}),
      ...(rev.reviewedAt ? { reviewedAt: String(rev.reviewedAt) } : {}),
    },
    ...(raw.supersededBy ? { supersededBy: String(raw.supersededBy) } : {}),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
  };
}

export const fetchVisionEligibility = (inspectionId: string, signal?: AbortSignal) =>
  call<VisionEligibilityDto>("GET", `/inspections/${inspectionId}/ai/eligibility`, undefined, signal);

export const requestVisionAnalysis = async (
  inspectionId: string,
  payload: { evidenceIds: string[]; acknowledgedProvider: boolean },
): Promise<InspectionAiAnalysisView> => {
  const raw = await call<RawAnalysisRecord>(
    "POST",
    `/inspections/${inspectionId}/ai/analyses`,
    payload,
  );
  return normalizeAnalysis(raw);
};

export const fetchVisionAnalyses = async (
  inspectionId: string,
  signal?: AbortSignal,
): Promise<InspectionAiAnalysisView[]> => {
  const data = await call<{ analyses: RawAnalysisRecord[] }>(
    "GET",
    `/inspections/${inspectionId}/ai/analyses`,
    undefined,
    signal,
  );
  return (data.analyses ?? []).map(normalizeAnalysis);
};

export const fetchVisionAnalysis = async (
  inspectionId: string,
  analysisId: string,
  signal?: AbortSignal,
): Promise<InspectionAiAnalysisView> => {
  const raw = await call<RawAnalysisRecord>(
    "GET",
    `/inspections/${inspectionId}/ai/analyses/${analysisId}`,
    undefined,
    signal,
  );
  return normalizeAnalysis(raw);
};

export const submitVisionReview = async (
  inspectionId: string,
  analysisId: string,
  payload: ReviewDecisionsPayload,
): Promise<InspectionAiAnalysisView> => {
  const raw = await call<RawAnalysisRecord>(
    "PUT",
    `/inspections/${inspectionId}/ai/analyses/${analysisId}/review`,
    payload,
  );
  return normalizeAnalysis(raw);
};

export const insertConfirmedVisionObservations = (
  inspectionId: string,
  analysisId: string,
  keys: string[],
) =>
  call<{ insertedObservations: InsertedObservationDto[] }>(
    "POST",
    `/inspections/${inspectionId}/ai/analyses/${analysisId}/insert`,
    { keys },
  );


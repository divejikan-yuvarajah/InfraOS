import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";
import type {
  ProjectLatestRiskResponse,
  RiskAssessmentDto,
  RiskComparisonDto,
  RiskHistoryItemDto,
  RiskMethodologyDto,
  RiskOverviewDto,
  RiskProjectsListDto,
  RiskResolutionDto,
  RiskRunDto,
  RiskScatterItemDto,
} from "./types";

export type Envelope<T> = { success: true; data: T };

export function guard() {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}

/** A response that arrives after sign-out or a user switch is discarded, never rendered. */
export function moved(atEpoch: number, tokenAtStart: string) {
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }
}

export async function fetchRiskOverview(): Promise<RiskOverviewDto> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<RiskOverviewDto>>("/api/v1/risk/overview", {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function fetchRiskProjects(query = ""): Promise<RiskProjectsListDto> {
  const { atEpoch, tokenAtStart } = guard();
  const path = query ? `/api/v1/risk/projects?${query}` : "/api/v1/risk/projects";
  const payload = await apiClient<Envelope<RiskProjectsListDto>>(path, {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function fetchRiskScatter(): Promise<{ points: RiskScatterItemDto[] }> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<{ points: RiskScatterItemDto[] }>>("/api/v1/risk/scatter", {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function fetchRiskPortfolioTrend(range?: string): Promise<{
  rangeWeeks: number;
  insufficientHistory: boolean;
  points: Array<{ weekStart: string; counts: Record<string, number> }>;
}> {
  const { atEpoch, tokenAtStart } = guard();
  const path = range ? `/api/v1/risk/portfolio-trend?range=${encodeURIComponent(range)}` : "/api/v1/risk/portfolio-trend";
  const payload = await apiClient<
    Envelope<{
      rangeWeeks: number;
      insufficientHistory: boolean;
      points: Array<{ weekStart: string; counts: Record<string, number> }>;
    }>
  >(path, {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function fetchRiskMethodology(): Promise<RiskMethodologyDto> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<RiskMethodologyDto>>("/api/v1/risk/methodology", {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function fetchProjectRisk(projectId: string): Promise<ProjectLatestRiskResponse> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<ProjectLatestRiskResponse>>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/risk`,
    {
      method: "GET",
      authenticated: true,
    },
  );
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function assessProjectOnDemand(
  projectId: string,
  force = false,
): Promise<{
  assessment: RiskAssessmentDto;
  unchanged?: boolean;
}> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<
    Envelope<{
      assessment: RiskAssessmentDto;
      unchanged?: boolean;
    }>
  >(`/api/v1/projects/${encodeURIComponent(projectId)}/risk/assess`, {
    method: "POST",
    authenticated: true,
    body: { force },
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function fetchProjectRiskHistory(
  projectId: string,
  cursor?: string,
): Promise<{
  items: RiskHistoryItemDto[];
  nextCursor: string | null;
}> {
  const { atEpoch, tokenAtStart } = guard();
  const path = cursor
    ? `/api/v1/projects/${encodeURIComponent(projectId)}/risk/history?cursor=${encodeURIComponent(cursor)}`
    : `/api/v1/projects/${encodeURIComponent(projectId)}/risk/history`;
  const payload = await apiClient<Envelope<{ items: RiskHistoryItemDto[]; nextCursor: string | null }>>(path, {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function fetchRiskAssessment(
  projectId: string,
  assessmentId: string,
): Promise<{ assessment: RiskAssessmentDto }> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<{ assessment: RiskAssessmentDto }>>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/risk/assessments/${encodeURIComponent(assessmentId)}`,
    {
      method: "GET",
      authenticated: true,
    },
  );
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function compareRiskAssessments(
  projectId: string,
  fromId: string,
  toId: string,
): Promise<RiskComparisonDto> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<RiskComparisonDto>>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/risk/compare?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}`,
    {
      method: "GET",
      authenticated: true,
    },
  );
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function fetchProjectResolutions(
  projectId: string,
): Promise<{ items: RiskResolutionDto[] }> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<{ items: RiskResolutionDto[] }>>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/risk/resolutions`,
    {
      method: "GET",
      authenticated: true,
    },
  );
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function updateProjectResolution(
  projectId: string,
  fingerprint: string,
  body: {
    status: string;
    note: string;
    version: number;
    assessmentId?: string;
    assignedTo?: string;
    reviewAt?: string;
  },
): Promise<{ resolution: RiskResolutionDto }> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<{ resolution: RiskResolutionDto }>>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/risk/resolutions/${encodeURIComponent(fingerprint)}`,
    {
      method: "PUT",
      authenticated: true,
      body,
    },
  );
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function explainAssessmentNarrative(
  projectId: string,
  assessmentId: string,
  body: {
    language?: "en" | "si" | "ta";
    regenerate?: boolean;
  } = {},
): Promise<{ narrative: NonNullable<RiskAssessmentDto["narrative"]> }> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<{ narrative: NonNullable<RiskAssessmentDto["narrative"]> }>>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/risk/assessments/${encodeURIComponent(assessmentId)}/explain`,
    {
      method: "POST",
      authenticated: true,
      body,
    },
  );
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function assessAllProjects(scope?: string): Promise<{ runId: string; status: string }> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<{ runId: string; status: string }>>("/api/v1/risk/assess-all", {
    method: "POST",
    authenticated: true,
    body: { scope },
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function fetchRiskRuns(): Promise<{ items: RiskRunDto[] }> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<{ items: RiskRunDto[] }>>("/api/v1/risk/runs", {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function fetchRiskRun(runId: string): Promise<{ run: RiskRunDto }> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<{ run: RiskRunDto }>>(`/api/v1/risk/runs/${encodeURIComponent(runId)}`, {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export function getRiskExportCsvUrl(): string {
  return "/api/v1/risk/export.csv";
}

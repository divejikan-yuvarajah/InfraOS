import { apiClient } from "@/lib/api/client";
import { getMemoryAccessToken } from "@/lib/auth/state";
import { getPublicApiBaseUrl } from "@/lib/env/public";

export type ReportFilterParams = {
  from?: string;
  to?: string;
  status?: string;
};

export type ReportsOverviewData = {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  delayedProjects: number;
  criticalRiskProjects: number;
  avgPhysicalProgress: number;
  totalBudgetMinor: number;
  totalPaidMinor: number;
  openIssues: number;
  openConflicts: number;
  byStatus: Array<{ status: string; count: number }>;
};

export type ProjectsReportData = {
  items: Array<{
    id: string;
    projectCode: string;
    title: string;
    projectType: string;
    status: string;
    agencyCode: string | null;
    agencyName: string | null;
    district: string;
    budgetMinor: number;
    physicalProgress: number;
    financialProgress: number;
    riskLevel: string | null;
    plannedEndDate: string | null;
  }>;
  byDistrict: Array<{ district: string; count: number }>;
};

export type AgenciesReportData = {
  items: Array<{
    agencyId: string;
    code: string;
    name: string;
    projectCount: number;
    activeCount: number;
    budgetMinor: number;
    paidMinor: number;
    avgPhysicalProgress: number;
  }>;
};

export type BudgetsReportData = {
  items: Array<{
    projectId: string;
    projectCode: string;
    title: string;
    budgetMinor: number;
    paidMinor: number;
    pendingMinor: number;
    utilizationPercent: number;
  }>;
};

export type ContractorsReportData = {
  items: Array<{
    contractorId: string;
    registrationNumber: string | null;
    name: string;
    category: string | null;
    status: string | null;
    assignmentCount: number;
    paidMinor: number;
  }>;
};

function toQueryString(params: ReportFilterParams): string {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.status) qs.set("status", params.status);
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export async function fetchReportsOverview(params: ReportFilterParams): Promise<ReportsOverviewData> {
  const res = await apiClient<{ success: true; data: ReportsOverviewData }>(
    `/api/v1/reports/overview${toQueryString(params)}`,
    { method: "GET", authenticated: true },
  );
  return res.data;
}

export async function fetchProjectsReport(params: ReportFilterParams): Promise<ProjectsReportData> {
  const res = await apiClient<{ success: true; data: ProjectsReportData }>(
    `/api/v1/reports/projects${toQueryString(params)}`,
    { method: "GET", authenticated: true },
  );
  return res.data;
}

export async function fetchAgenciesReport(params: ReportFilterParams): Promise<AgenciesReportData> {
  const res = await apiClient<{ success: true; data: AgenciesReportData }>(
    `/api/v1/reports/agencies${toQueryString(params)}`,
    { method: "GET", authenticated: true },
  );
  return res.data;
}

export async function fetchBudgetsReport(params: ReportFilterParams): Promise<BudgetsReportData> {
  const res = await apiClient<{ success: true; data: BudgetsReportData }>(
    `/api/v1/reports/budgets${toQueryString(params)}`,
    { method: "GET", authenticated: true },
  );
  return res.data;
}

export async function fetchContractorsReport(params: ReportFilterParams): Promise<ContractorsReportData> {
  const res = await apiClient<{ success: true; data: ContractorsReportData }>(
    `/api/v1/reports/contractors${toQueryString(params)}`,
    { method: "GET", authenticated: true },
  );
  return res.data;
}

export async function downloadReportCsv(
  kind: "projects" | "agencies" | "budgets" | "contractors",
  params: ReportFilterParams,
): Promise<void> {
  const token = getMemoryAccessToken();
  const baseUrl = getPublicApiBaseUrl();
  if (!token || !baseUrl) throw new Error("Authentication or API base URL missing");

  const qs = new URLSearchParams({ kind });
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.status) qs.set("status", params.status);

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/reports/export.csv?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `infraos-${kind}-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import {
  ChainageBar,
  ChartFrame,
  CommandHeader,
  MetricCard,
} from "@/components/common/civic-atlas-primitives";
import { FilterBar } from "@/components/common/filter-bar";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import {
  downloadReportCsv,
  fetchAgenciesReport,
  fetchBudgetsReport,
  fetchContractorsReport,
  fetchProjectsReport,
  fetchReportsOverview,
} from "@/lib/reports/api";

type ReportTab = "overview" | "projects" | "agencies" | "budgets" | "contractors";

const COPY = {
  en: {
    title: "Reports & Executive KPIs",
    subtitle: "Agency-scoped project delivery, budget utilization, contractor performance, and auditable exports.",
    exportCsv: "Export CSV",
    printPdf: "Print / Save PDF",
  },
  // unverified-draft
  si: {
    title: "වාර්තා සහ ප්‍රධාන දර්ශක",
    subtitle: "ආයතන මට්ටමේ ව්‍යාපෘති ප්‍රගතිය, අයවැය භාවිතය සහ විගණනය කළ හැකි CSV/PDF අපනයන.",
    exportCsv: "CSV බාගන්න",
    printPdf: "මුද්‍රණය / PDF",
  },
  // unverified-draft
  ta: {
    title: "அறிக்கைகள் மற்றும் முக்கிய குறிகாட்டிகள்",
    subtitle: "திட்ட முன்னேற்றம், நிதி பயன்பாடு மற்றும் தணிக்கை செய்யக்கூடிய CSV/PDF ஏற்றுமதிகள்.",
    exportCsv: "CSV ஏற்றுமதி",
    printPdf: "அச்சிடு / PDF",
  },
} as const;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "APPROVED", label: "Approved" },
  { value: "DELAYED", label: "Delayed" },
  { value: "COMPLETED", label: "Completed" },
];

function formatLkr(minor: number): string {
  const major = Math.round(minor / 100);
  return `LKR ${major.toLocaleString("en-LK")}`;
}

function StatusBarChart({ data }: { data: Array<{ status: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const barHeight = 22;
  const gap = 8;
  const height = Math.max(60, data.length * (barHeight + gap) + 12);

  return (
    <svg viewBox={`0 0 420 ${height}`} className="w-full" role="img" aria-label="Projects by status chart">
      {data.map((d, i) => {
        const y = i * (barHeight + gap) + 6;
        const w = Math.round((d.count / max) * 230);
        return (
          <g key={d.status}>
            <text x={0} y={y + 15} className="fill-slate-700 text-[11px] font-medium">
              {d.status}
            </text>
            <rect x={125} y={y + 2} width={Math.max(4, w)} height={16} rx={3} className="fill-[#c43d00]" />
            <text x={125 + Math.max(4, w) + 8} y={y + 15} className="fill-slate-800 text-[11px] font-mono font-semibold">
              {d.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ReportsClient() {
  const [locale] = useWorkspaceLocale();
  const copy = COPY[locale] ?? COPY.en;
  const [tab, setTab] = useState<ReportTab>("overview");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const filters = {
    status: status || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const overviewQ = useQuery({
    queryKey: ["reports", "overview", filters],
    queryFn: () => fetchReportsOverview(filters),
  });
  const projectsQ = useQuery({
    queryKey: ["reports", "projects", filters],
    queryFn: () => fetchProjectsReport(filters),
    enabled: tab === "projects" || tab === "overview",
  });
  const agenciesQ = useQuery({
    queryKey: ["reports", "agencies", filters],
    queryFn: () => fetchAgenciesReport(filters),
    enabled: tab === "agencies",
  });
  const budgetsQ = useQuery({
    queryKey: ["reports", "budgets", filters],
    queryFn: () => fetchBudgetsReport(filters),
    enabled: tab === "budgets",
  });
  const contractorsQ = useQuery({
    queryKey: ["reports", "contractors", filters],
    queryFn: () => fetchContractorsReport(filters),
    enabled: tab === "contractors",
  });

  const ov = overviewQ.data;
  const exportKind = tab === "overview" ? "projects" : tab;

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await downloadReportCsv(exportKind, filters);
    } finally {
      setExporting(false);
    }
  };

  return (
    <StaffWorkspaceShell title={copy.title} hidePageHeader>
      <div className="space-y-6 p-4 sm:p-6 max-w-[1600px] mx-auto">
        <CommandHeader
          variant="navy"
          eyebrow="EXECUTIVE REPORTS & KPIs"
          title={copy.title}
          subtitle={copy.subtitle}
          sourceKind="live"
          primaryAction={
            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExportCsv()}
              className="rounded-lg bg-[#c43d00] px-4 py-2 text-xs font-semibold text-white hover:bg-[#802a00] disabled:opacity-50 print:hidden"
            >
              {exporting ? "Exporting..." : `${copy.exportCsv} (${exportKind})`}
            </button>
          }
          secondaryActions={
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/15 print:hidden"
            >
              {copy.printPdf}
            </button>
          }
        />

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {(["overview", "projects", "agencies", "budgets", "contractors"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                tab === t
                  ? "bg-[#111827] text-white shadow-2xs"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <div className="flex-1 min-w-[240px]">
            <FilterBar
              selects={[
                {
                  key: "status",
                  label: "Project Status",
                  value: status,
                  options: STATUS_OPTIONS,
                  onChange: setStatus,
                },
              ]}
              hasActiveFilters={Boolean(status || from || to)}
              onReset={() => {
                setStatus("");
                setFrom("");
                setTo("");
              }}
            />
          </div>
          <label className="text-xs text-slate-600">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
            />
          </label>
          <label className="text-xs text-slate-600">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
            />
          </label>
        </div>

        {tab === "overview" && ov ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Total Projects"
                value={ov.totalProjects}
                context={`${ov.activeProjects} active · ${ov.delayedProjects} overdue`}
                sourceKind="live"
              />
              <MetricCard
                label="Avg Physical Progress"
                value={`${ov.avgPhysicalProgress}%`}
                context={`${ov.completedProjects} completed`}
                tone="brand"
              />
              <MetricCard
                label="Total Allocated Budget"
                value={formatLkr(ov.totalBudgetMinor)}
                context={`Paid: ${formatLkr(ov.totalPaidMinor)}`}
                tone="success"
              />
              <MetricCard
                label="Operational Exceptions"
                value={ov.openIssues + ov.openConflicts}
                context={`${ov.openIssues} issues · ${ov.openConflicts} conflicts · ${ov.criticalRiskProjects} critical risk`}
                tone={ov.openConflicts > 0 ? "critical" : "neutral"}
              />
            </div>

            <div className="cac-card p-5">
              <ChainageBar
                verifiedPercent={ov.totalProjects > 0 ? Math.round((ov.completedProjects / ov.totalProjects) * 100) : 0}
                reportedPercent={ov.avgPhysicalProgress}
                label="Portfolio Completed Projects Ratio vs. Average Reported Physical Progress"
                verifiedLabel="Completed ratio"
                reportedLabel="Avg physical"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ChartFrame
                title="Projects by Status"
                subtitle="Distribution across statutory lifecycle stages"
                sourceKind="live"
                tableHeaders={["Status", "Project Count"]}
                tableRows={ov.byStatus.map((d) => [d.status, d.count])}
              >
                {ov.byStatus.length > 0 ? (
                  <StatusBarChart data={ov.byStatus} />
                ) : (
                  <p className="text-xs text-slate-500">No projects in scope.</p>
                )}
              </ChartFrame>
              <ChartFrame
                title="Top Districts"
                subtitle="Geographic concentration of active infrastructure works"
                sourceKind="live"
                tableHeaders={["District", "Projects"]}
                tableRows={(projectsQ.data?.byDistrict ?? []).map((d) => [d.district, d.count])}
              >
                <div className="space-y-2">
                  {(projectsQ.data?.byDistrict ?? []).map((d) => (
                    <div key={d.district} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{d.district}</span>
                      <span className="font-mono font-semibold text-slate-900">{d.count}</span>
                    </div>
                  ))}
                </div>
              </ChartFrame>
            </div>
          </div>
        ) : null}

        {tab === "projects" && projectsQ.data ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Title</th>
                  <th className="px-4 py-2.5">Agency</th>
                  <th className="px-4 py-2.5">District</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Budget</th>
                  <th className="px-4 py-2.5">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {projectsQ.data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-mono">{p.projectCode}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{p.title}</td>
                    <td className="px-4 py-2">{p.agencyCode ?? "—"}</td>
                    <td className="px-4 py-2">{p.district}</td>
                    <td className="px-4 py-2">{p.status}</td>
                    <td className="px-4 py-2">{formatLkr(p.budgetMinor)}</td>
                    <td className="px-4 py-2">{p.physicalProgress}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === "agencies" && agenciesQ.data ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Agency</th>
                  <th className="px-4 py-2.5">Projects</th>
                  <th className="px-4 py-2.5">Active</th>
                  <th className="px-4 py-2.5">Budget</th>
                  <th className="px-4 py-2.5">Paid</th>
                  <th className="px-4 py-2.5">Avg Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {agenciesQ.data.items.map((a) => (
                  <tr key={a.agencyId}>
                    <td className="px-4 py-2 font-mono">{a.code}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{a.name}</td>
                    <td className="px-4 py-2">{a.projectCount}</td>
                    <td className="px-4 py-2">{a.activeCount}</td>
                    <td className="px-4 py-2">{formatLkr(a.budgetMinor)}</td>
                    <td className="px-4 py-2">{formatLkr(a.paidMinor)}</td>
                    <td className="px-4 py-2">{a.avgPhysicalProgress}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === "budgets" && budgetsQ.data ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Project</th>
                  <th className="px-4 py-2.5">Budget</th>
                  <th className="px-4 py-2.5">Paid</th>
                  <th className="px-4 py-2.5">Pending</th>
                  <th className="px-4 py-2.5">Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {budgetsQ.data.items.map((b) => (
                  <tr key={b.projectId}>
                    <td className="px-4 py-2 font-mono">{b.projectCode}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{b.title}</td>
                    <td className="px-4 py-2">{formatLkr(b.budgetMinor)}</td>
                    <td className="px-4 py-2">{formatLkr(b.paidMinor)}</td>
                    <td className="px-4 py-2">{formatLkr(b.pendingMinor)}</td>
                    <td className="px-4 py-2">{b.utilizationPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === "contractors" && contractorsQ.data ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-left font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Reg No</th>
                  <th className="px-4 py-2.5">Contractor</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Assignments</th>
                  <th className="px-4 py-2.5">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {contractorsQ.data.items.map((c) => (
                  <tr key={c.contractorId}>
                    <td className="px-4 py-2 font-mono">{c.registrationNumber ?? "—"}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-2">{c.category ?? "—"}</td>
                    <td className="px-4 py-2">{c.status ?? "—"}</td>
                    <td className="px-4 py-2">{c.assignmentCount}</td>
                    <td className="px-4 py-2">{formatLkr(c.paidMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}

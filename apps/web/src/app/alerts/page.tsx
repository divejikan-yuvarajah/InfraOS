"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { FilterBar } from "@/components/common/filter-bar";
import { Pagination } from "@/components/common/pagination";
import { useListQueryState } from "@/lib/data-table/use-list-query-state";
import { acknowledgeSystemAlert, fetchSystemAlerts, triggerAlertEvaluation } from "@/lib/alerts/api";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "ACKNOWLEDGED", label: "Acknowledged" },
  { value: "RESOLVED", label: "Resolved" },
];

const SEVERITY_OPTIONS = [
  { value: "", label: "All severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "WARNING", label: "Warning" },
];

export default function AlertsPage() {
  const qc = useQueryClient();
  const { query, setQuery, resetQuery } = useListQueryState({
    page: 1,
    limit: 20,
    status: "ACTIVE",
    severity: "",
  });

  const alertsQuery = useQuery({
    queryKey: ["alerts", query.page, query.limit, query.status, query.severity],
    queryFn: () =>
      fetchSystemAlerts({
        page: query.page,
        limit: query.limit,
        status: query.status || "ACTIVE",
        severity: query.severity || undefined,
      }),
  });

  const ackMut = useMutation({
    mutationFn: (id: string) => acknowledgeSystemAlert(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const evalMut = useMutation({
    mutationFn: () => triggerAlertEvaluation(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["alerts"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const data = alertsQuery.data;

  return (
    <StaffWorkspaceShell title="System Alerts">
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">System Alerts</h1>
            <p className="text-sm text-slate-600">
              Automated operational exceptions: overdue milestones, SLA breaches, critical risks, and high conflicts.
            </p>
          </div>
          <button
            type="button"
            disabled={evalMut.isPending}
            onClick={() => evalMut.mutate()}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {evalMut.isPending ? "Scanning..." : "Run Alert Scan"}
          </button>
        </div>

        <FilterBar
          selects={[
            {
              key: "status",
              label: "Status",
              value: query.status || "ACTIVE",
              options: STATUS_OPTIONS,
              onChange: (val) => setQuery({ status: val, page: 1 }),
            },
            {
              key: "severity",
              label: "Severity",
              value: query.severity || "",
              options: SEVERITY_OPTIONS,
              onChange: (val) => setQuery({ severity: val, page: 1 }),
            },
          ]}
          hasActiveFilters={Boolean(query.severity || (query.status && query.status !== "ACTIVE"))}
          onReset={resetQuery}
        />

        {alertsQuery.isLoading ? (
          <div className="h-44 animate-pulse rounded-lg border border-slate-200 bg-white p-6" />
        ) : !data || data.items.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No alerts match the current filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {data.items.map((alert) => (
              <div key={alert.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase ${
                        alert.severity === "CRITICAL"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                      {alert.kind}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900">{alert.title}</h3>
                  </div>
                  <p className="text-sm text-slate-600">{alert.message}</p>
                  <p className="text-xs text-slate-400">
                    Last evaluated: {new Date(alert.lastEvaluatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {alert.actionUrl ? (
                    <Link
                      href={alert.actionUrl}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Inspect
                    </Link>
                  ) : null}
                  {alert.status === "ACTIVE" ? (
                    <button
                      type="button"
                      disabled={ackMut.isPending}
                      onClick={() => ackMut.mutate(alert.id)}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Acknowledge
                    </button>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {alert.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {data ? (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            onPageChange={(page) => setQuery({ page })}
          />
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}

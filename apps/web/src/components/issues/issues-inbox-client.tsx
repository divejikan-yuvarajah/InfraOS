"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { FilterBar } from "@/components/common/filter-bar";
import { Pagination } from "@/components/common/pagination";
import { apiClient } from "@/lib/api/client";
import { useListQueryState } from "@/lib/data-table/use-list-query-state";
import {
  createIssueRoutingRule,
  deleteIssueRoutingRule,
  fetchIssueRoutingRules,
  fetchStaffIssues,
} from "@/lib/issues/api";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "NEEDS_INFO", label: "Needs Info" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
  { value: "DUPLICATE", label: "Duplicate" },
  { value: "REJECTED", label: "Rejected" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "POTHOLE", label: "Pothole" },
  { value: "ROAD_DAMAGE", label: "Road Damage" },
  { value: "WATER_LEAK", label: "Water Leak" },
  { value: "DRAINAGE", label: "Drainage" },
  { value: "STREET_LIGHT", label: "Street Light" },
  { value: "UTILITY_DAMAGE", label: "Utility Damage" },
  { value: "PUBLIC_ASSET_DAMAGE", label: "Public Asset Damage" },
  { value: "OTHER", label: "Other" },
];

export function IssuesInboxClient() {
  const qc = useQueryClient();
  const { query, setQuery, resetQuery } = useListQueryState({ page: 1, limit: 20 });
  const [searchInput, setSearchInput] = useState(query.q ?? "");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const [ruleCategory, setRuleCategory] = useState("POTHOLE");
  const [ruleDistrict, setRuleDistrict] = useState("");
  const [ruleAgencyId, setRuleAgencyId] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      if ((query.q ?? "") !== searchInput) {
        setQuery({ q: searchInput || undefined, page: 1 });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput, query.q, setQuery]);

  const issuesQuery = useQuery({
    queryKey: ["issues", "inbox", query.page, query.q, query.status, query.type, unassignedOnly],
    queryFn: () =>
      fetchStaffIssues({
        page: query.page,
        limit: query.limit,
        q: query.q,
        status: query.status,
        category: query.type,
        unassigned: unassignedOnly,
      }),
  });

  const rulesQuery = useQuery({
    queryKey: ["issues", "routing-rules"],
    queryFn: fetchIssueRoutingRules,
    enabled: showRules,
  });

  const agenciesQuery = useQuery({
    queryKey: ["admin", "agencies", "lookup"],
    queryFn: () => apiClient<{ items: Array<{ id: string; code: string; name: string }> }>("/admin/agencies?limit=50", { authenticated: true }),
    enabled: showRules,
  });

  const addRuleMut = useMutation({
    mutationFn: () =>
      createIssueRoutingRule({
        category: ruleCategory,
        district: ruleDistrict.trim() || undefined,
        agencyId: ruleAgencyId,
      }),
    onSuccess: () => {
      setRuleDistrict("");
      void qc.invalidateQueries({ queryKey: ["issues", "routing-rules"] });
    },
  });

  const delRuleMut = useMutation({
    mutationFn: (id: string) => deleteIssueRoutingRule(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["issues", "routing-rules"] }),
  });

  const list = issuesQuery.data;

  return (
    <StaffWorkspaceShell title="Citizen Issues Inbox">
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Citizen Issues Inbox</h1>
            <p className="text-sm text-slate-600">Triage, route, and update public infrastructure reports.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUnassignedOnly((v) => !v)}
              className={`rounded-md border px-3 py-2 text-xs font-medium ${
                unassignedOnly ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {unassignedOnly ? "Showing Unassigned Triage" : "Triage Queue (Unassigned)"}
            </button>
            <button
              type="button"
              onClick={() => setShowRules((v) => !v)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {showRules ? "Hide Routing Rules" : "Routing Rules"}
            </button>
          </div>
        </div>

        {showRules ? (
          <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900">Auto-Routing Rules</h2>
            <div className="flex flex-wrap items-center gap-2">
              <select value={ruleCategory} onChange={(e) => setRuleCategory(e.target.value)} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
                {CATEGORY_OPTIONS.filter((o) => o.value).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                value={ruleDistrict}
                onChange={(e) => setRuleDistrict(e.target.value)}
                placeholder="District (optional)"
                className="h-9 rounded-md border border-slate-300 px-3 text-xs"
              />
              <select value={ruleAgencyId} onChange={(e) => setRuleAgencyId(e.target.value)} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
                <option value="">Select agency…</option>
                {(agenciesQuery.data?.items ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!ruleAgencyId || addRuleMut.isPending}
                onClick={() => addRuleMut.mutate()}
                className="h-9 rounded-md bg-blue-700 px-3 text-xs font-medium text-white disabled:opacity-50"
              >
                Add Rule
              </button>
            </div>
            <ul className="divide-y divide-slate-100 text-xs">
              {(rulesQuery.data?.items ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <span>
                    <strong>{r.category}</strong> {r.district ? `· ${r.district}` : "(Any district)"} → {r.agency ? `${r.agency.code} (${r.agency.name})` : "—"}
                  </span>
                  <button type="button" onClick={() => delRuleMut.mutate(r.id)} className="text-red-600 hover:underline">
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <FilterBar
          q={searchInput}
          onQChange={setSearchInput}
          searchPlaceholder="Search reference, title, or district…"
          hasActiveFilters={Boolean(query.q || query.status || query.type || unassignedOnly)}
          onReset={() => {
            setSearchInput("");
            setUnassignedOnly(false);
            resetQuery();
          }}
          selects={[
            {
              key: "status",
              label: "Status",
              value: query.status ?? "",
              options: STATUS_OPTIONS,
              onChange: (v) => setQuery({ status: v || undefined, page: 1 }),
            },
            {
              key: "category",
              label: "Category",
              value: query.type ?? "",
              options: CATEGORY_OPTIONS,
              onChange: (v) => setQuery({ type: v || undefined, page: 1 }),
            },
          ]}
        />

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Category / Summary</th>
                <th className="px-4 py-3">District</th>
                <th className="px-4 py-3">Agency</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(list?.items ?? []).map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{item.referenceNo ?? item.id.slice(-6)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{item.title || item.category}</div>
                    <div className="line-clamp-1 text-xs text-slate-500">{item.description}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{item.district ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{item.assignedAgency?.code ?? "Unassigned"}</td>
                  <td className="px-4 py-3 text-xs font-medium">{item.priority}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">{item.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/issues/${item.id}`} className="text-xs font-medium text-blue-700 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {list && list.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    No citizen issues match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {list ? (
          <Pagination
            page={list.page}
            totalPages={list.totalPages}
            total={list.total}
            onPageChange={(nextPage) => setQuery({ page: nextPage })}
          />
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}

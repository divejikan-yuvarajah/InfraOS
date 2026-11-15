"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { FilterBar } from "@/components/common/filter-bar";
import { Pagination } from "@/components/common/pagination";
import type { AuthLocale } from "@/lib/auth/types";
import { fetchPublicProjects, fetchPublicSummary } from "@/lib/public/api";
import { PORTAL_COPY } from "@/lib/public/messages";
import { PortalShell } from "./portal-shell";

const PROJECT_CATEGORIES = [
  { value: "", label: "All categories" },
  { value: "ROAD", label: "Road" },
  { value: "BRIDGE", label: "Bridge" },
  { value: "WATER", label: "Water" },
  { value: "POWER", label: "Power" },
  { value: "DRAINAGE", label: "Drainage" },
  { value: "TELECOM", label: "Telecom" },
  { value: "BUILDING", label: "Building" },
  { value: "OTHER", label: "Other" },
];

const PROJECT_STATUSES = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "APPROVED", label: "Approved" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ON_HOLD", label: "On Hold" },
];

export function PortalDirectoryClient({ locale }: { locale: AuthLocale }) {
  const copy = PORTAL_COPY[locale];
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [district, setDistrict] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const summaryQuery = useQuery({
    queryKey: ["public", "summary"],
    queryFn: fetchPublicSummary,
  });

  const projectsQuery = useQuery({
    queryKey: ["public", "projects", page, debouncedQ, category, status, district],
    queryFn: () =>
      fetchPublicProjects({
        page,
        limit: 9,
        q: debouncedQ || undefined,
        category: category || undefined,
        status: status || undefined,
        district: district || undefined,
      }),
  });

  const s = summaryQuery.data;
  const list = projectsQuery.data;

  return (
    <PortalShell locale={locale} activeNav="portal">
      {copy.draftNotice ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {copy.draftNotice}
        </p>
      ) : null}

      <section aria-label="Public summary statistics" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">{copy.statsReleased}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{s?.releasedProjects ?? "—"}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">{copy.statsActive}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-blue-700">{s?.activeProjects ?? "—"}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">{copy.statsCompleted}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">{s?.completedProjects ?? "—"}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">{copy.statsIssues}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {s ? `${s.resolvedIssues}/${s.totalIssuesReported}` : "—"}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{copy.directoryTitle}</h1>
          <div className="flex gap-2">
            <Link href="/portal/report" className="rounded-md bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800">
              {copy.navReport}
            </Link>
            <Link href="/portal/track" className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
              {copy.navTrack}
            </Link>
          </div>
        </div>

        <FilterBar
          q={q}
          onQChange={setQ}
          searchPlaceholder={copy.searchPlaceholder}
          hasActiveFilters={Boolean(q || category || status || district)}
          onReset={() => {
            setQ("");
            setCategory("");
            setStatus("");
            setDistrict("");
            setPage(1);
          }}
          selects={[
            {
              key: "category",
              label: copy.allCategories,
              value: category,
              options: PROJECT_CATEGORIES.map((o, idx) => (idx === 0 ? { ...o, label: copy.allCategories } : o)),
              onChange: (v) => {
                setCategory(v);
                setPage(1);
              },
            },
            {
              key: "status",
              label: copy.allStatuses,
              value: status,
              options: PROJECT_STATUSES.map((o, idx) => (idx === 0 ? { ...o, label: copy.allStatuses } : o)),
              onChange: (v) => {
                setStatus(v);
                setPage(1);
              },
            },
            {
              key: "district",
              label: copy.allDistricts,
              value: district,
              options: [
                { value: "", label: copy.allDistricts },
                { value: "Colombo", label: "Colombo" },
                { value: "Gampaha", label: "Gampaha" },
                { value: "Kandy", label: "Kandy" },
                { value: "Galle", label: "Galle" },
                { value: "Jaffna", label: "Jaffna" },
              ],
              onChange: (v) => {
                setDistrict(v);
                setPage(1);
              },
            },
          ]}
        />

        {projectsQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-lg border border-slate-200 bg-white p-4" />
            ))}
          </div>
        ) : list && list.items.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.items.map((item) => (
                <article key={item.slug} className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-mono">{item.projectCode}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{item.status}</span>
                    </div>
                    <h2 className="mt-2 text-base font-semibold text-slate-900">{item.title}</h2>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      {item.agency ? <span>{item.agency.code}</span> : null}
                      {item.district ? <span>· {item.district}</span> : null}
                      <span>· {item.category}</span>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    {item.physicalProgress !== null ? (
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>{copy.progressLabel}</span>
                          <span className="tabular-nums font-medium">{item.physicalProgress}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, item.physicalProgress))}%` }} />
                        </div>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{item.budgetBand ? `${copy.budgetBandLabel}: ${item.budgetBand}` : ""}</span>
                      <Link href={`/portal/projects/${item.slug}`} className="font-medium text-blue-700 hover:underline">
                        {copy.viewDetails} →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onPageChange={setPage} />
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
            {copy.noProjects}
          </div>
        )}
      </section>
    </PortalShell>
  );
}

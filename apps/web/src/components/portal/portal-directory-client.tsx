"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  BenchmarkStatusBadge,
  ChainageBar,
  CommandHeader,
  MetricCard,
} from "@/components/common/civic-atlas-primitives";
import { FilterBar } from "@/components/common/filter-bar";
import { Pagination } from "@/components/common/pagination";
import { ContentSkeleton } from "@/components/feedback/content-skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
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
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900">
          {copy.draftNotice}
        </p>
      ) : null}

      {/* Civic Editorial Command Header with Three Primary Actions (§3 & §5.8) */}
      <CommandHeader
        variant="navy"
        eyebrow="PUBLIC INFRASTRUCTURE TRANSPARENCY"
        title={copy.directoryTitle}
        subtitle={copy.brandSubtitle}
        sourceKind="live"
        primaryAction={
          <Link
            href="/portal/report"
            className="inline-flex min-h-10 items-center rounded-lg bg-[#c43d00] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#802a00]"
          >
            {copy.navReport}
          </Link>
        }
        secondaryActions={
          <>
            <Link
              href="/portal/map"
              className="inline-flex min-h-10 items-center rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/15"
            >
              {copy.navMap}
            </Link>
            <Link
              href="/portal/track"
              className="inline-flex min-h-10 items-center rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/15"
            >
              {copy.navTrack}
            </Link>
          </>
        }
      />

      <section
        aria-label="Public summary statistics"
        className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <MetricCard
          label={copy.statsReleased}
          value={s?.releasedProjects ?? "—"}
          sourceKind="live"
        />
        <MetricCard
          label={copy.statsActive}
          value={s?.activeProjects ?? "—"}
          tone="brand"
        />
        <MetricCard
          label={copy.statsCompleted}
          value={s?.completedProjects ?? "—"}
          tone="success"
        />
        <MetricCard
          label={copy.statsIssues}
          value={s ? `${s.resolvedIssues}/${s.totalIssuesReported}` : "—"}
        />
      </section>

      <section className="space-y-4">
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
              options: PROJECT_CATEGORIES.map((o, idx) =>
                idx === 0 ? { ...o, label: copy.allCategories } : o,
              ),
              onChange: (v) => {
                setCategory(v);
                setPage(1);
              },
            },
            {
              key: "status",
              label: copy.allStatuses,
              value: status,
              options: PROJECT_STATUSES.map((o, idx) =>
                idx === 0 ? { ...o, label: copy.allStatuses } : o,
              ),
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
          <ContentSkeleton variant="kpi" label="Loading public projects" />
        ) : list && list.items.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.items.map((item) => (
                <article
                  key={item.slug}
                  className="cac-card flex flex-col justify-between p-5 transition-shadow hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono font-bold text-slate-700">
                        {item.projectCode}
                      </span>
                      <BenchmarkStatusBadge status={item.status} size="sm" />
                    </div>
                    <h2 className="mt-2.5 text-base font-semibold text-slate-900">
                      {item.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                      {item.summary}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                      {item.agency ? <span>{item.agency.code}</span> : null}
                      {item.district ? <span>· {item.district}</span> : null}
                      <span>· {item.category}</span>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3 space-y-3">
                    {item.physicalProgress !== null ? (
                      <ChainageBar
                        verifiedPercent={item.status === "COMPLETED" ? 100 : null}
                        reportedPercent={item.physicalProgress}
                        label={copy.progressLabel}
                        showRulerLabels={false}
                      />
                    ) : null}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">
                        {item.budgetBand
                          ? `${copy.budgetBandLabel}: ${item.budgetBand}`
                          : ""}
                      </span>
                      <Link
                        href={`/portal/projects/${item.slug}`}
                        className="font-semibold text-[#c43d00] hover:underline"
                      >
                        {copy.viewDetails} →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <Pagination
              page={list.page}
              totalPages={list.totalPages}
              total={list.total}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState variant="no-results" title={copy.noProjects} />
        )}
      </section>
    </PortalShell>
  );
}

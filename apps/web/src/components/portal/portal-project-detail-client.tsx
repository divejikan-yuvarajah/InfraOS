"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import type { AuthLocale } from "@/lib/auth/types";
import { fetchPublicProjectBySlug } from "@/lib/public/api";
import { PORTAL_COPY } from "@/lib/public/messages";
import { PortalShell } from "./portal-shell";

export function PortalProjectDetailClient({ slug, locale = "en" }: { slug: string; locale?: AuthLocale }) {
  const copy = PORTAL_COPY[locale];
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public", "project", slug],
    queryFn: () => fetchPublicProjectBySlug(slug),
  });

  return (
    <PortalShell locale={locale} activeNav="portal">
      <div className="mb-4">
        <Link href="/portal" className="text-sm font-medium text-blue-700 hover:underline">
          ← {copy.backToPortal}
        </Link>
      </div>

      {isLoading ? (
        <div className="h-56 animate-pulse rounded-lg border border-slate-200 bg-white p-6" />
      ) : isError || !data ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Public project record not found.
        </div>
      ) : (
        <article className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="font-mono text-xs text-slate-500">{data.projectCode}</span>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">{data.title}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {data.agency ? `${data.agency.name} (${data.agency.code})` : ""}
                {data.district ? ` · ${data.district}${data.province ? `, ${data.province}` : ""}` : ""}
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{data.status}</span>
          </div>

          <p className="text-sm leading-relaxed text-slate-700">{data.summary}</p>

          <dl className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500">{copy.progressLabel}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {data.physicalProgress !== null ? `${data.physicalProgress}%` : "Not disclosed"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">{copy.budgetBandLabel}</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">
                {data.budgetBand ? `${data.budgetBand}${data.currency ? ` (${data.currency})` : ""}` : "Not disclosed"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">{copy.targetEndLabel}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{data.plannedEndDate ?? "—"}</dd>
            </div>
          </dl>

          {data.coordinates ? (
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              Coarsened corridor coordinates: {data.coordinates.lat.toFixed(3)}, {data.coordinates.lng.toFixed(3)} ·{" "}
              <Link href="/portal/map" className="font-medium text-blue-700 hover:underline">
                View on Public Map
              </Link>
            </div>
          ) : null}
        </article>
      )}
    </PortalShell>
  );
}

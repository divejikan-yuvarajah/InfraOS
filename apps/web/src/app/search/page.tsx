"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { FilterBar } from "@/components/common/filter-bar";
import { fetchGlobalSearch, type GlobalSearchResultItem } from "@/lib/search/api";

const KIND_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "PROJECT", label: "Projects" },
  { value: "ISSUE", label: "Citizen Issues" },
  { value: "CONTRACTOR", label: "Contractors" },
  { value: "DOCUMENT", label: "Documents" },
  { value: "ASSET", label: "Assets" },
];

export default function GlobalSearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(initialQ);
  const [kind, setKind] = useState("");

  const trimmed = q.trim();
  const searchQuery = useQuery({
    queryKey: ["global-search", trimmed],
    queryFn: () => fetchGlobalSearch(trimmed, 15),
    enabled: trimmed.length >= 2,
  });

  const allItems: GlobalSearchResultItem[] = searchQuery.data
    ? [
        ...searchQuery.data.projects,
        ...searchQuery.data.issues,
        ...searchQuery.data.contractors,
        ...searchQuery.data.documents,
        ...searchQuery.data.assets,
      ].filter((item) => !kind || item.kind === kind)
    : [];

  return (
    <StaffWorkspaceShell title="Global Search">
      <div className="space-y-5 p-4 sm:p-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Global Workspace Search</h1>
          <p className="text-sm text-slate-600">
            Search across projects, citizen issues, contractors, documents, and assets.
          </p>
        </div>

        <FilterBar
          q={q}
          onQChange={(val: string) => {
            setQ(val);
            const next = new URLSearchParams();
            if (val.trim()) next.set("q", val.trim());
            router.replace(next.toString() ? `/search?${next.toString()}` : "/search", { scroll: false });
          }}
          searchPlaceholder="Enter at least 2 characters (title, code, district)..."
          selects={[
            {
              key: "kind",
              label: "Category",
              value: kind,
              options: KIND_OPTIONS,
              onChange: setKind,
            },
          ]}
          hasActiveFilters={Boolean(q.trim() || kind)}
          onReset={() => {
            setQ("");
            setKind("");
            router.replace("/search", { scroll: false });
          }}
        />

        {trimmed.length < 2 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Type at least 2 characters to search.
          </div>
        ) : searchQuery.isLoading ? (
          <div className="h-40 animate-pulse rounded-lg border border-slate-200 bg-white p-6" />
        ) : allItems.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No matching records found for &ldquo;{trimmed}&rdquo;.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {allItems.map((item) => (
              <Link
                key={`${item.kind}:${item.id}`}
                href={item.href}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {item.kind}
                    </span>
                    {item.code ? (
                      <span className="font-mono text-xs font-semibold text-slate-600">{item.code}</span>
                    ) : null}
                    <span className="text-sm font-medium text-slate-900">{item.title}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{item.subtitle}</p>
                </div>
                {item.status ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    {item.status}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </StaffWorkspaceShell>
  );
}

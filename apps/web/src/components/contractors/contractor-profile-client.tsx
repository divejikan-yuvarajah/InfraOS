"use client";

import { useQuery } from "@tanstack/react-query";
import { CopyIcon, HandshakeIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { ApiError } from "@/lib/api/client";
import { fetchPerformance, fetchProfile } from "@/lib/contractors/api";
import { fill } from "@/lib/contractors/format";
import { getContractorCopy } from "@/lib/contractors/messages";
import { useContractorKeys } from "@/lib/contractors/session";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import "@/styles/site-plan-projects.css";
import "@/styles/contractors.css";

import { ContractorFinanceCard } from "@/components/finance/finance-links";

import { Initials, Skeleton, StatusBadge } from "./contractor-badges";
import { AssignDialog, StatusDialog, type StatusTarget } from "./contractor-dialogs";
import { PerformancePanel } from "./profile-performance";
import { ProjectsPanel } from "./profile-projects";
import { ActivityPanel, CompliancePanel, OverviewPanel } from "./profile-sections";

const TABS = ["overview", "projects", "performance", "compliance", "activity"] as const;
type Tab = (typeof TABS)[number];

export function ContractorProfileClient({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const keys = useContractorKeys();
  const [locale] = useWorkspaceLocale();
  const copy = getContractorCopy(locale);
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const profile = useQuery({ queryKey: keys.key("profile", id), queryFn: () => fetchProfile(id), retry: false });
  const canPerf = Boolean(profile.data?.can.performance);
  const perf = useQuery({ queryKey: keys.key("perf", id), queryFn: () => fetchPerformance(id), enabled: canPerf, retry: false });

  const visibleTabs = TABS.filter((t) => t !== "performance" || canPerf);
  const requested = searchParams.get("tab");
  const tab: Tab = (visibleTabs as readonly string[]).includes(requested ?? "") ? (requested as Tab) : "overview";
  const setTab = (next: Tab) => router.replace(`${pathname}?tab=${next}`, { scroll: false });
  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (e.key === "Home" || e.key === "End" || dir) {
      e.preventDefault();
      const to = e.key === "Home" ? 0 : e.key === "End" ? visibleTabs.length - 1 : (index + dir + visibleTabs.length) % visibleTabs.length;
      const target = visibleTabs[to]!;
      setTab(target);
      tabRefs.current[target]?.focus();
    }
  };

  const p = profile.data;
  const platform = Boolean(p?.can.platform);
  const reactivable = p && (p.status === "SUSPENDED" || p.status === "INACTIVE" || (p.status === "ARCHIVED" && platform));
  const error = profile.error instanceof ApiError ? (profile.error.status === 404 ? copy.common.notFound : profile.error.status === 403 ? copy.common.forbidden : copy.profile.loadFailed) : profile.error ? copy.profile.loadFailed : null;

  return (
    <StaffWorkspaceShell
      title={p?.name ?? copy.title}
      wide
      context={<ContextBar crumbs={[{ label: copy.breadcrumbWorkspace, href: "/dashboard" }, { label: copy.title, href: "/contractors" }, { label: p?.name ?? "…" }]} />}
    >
      <div className="ctr">
        {locale !== "en" ? <p className="ctr-small">{copy.nativeReview}</p> : null}
        <Link href="/contractors" className="ctr-small" style={{ width: "fit-content" }}>← {copy.profile.back}</Link>

        {profile.isLoading ? <div className="sp-surface ctr-hero" aria-busy="true"><Skeleton height="3.5rem" width="50%" /><Skeleton height="1.5rem" width="30%" /></div> : null}
        {error ? <div role="alert" className="sp-surface ctr-panel"><p className="ctr-error">{error}</p><div><button type="button" className="ctr-btn" onClick={() => void profile.refetch()}>{copy.common.retry}</button></div></div> : null}

        {p ? (
          <>
            <header className="sp-surface ctr-hero">
              <div className="ctr-hero-top">
                <div className="ctr-hero-main">
                  <Initials name={p.name} large />
                  <div>
                    <h2>{p.name}</h2>
                    <div className="ctr-row">
                      <span className="ctr-code">{p.registrationNumber}</span>
                      <button type="button" className="ctr-btn is-ghost" aria-label={copy.directory.copyReg} onClick={async () => { try { await navigator.clipboard.writeText(p.registrationNumber); toast.success(copy.common.copied); } catch { toast.error(copy.common.errorGeneric); } }}><CopyIcon aria-hidden="true" /></button>
                      <StatusBadge status={p.status} copy={copy} />
                      {p.category ? <span className="ctr-tag">{copy.categories[p.category]}</span> : null}
                    </div>
                    <div className="ctr-chips" style={{ marginTop: "0.4rem" }}>
                      {p.agencyName ? <span className="ctr-small">{fill(copy.profile.registeredBy, { name: p.agencyName })}</span> : null}
                      {p.operatingDistricts.slice(0, 4).map((d) => <span key={d} className="ctr-tag">{d}</span>)}
                      {p.operatingDistricts.length > 4 ? <span className="ctr-tag">{fill(copy.directory.moreDistricts, { n: p.operatingDistricts.length - 4 })}</span> : null}
                    </div>
                  </div>
                </div>
                <div className="ctr-row">
                  {p.can.manage ? <Link className="ctr-btn" href={`/contractors/${p.id}/edit`}><PencilIcon aria-hidden="true" />{copy.common.edit}</Link> : null}
                  {p.can.assign ? <button type="button" className="ctr-btn is-primary" onClick={() => setAssignOpen(true)}><HandshakeIcon aria-hidden="true" />{copy.profile.assign}</button> : null}
                  {p.can.manage && p.status === "ACTIVE" ? <button type="button" className="ctr-btn" onClick={() => setStatusTarget("SUSPENDED")}>{copy.directory.suspend}</button> : null}
                  {p.can.manage && reactivable ? <button type="button" className="ctr-btn" onClick={() => setStatusTarget("ACTIVE")}>{copy.directory.reactivate}</button> : null}
                  {p.can.manage && p.status !== "ARCHIVED" ? <button type="button" className="ctr-btn" onClick={() => setStatusTarget("ARCHIVED")}>{copy.directory.archive}</button> : null}
                </div>
              </div>
              {p.restricted ? <p className="ctr-note">{copy.profile.restrictedBanner}</p> : null}
            </header>

            <div role="tablist" aria-label={p.name} className="ctr-tabs">
              {visibleTabs.map((t, i) => (
                <button key={t} id={`ctr-tab-${t}`} ref={(el) => { tabRefs.current[t] = el; }} type="button" role="tab" className="ctr-tab" aria-selected={tab === t} aria-controls={`ctr-panel-${t}`} tabIndex={tab === t ? 0 : -1} onClick={() => setTab(t)} onKeyDown={(e) => onTabKey(e, i)}>
                  {copy.profile.tabs[t]}
                </button>
              ))}
            </div>
            <div role="tabpanel" id={`ctr-panel-${tab}`} aria-labelledby={`ctr-tab-${tab}`} tabIndex={0}>
              {tab === "overview" ? <><OverviewPanel profile={p} copy={copy} locale={locale} /><div style={{ marginTop: "1rem" }}><ContractorFinanceCard contractorId={p.id} /></div></> : null}
              {tab === "projects" ? <ProjectsPanel id={p.id} copy={copy} locale={locale} /> : null}
              {tab === "performance" ? (
                perf.isLoading ? <div className="sp-surface ctr-panel" aria-busy="true"><Skeleton height="6rem" /></div>
                  : perf.data ? <PerformancePanel perf={perf.data} copy={copy} locale={locale} onOpenCompliance={() => setTab("compliance")} />
                  : <div role="alert" className="sp-surface ctr-panel"><p className="ctr-error">{perf.error instanceof ApiError && perf.error.status === 403 ? copy.performance.restricted : copy.common.unavailable}</p><div><button type="button" className="ctr-btn" onClick={() => void perf.refetch()}>{copy.common.retry}</button></div></div>
              ) : null}
              {tab === "compliance" ? <CompliancePanel profile={p} copy={copy} locale={locale} perf={perf.data} onOpenCompliance={() => setTab("compliance")} /> : null}
              {tab === "activity" ? <ActivityPanel id={p.id} copy={copy} locale={locale} /> : null}
            </div>

            <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} copy={copy} locale={locale} contractor={{ id: p.id, name: p.name }} />
            {statusTarget ? <StatusDialog open onOpenChange={(o) => { if (!o) setStatusTarget(null); }} copy={copy} locale={locale} contractor={{ id: p.id, name: p.name, updatedAt: p.updatedAt }} target={statusTarget} /> : null}
          </>
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}

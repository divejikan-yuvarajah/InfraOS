"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ClipboardCheckIcon, MapIcon, PencilIcon, PlusIcon, PrinterIcon, WrenchIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ScheduleDialog } from "@/components/inspections/inspection-dialogs";
import { ContextBar } from "@/components/site-plan/site-plan";
import { fetchAsset, fetchTimeline } from "@/lib/assets/api";
import { getAssetCopy, type Copy } from "@/lib/assets/messages";
import { useAssetKeys } from "@/lib/assets/session";
import type { Assessment, AssetDetail, KnownCondition, TimelineEvent } from "@/lib/assets/types";
import { CONDITION_FILL, fill, fmtDate, isHealthFull, money } from "@/lib/assets/view";
import type { AuthLocale } from "@/lib/auth/types";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { getInspectionCopy } from "@/lib/inspections/messages";

import { AssessmentDialog, EditDialog, RequestMaintenanceDialog, StatusDialog } from "./asset-dialogs";
import { BasisChip, Chip, ConditionChip, EmptyState, ErrorState, EvidencePips, FlagList, HealthGauge, MaintStatusChip, OpStatusChip, PriorityChip, Skeletons } from "./asset-ui";

type Common = { copy: Copy; locale: AuthLocale };
const TABS = ["overview", "condition", "maintenance", "health", "lifecycle", "construction", "activity"] as const;
type Tab = (typeof TABS)[number];
const COND_ORDER: KnownCondition[] = ["CRITICAL", "POOR", "FAIR", "GOOD", "EXCELLENT"];

function Kv({ rows }: { rows: [string, React.ReactNode][] }) {
  return <dl className="ast-kv">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? "—"}</dd></div>)}</dl>;
}

/** Condition over time: a step line of the recorded assessments with maintenance completions as ticks. Needs at least two assessments. */
function ConditionChart({ asset, copy, locale }: Common & { asset: AssetDetail }) {
  const pts = [...asset.assessments].filter((a) => a.status !== undefined).sort((a, b) => +new Date(a.assessedAt) - +new Date(b.assessedAt));
  if (pts.length < 2) return <p className="ins-muted">{copy.conditionPanel.chartNeeds}</p>;
  const t0 = +new Date(pts[0]!.assessedAt);
  const t1 = Math.max(+new Date(pts[pts.length - 1]!.assessedAt), t0 + 86_400_000);
  const W = 560, H = 160, L = 74, R = 12, T = 10, B = 24;
  const x = (t: number) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const y = (c: KnownCondition) => T + ((5 - CONDITION_FILL[c]) / 4) * (H - T - B);
  const path = pts.map((p, i) => `${i ? "L" : "M"} ${x(+new Date(p.assessedAt))} ${y(p.condition)}`).join(" ");
  const marks = asset.maintenance.filter((m) => m.completedDate && +new Date(m.completedDate) >= t0 && +new Date(m.completedDate) <= t1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={copy.conditionPanel.chartTitle} style={{ width: "100%", height: "auto" }}>
      {COND_ORDER.map((c) => <g key={c}><line x1={L} x2={W - R} y1={y(c)} y2={y(c)} stroke="#e5eaf1" /><text x={L - 6} y={y(c) + 3} textAnchor="end" fontSize="9" fill="currentColor">{copy.condition[c]}</text></g>)}
      {marks.map((m) => <line key={m.id} x1={x(+new Date(m.completedDate!))} x2={x(+new Date(m.completedDate!))} y1={T} y2={H - B} stroke="#1f7a4c" strokeDasharray="3 3"><title>{copy.conditionPanel.maintenanceMarker}: {m.title}</title></line>)}
      <path d={path} fill="none" stroke="var(--infra-text)" strokeWidth="2" />
      {pts.map((p) => <circle key={p.id} cx={x(+new Date(p.assessedAt))} cy={y(p.condition)} r="4" fill={p.basis === "INSPECTION_VERIFIED" ? "var(--infra-text)" : "#fff"} stroke="var(--infra-text)" strokeWidth="2"><title>{fmtDate(p.assessedAt, locale)}: {copy.condition[p.condition]} · {copy.basisShort[p.basis]}</title></circle>)}
      <text x={L} y={H - 6} fontSize="9" fill="currentColor">{fmtDate(pts[0]!.assessedAt, locale)}</text>
      <text x={W - R} y={H - 6} fontSize="9" textAnchor="end" fill="currentColor">{fmtDate(pts[pts.length - 1]!.assessedAt, locale)}</text>
    </svg>
  );
}

function AssessmentList({ items, copy, locale }: Common & { items: Assessment[] }) {
  if (!items.length) return <p className="ins-muted">{copy.conditionPanel.noAssessments}</p>;
  return (
    <ul className="ast-tl">
      {items.map((a) => (
        <li key={a.id}>
          <div className="ctr-row"><ConditionChip value={a.condition} copy={copy} /><BasisChip basis={a.basis} copy={copy} short />{a.status === "SUPERSEDED" ? <Chip tone="neutral">{copy.mstatus.CANCELLED}</Chip> : null}<span className="ins-muted">{fmtDate(a.assessedAt, locale)}</span></div>
          {a.previousCondition ? <span className="ins-muted">{fill(copy.conditionPanel.previous, { condition: copy.condition[a.previousCondition as KnownCondition] ?? a.previousCondition })}</span> : null}
          {a.observations ? <p style={{ margin: "0.25rem 0" }}>{a.observations}</p> : null}
          <span className="ins-muted">{a.assessedByName ? fill(copy.conditionPanel.by, { name: a.assessedByName }) : ""}{a.reviewedByName ? ` · ${fill(copy.conditionPanel.reviewedBy, { name: a.reviewedByName })}` : ""}</span>
          {a.inspectionId ? <> <Link className="ins-link" href={`/inspections/${a.inspectionId}`}>{copy.conditionPanel.viewInspection}</Link></> : null}
        </li>
      ))}
    </ul>
  );
}

function HealthPanel({ asset, copy }: { asset: AssetDetail; copy: Copy }) {
  const h = asset.health;
  const hp = copy.healthPanel;
  if (!isHealthFull(h)) return <EmptyState title={hp.restricted} />;
  if (h.availability !== "AVAILABLE" || h.score === null) {
    return <EmptyState title={hp.notEnoughTitle} body={`${hp.notEnoughBody} ${h.reasons.map((r) => (hp.missing as Record<string, string>)[r] ?? "").filter(Boolean).join(" ")}`.trim()} />;
  }
  const names = copy.healthPanel.components;
  return (
    <div className="ast-two">
      <div className="ins-panel">
        <HealthGauge score={h.score} band={h.band} copy={copy} />
        <Kv rows={[[hp.evidence, <EvidencePips key="e" level={h.evidenceLevel} copy={copy} />], [hp.basis, h.basis ? copy.basis[h.basis] : "—"], [hp.band, h.band ? copy.band[h.band] : "—"]]} />
        {h.caps.length ? <div><strong>{hp.caps}</strong><ul>{h.caps.map((c) => <li key={c}>{(hp.capsText as Record<string, string>)[c] ?? c}</li>)}</ul></div> : null}
        {h.hints.length ? <div><strong>{hp.hintsTitle}</strong><ul>{h.hints.map((x) => <li key={x}>{(hp.hints as Record<string, string>)[x] ?? x}</li>)}</ul></div> : null}
        <p className="ins-muted">{fill(hp.rules, { version: h.version })}</p>
      </div>
      <div className="ins-panel">
        <h3 className="ins-h">{hp.howCalculated}</h3>
        {h.components.map((c) => (
          <div key={c.key} className="ast-comp" data-skipped={c.score === null}>
            <div className="ast-comp-head"><strong>{names[c.key]}</strong><span>{c.score === null ? hp.skipped : c.score} · {c.score === null ? "" : fill(hp.weightUsed, { n: Math.round(c.weightUsed * 100) })}</span></div>
            <span className="ast-bar-track" aria-hidden="true"><i style={{ width: `${c.score ?? 0}%`, background: "var(--infra-orange)" }} /></span>
            <span className="ins-muted">{(hp.componentHelp as Record<string, string>)[c.key]}</span>
            <span className="ins-muted">{(hp.reason as Record<string, string>)[c.reasonKey] ?? c.reasonKey}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const eventLabel = (e: TimelineEvent, copy: Copy): string => {
  const dict = copy.lifecycle.events as Record<string, string>;
  const params = Object.fromEntries(Object.entries(e.params).map(([k, v]) => [k, k === "condition" && typeof v === "string" ? copy.condition[v as keyof typeof copy.condition] ?? v : v ?? ""]));
  return fill(dict[e.type] ?? e.type, { no: e.ref ?? "", ...params });
};

function TimelineTab({ id, copy, locale, only }: Common & { id: string; only?: string }) {
  const { key } = useAssetKeys();
  const [source, setSource] = useState(only ?? "");
  const q = useInfiniteQuery({
    queryKey: key("timeline", id, source), initialPageParam: "" as string,
    queryFn: ({ pageParam }) => fetchTimeline(id, { source: source || undefined, cursor: pageParam || undefined, limit: 25 }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const events = q.data?.pages.flatMap((p) => p.events) ?? [];
  return (
    <div className="ins-panel">
      {!only ? (
        <div className="ctr-field"><label htmlFor="tl-src">{copy.lifecycle.filter}</label>
          <select id="tl-src" className="ctr-input" value={source} onChange={(e) => setSource(e.target.value)}><option value="">{copy.lifecycle.all}</option>{Object.entries(copy.lifecycle.sources).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      ) : null}
      {q.isPending ? <Skeletons n={2} /> : q.isError ? <ErrorState error={q.error} copy={copy} onRetry={() => void q.refetch()} /> : events.length === 0 ? <p className="ins-muted">{copy.lifecycle.none}</p> : (
        <ul className="ast-tl">{events.map((e, i) => (
          <li key={`${e.at}${e.type}${i}`}>
            <strong>{eventLabel(e, copy)}</strong><br /><span className="ins-muted">{fmtDate(e.at, locale)} · {(copy.lifecycle.sources as Record<string, string>)[e.source] ?? e.source}</span>
            {e.link && e.link.startsWith("/") ? <> <Link className="ins-link" href={e.link}>{copy.common.open}</Link></> : null}
          </li>
        ))}</ul>
      )}
      {q.hasNextPage ? <button type="button" className="ctr-btn" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{copy.lifecycle.loadMore}</button> : null}
    </div>
  );
}

function ConstructionTab({ asset, copy, locale }: Common & { asset: AssetDetail }) {
  const c = asset.construction;
  const p = c.project;
  if (!p) return <EmptyState title={copy.construction.none} />;
  return (
    <div className="ast-two">
      <div className="ins-panel">
        <h3 className="ins-h">{copy.construction.project}</h3>
        <Link className="ins-link" href={`/projects/${p.id}/overview`}>{p.projectCode} · {p.title}</Link>
        <span className="ins-muted">{p.completedOn ? fill(copy.construction.completedOn, { date: fmtDate(p.completedOn, locale) }) : ""}</span>
        {c.finance ? <Kv rows={[[copy.construction.paid, money(c.finance.paidMinor, locale)]]} /> : null}
        {c.inspections ? <Kv rows={Object.entries(c.inspections).map(([k, v]) => [k, v])} /> : null}
        {!c.contractors && !c.finance ? <p className="ins-muted">{copy.construction.restricted}</p> : null}
      </div>
      <div className="ins-panel">
        <h3 className="ins-h">{copy.construction.contractors}</h3>
        {c.contractors?.length ? <ul>{c.contractors.map((x) => <li key={x.contractorId}><Link className="ins-link" href={`/contractors/${x.contractorId}`}>{x.name ?? "—"}</Link> <span className="ins-muted">{x.contractReference ? fill(copy.construction.contractReference, { ref: x.contractReference }) : ""}</span></li>)}</ul> : <p className="ins-muted">{copy.construction.none}</p>}
        <h3 className="ins-h">{copy.construction.documents}</h3>
        {c.documents?.length ? <ul>{c.documents.map((d) => <li key={d.id}>{d.fileName} <span className="ins-muted">{d.documentType}</span></li>)}</ul> : <p className="ins-muted">{copy.construction.none}</p>}
      </div>
    </div>
  );
}

export function AssetPassport({ id }: { id: string }) {
  const [locale] = useWorkspaceLocale();
  const copy = getAssetCopy(locale);
  const router = useRouter();
  const sp = useSearchParams();
  const { key, roleKey } = useAssetKeys();
  const q = useQuery({ queryKey: key("asset", id), queryFn: ({ signal }) => fetchAsset(id, signal) });
  const tabParam = sp.get("tab") as Tab | null;
  const tab: Tab = tabParam && (TABS as readonly string[]).includes(tabParam) ? tabParam : "overview";
  const [dialog, setDialog] = useState<"assessment" | "maintenance" | "status" | "edit" | "verified" | null>(() => (sp.get("action") === "assessment" ? "assessment" : sp.get("action") === "maintenance" ? "maintenance" : null));
  const inspectionCopy = useMemo(() => getInspectionCopy(locale), [locale]);
  const a = q.data;
  const setTab = (t: Tab) => { const p = new URLSearchParams(sp.toString()); p.delete("action"); if (t === "overview") p.delete("tab"); else p.set("tab", t); router.replace(p.toString() ? `/assets/${id}?${p.toString()}` : `/assets/${id}`, { scroll: false }); };
  const close = (o: boolean) => { if (!o) { setDialog(null); if (sp.get("action")) { const p = new URLSearchParams(sp.toString()); p.delete("action"); router.replace(p.toString() ? `/assets/${id}?${p.toString()}` : `/assets/${id}`, { scroll: false }); } } };
  const dead = a?.operationalStatus === "DECOMMISSIONED";
  const ps = copy.passport;
  const canPlan = ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"].includes(roleKey);
  const dlpActive = a?.defectsLiabilityEndsOn ? new Date(a.defectsLiabilityEndsOn).getTime() > new Date().getTime() : false;
  const dlpFlag = a?.condition.flags.find((f) => f.code === "DLP_DETERIORATION");

  return (
    <StaffWorkspaceShell title={a?.name ?? ps.title} description={a ? `${a.assetNo ?? "—"} · ${copy.assetType[a.assetType]}` : ps.title} wide
      context={<ContextBar crumbs={[{ label: copy.nav.assets, href: "/assets" }, { label: a?.assetNo ?? ps.title }]} scope={copy.dashboard.scope} asOf={null} actions={a ? (
        <div className="ctr-row ast-noprint">
          {a.can.recordAssessment && !dead ? <button type="button" className="ctr-btn is-primary" onClick={() => setDialog("assessment")}><ClipboardCheckIcon aria-hidden="true" />{ps.actions.recordAssessment}</button> : null}
          {a.can.requestMaintenance && !dead ? <button type="button" className="ctr-btn" onClick={() => setDialog("maintenance")}><WrenchIcon aria-hidden="true" />{ps.actions.requestMaintenance}</button> : null}
          {a.can.requestVerifiedAssessment && !dead && a.construction.project ? <button type="button" className="ctr-btn" onClick={() => setDialog("verified")}><PlusIcon aria-hidden="true" />{ps.actions.requestVerified}</button> : null}
          {a.hasGeometry ? <Link className="ctr-btn" href={`/inframap?sel=assets:${a.id}`}><MapIcon aria-hidden="true" />{ps.actions.viewOnMap}</Link> : null}
          <button type="button" className="ctr-btn" onClick={() => window.print()}><PrinterIcon aria-hidden="true" />{ps.actions.print}</button>
          {a.can.update ? <button type="button" className="ctr-btn" onClick={() => setDialog("edit")}><PencilIcon aria-hidden="true" />{ps.actions.edit}</button> : null}
          {a.can.update ? <button type="button" className="ctr-btn" onClick={() => setDialog("status")}>{ps.actions.changeStatus}</button> : null}
        </div>
      ) : null} />}>
      <div className="ins ast ast-print">
        {q.isPending ? <Skeletons /> : q.isError ? <ErrorState error={q.error} copy={copy} onRetry={() => void q.refetch()} /> : a ? (
          <>
            <section className="ins-panel">
              <div className="ctr-row">
                <ConditionChip value={a.condition.value} copy={copy} /><BasisChip basis={a.condition.basis} copy={copy} /><OpStatusChip status={a.operationalStatus} copy={copy} />
                <Chip tone="neutral">{copy.origin[a.origin as keyof typeof copy.origin] ?? a.origin}</Chip>
              </div>
              <Kv rows={[
                [ps.owner, a.owner.name], [ps.builtBy, a.constructionAgency?.name ?? null], [ps.handover, a.handoverAt ? fmtDate(a.handoverAt, locale) : null],
                [ps.dlp, a.defectsLiabilityEndsOn ? fmtDate(a.defectsLiabilityEndsOn, locale) : copy.common.notProvided], [ps.interval, fill(ps.days, { n: a.monitoringIntervalDays })], [ps.designLife, a.designLifeYears ? fill(ps.years, { n: a.designLifeYears }) : copy.common.notProvided],
                [ps.location, [a.location?.roadName, a.location?.locality, a.location?.district].filter(Boolean).join(", ") || (a.hasGeometry ? "—" : ps.noGeometry)],
              ]} />
            </section>

            {dlpFlag ? <div className="ast-flag" data-sev="HIGH" role="status"><strong>{ps.dlpWatch}.</strong> {fill(ps.dlpBody, { date: a.defectsLiabilityEndsOn ? fmtDate(a.defectsLiabilityEndsOn, locale) : "—" })}</div>
              : dlpActive ? <p className="ins-muted">{fill(ps.dlpActive, { date: fmtDate(a.defectsLiabilityEndsOn, locale) })}</p> : null}

            <div className="ast-tabs ast-noprint" role="tablist" aria-label={ps.title}>
              {TABS.map((t) => <button key={t} id={`tab-${t}`} role="tab" type="button" aria-selected={tab === t} aria-controls="tab-panel" onClick={() => setTab(t)}>{ps.tabs[t]}</button>)}
            </div>
            <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} style={{ display: "grid", gap: "1rem" }}>
              {tab === "overview" ? (
                <div className="ast-two">
                  <div className="ins-panel">
                    <h3 className="ins-h">{copy.conditionPanel.flagsTitle}</h3>
                    {a.condition.flags.length ? <FlagList flags={a.condition.flags} copy={copy} /> : <p className="ins-muted">{copy.conditionPanel.noFlags}</p>}
                    <Kv rows={[[copy.conditionPanel.assessments, `${a.assessments.length}`], [copy.common.status, (copy.conditionPanel.trend as Record<string, string>)[a.condition.trend] ?? a.condition.trend]]} />
                    {a.condition.declinePerYear !== null ? <p className="ins-muted">{fill(copy.conditionPanel.decline, { n: a.condition.declinePerYear })}</p> : <p className="ins-muted">{copy.conditionPanel.declineNeeds}</p>}
                  </div>
                  <div className="ins-panel">
                    <h3 className="ins-h">{copy.healthPanel.title}</h3>
                    {isHealthFull(a.health) && a.health.score !== null ? <HealthGauge score={a.health.score} band={a.health.band} copy={copy} /> : <p className="ins-muted">{isHealthFull(a.health) ? copy.healthPanel.notEnoughTitle : copy.healthPanel.restricted}</p>}
                  </div>
                </div>
              ) : null}
              {tab === "condition" ? (
                <>
                  <section className="ins-panel"><h3 className="ins-h">{copy.conditionPanel.chartTitle}</h3><ConditionChart asset={a} copy={copy} locale={locale} /></section>
                  <section className="ins-panel"><h3 className="ins-h">{copy.conditionPanel.openIssues}</h3>
                    {a.openIssues.length ? <ul>{a.openIssues.map((i) => <li key={i.key}>{i.title} <Chip tone={i.severity === "CRITICAL" ? "critical" : i.severity === "MAJOR" ? "pending" : "neutral"}>{copy.conditionPanel.severity[i.severity]}</Chip></li>)}</ul> : <p className="ins-muted">{copy.conditionPanel.noOpenIssues}</p>}
                  </section>
                  <section className="ins-panel"><h3 className="ins-h">{copy.conditionPanel.assessments}</h3><AssessmentList items={a.assessments} copy={copy} locale={locale} />{a.assessments.length === 0 && a.condition.basis === "LEGACY" ? <p className="ins-muted">{copy.conditionPanel.legacyNote}</p> : null}</section>
                </>
              ) : null}
              {tab === "maintenance" ? (
                <section className="ins-panel">
                  <h3 className="ins-h">{copy.maintPanel.title}</h3>
                  {a.repeatFailures.flagged ? <div className="ast-flag" data-sev="MEDIUM">{fill(copy.maintPanel.repeat, { n: a.repeatFailures.count })}</div> : null}
                  <Kv rows={[[copy.maintPanel.estimated, money(a.costs.estimatedMinor, locale)], [copy.maintPanel.actual, money(a.costs.actualMinor, locale)]]} />
                  {a.maintenance.length === 0 ? <p className="ins-muted">{copy.maintPanel.none}</p> : (
                    <div className="ins-cards">{a.maintenance.map((m) => (
                      <div key={m.id} className="ins-card" data-overdue={m.overdue}>
                        <div className="ins-card-top"><div><Link className="ins-link" href={`/maintenance?open=${m.id}`}>{m.maintenanceNo ?? "—"}</Link> <strong>{m.title}</strong><br /><span className="ins-muted">{copy.mtype[m.maintenanceType]} · {fmtDate(m.completedDate ?? m.scheduledDate, locale)}</span></div><MaintStatusChip status={m.status} overdue={m.overdue} copy={copy} /></div>
                        <PriorityChip priority={m.priority} copy={copy} />
                      </div>
                    ))}</div>
                  )}
                  {a.can.requestMaintenance && !dead ? <button type="button" className="ctr-btn ast-noprint" onClick={() => setDialog("maintenance")}>{copy.maintPanel.request}</button> : null}
                </section>
              ) : null}
              {tab === "health" ? <HealthPanel asset={a} copy={copy} /> : null}
              {tab === "lifecycle" ? <TimelineTab id={a.id} copy={copy} locale={locale} /> : null}
              {tab === "construction" ? <ConstructionTab asset={a} copy={copy} locale={locale} /> : null}
              {tab === "activity" ? <TimelineTab id={a.id} copy={copy} locale={locale} only="status" /> : null}
            </div>

            <section className="ast-print-only" aria-hidden="true">
              <h2>{copy.passport.print.title}: {a.assetNo} · {a.name}</h2>
              <p>{fill(ps.print.generated, { date: fmtDate(new Date().toISOString(), locale) })}</p>
              <h3>{ps.print.details}</h3><p>{copy.condition[a.condition.value]} · {copy.basis[a.condition.basis]} · {copy.opStatus[a.operationalStatus]} · {a.owner.name}</p>
              <h3>{ps.print.conditionHistory}</h3><ul>{a.assessments.map((x) => <li key={x.id}>{fmtDate(x.assessedAt, locale)}: {copy.condition[x.condition]} ({copy.basisShort[x.basis]})</li>)}</ul>
              <h3>{ps.print.lastMaintenance}</h3><p>{a.maintenance.find((m) => m.status === "COMPLETED")?.title ?? "—"}</p>
              <h3>{ps.print.healthBreakdown}</h3>
              {isHealthFull(a.health) && a.health.score !== null ? <ul><li>{copy.healthPanel.score}: {a.health.score} ({a.health.band ? copy.band[a.health.band] : ""})</li>{a.health.components.map((c) => <li key={c.key}>{copy.healthPanel.components[c.key]}: {c.score ?? "—"}</li>)}</ul> : <p>{copy.healthPanel.notEnoughTitle}</p>}
              <p>{ps.print.note}</p>
            </section>

            <AssessmentDialog open={dialog === "assessment"} onOpenChange={close} copy={copy} locale={locale} asset={a} />
            <RequestMaintenanceDialog open={dialog === "maintenance"} onOpenChange={close} copy={copy} locale={locale} asset={{ id: a.id, assetNo: a.assetNo, name: a.name }} canPlan={canPlan} openIssues={a.openIssues} />
            <StatusDialog open={dialog === "status"} onOpenChange={close} copy={copy} locale={locale} asset={a} />
            <EditDialog open={dialog === "edit"} onOpenChange={close} copy={copy} locale={locale} asset={a} />
            {a.construction.project ? <ScheduleDialog open={dialog === "verified"} onOpenChange={close} copy={inspectionCopy} locale={locale} initial={{ projectId: a.construction.project.id, type: "ASSET_CONDITION", assetId: a.id }} /> : null}
          </>
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}

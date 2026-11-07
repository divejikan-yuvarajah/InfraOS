"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { InfoIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { fetchInsights } from "@/lib/assets/api";
import { getAssetCopy, type Copy } from "@/lib/assets/messages";
import { useAssetKeys } from "@/lib/assets/session";
import type { Benchmark, InsightsMeta, ScoreCard } from "@/lib/assets/types";
import { fill } from "@/lib/assets/view";
import { useUrlParams } from "@/lib/finance/url-state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { Chip, EmptyState, ErrorState, Field, Shell, Skeletons } from "./asset-ui";

const RANGES = ["7d", "30d", "90d", "12m", "custom"] as const;
const GRADE_TONE: Record<string, "success" | "active" | "pending" | "critical"> = { excellent: "success", good: "success", needs_attention: "pending", at_risk: "critical" };
const num = (v: number | null, suffix = ""): string => (v === null ? "—" : `${v}${suffix}`);

function Score({ card, own, copy, onOpen }: { card: ScoreCard; own: boolean; copy: Copy; onOpen: () => void }) {
  const c = copy.insights.card;
  const enough = card.availability === "OK";
  return (
    <article className="ast-score" data-own={own}>
      <div className="ctr-row" style={{ justifyContent: "space-between" }}>
        <strong>{card.agencyName ?? copy.insights.own}</strong>
        {own ? <Chip tone="active">{copy.insights.own}</Chip> : null}
      </div>
      {enough ? (
        <>
          <div className="ctr-row"><span className="ctr-card-value">{num(card.healthScore)}</span><span className="ins-muted">{c.score}</span>{card.grade ? <Chip tone={GRADE_TONE[card.grade] ?? "neutral"}>{(copy.insights.grade as Record<string, string>)[card.grade] ?? card.grade}</Chip> : null}</div>
          <dl className="ast-kv" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div><dt>{c.cases}</dt><dd>{card.cases}</dd></div><div><dt>{c.open}</dt><dd>{card.open}</dd></div>
            <div><dt>{c.overdueAcks}</dt><dd>{card.overdueAcks}</dd></div><div><dt>{c.overdueResponses}</dt><dd>{card.overdueResponses}</dd></div>
            <div><dt>{c.agreementRate}</dt><dd>{num(card.agreementRate, "%")}</dd></div><div><dt>{c.commitments}</dt><dd>{num(card.commitmentCompletion, "%")}</dd></div>
          </dl>
        </>
      ) : <p className="ins-muted" role="status">{fill(c.notEnough, { n: card.cases, min: card.cases + card.casesNeeded })}</p>}
      <button type="button" className="ctr-btn" onClick={onOpen}>{c.details}</button>
    </article>
  );
}

function Mapping({ meta, copy }: { meta: InsightsMeta; copy: Copy }) {
  const ind = copy.insights.indicators as Record<string, string>;
  return (
    <section className="ins-panel" aria-label={copy.insights.mappingTitle}>
      <h2 className="ins-h">{copy.insights.mappingTitle}</h2>
      <p className="ins-muted">{copy.insights.mappingBody}</p>
      <div style={{ overflowX: "auto" }}>
        <table className="ins-table">
          <thead><tr><th scope="col">{copy.common.type}</th><th scope="col">{copy.insights.source}</th></tr></thead>
          <tbody>{meta.mapping.map((m) => <tr key={m.key}><td>{ind[m.key] ?? m.key}</td><td>{m.source ?? <em>{copy.insights.notAvailable}</em>}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function BenchmarkPanel({ benchmark, unavailable, meta, copy }: { benchmark: Benchmark; unavailable: string | null; meta: InsightsMeta; copy: Copy }) {
  const b = copy.insights.benchmark;
  const bySource = Object.fromEntries(meta.mapping.filter((m) => m.source).map((m) => [m.source!, m.key]));
  const ind = copy.insights.indicators as Record<string, string>;
  return (
    <section className="ins-panel" aria-label={b.title}>
      <h2 className="ins-h">{b.title}</h2>
      {benchmark ? (
        <>
          <p className="ins-muted">{fill(b.cohort, { n: benchmark.cohort })}</p>
          <dl className="ast-kv">{Object.entries(benchmark.medians).map(([k, v]) => <div key={k}><dt>{ind[bySource[k] ?? k] ?? k}</dt><dd>{v ?? "—"}</dd></div>)}</dl>
        </>
      ) : <p className="ins-muted" role="status">{unavailable ? fill(b.unavailable, { n: meta.minCohort }) : b.unavailable}</p>}
    </section>
  );
}

export function InsightsPage() {
  const [locale] = useWorkspaceLocale();
  const copy = getAssetCopy(locale);
  const { key } = useAssetKeys();
  const url = useUrlParams();
  const rangeRaw = url.get("range");
  const range = (RANGES as readonly string[]).includes(rangeRaw) ? rangeRaw : "30d";
  const from = url.get("from");
  const to = url.get("to");
  const sort = url.get("sort") === "health" ? "health" : "name";
  const [drawer, setDrawer] = useState<ScoreCard | null>(null);
  const customReady = range !== "custom" || Boolean(from && to && from <= to);
  const q = useQuery({
    queryKey: key("insights", range, from, to, sort), enabled: customReady, placeholderData: keepPreviousData,
    queryFn: ({ signal }) => fetchInsights({ range, ...(range === "custom" ? { from, to } : {}), sort }, signal),
  });
  const i = copy.insights;
  const d = q.data;
  const meta = d?.meta;
  const cards = d ? (d.level === "national" ? d.items : [d.own]) : [];
  const dividerAt = d && d.level === "national" ? d.divider : null;

  return (
    <StaffWorkspaceShell title={i.title} description={i.description} wide
      context={<ContextBar crumbs={[{ label: copy.nav.insights }]} scope={copy.dashboard.scope} asOf={null} actions={<button type="button" className="ctr-btn" onClick={() => void q.refetch()}><RefreshCwIcon aria-hidden="true" />{copy.common.refresh}</button>} />}>
      <div className="ins ast">
        <p className="ast-flag" data-sev="INFO" role="note"><InfoIcon aria-hidden="true" /><span>{i.banner}</span></p>
        <div className="ins-bar">
          <div className="ctr-seg" role="group" aria-label={i.title}>{RANGES.map((r) => <button key={r} type="button" aria-pressed={range === r} onClick={() => url.set({ range: r === "30d" ? null : r, ...(r === "custom" ? {} : { from: null, to: null }) })}>{i.range[r]}</button>)}</div>
          {d?.level === "national" ? <Field label={i.sort}>{(id) => <select id={id} className="ctr-input" value={sort} onChange={(e) => url.set({ sort: e.target.value === "name" ? null : e.target.value })}><option value="name">{i.sortName}</option><option value="health">{i.sortHealth}</option></select>}</Field> : null}
        </div>
        {range === "custom" ? (
          <div className="ctr-row">
            <Field label={i.from}>{(id) => <input id={id} type="date" className="ctr-input" value={from} onChange={(e) => url.set({ from: e.target.value || null })} />}</Field>
            <Field label={i.to}>{(id) => <input id={id} type="date" className="ctr-input" value={to} min={from} onChange={(e) => url.set({ to: e.target.value || null })} />}</Field>
          </div>
        ) : null}

        {!customReady ? <EmptyState title={copy.common.required} body={`${i.from} / ${i.to}`} /> : q.isPending ? <Skeletons n={3} /> : q.isError ? <ErrorState error={q.error} copy={copy} onRetry={() => void q.refetch()} /> : !d || cards.length === 0 ? <EmptyState title={i.empty} /> : (
          <>
            {d.level === "agency" ? <h2 className="ins-h">{i.ownTitle}</h2> : null}
            <div className="ast-three" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(17rem, 1fr))" }}>
              {cards.map((card, idx) => (
                <div key={card.agencyId} style={{ display: "contents" }}>
                  {dividerAt !== null && idx === dividerAt ? <div className="ast-divider" style={{ gridColumn: "1 / -1" }} role="separator">{i.divider}</div> : null}
                  <Score card={card} own={d.level === "agency"} copy={copy} onOpen={() => setDrawer(card)} />
                </div>
              ))}
            </div>
            <BenchmarkPanel benchmark={d.benchmark} unavailable={d.benchmarkUnavailable} meta={d.meta} copy={copy} />
          </>
        )}
        {meta ? <Mapping meta={meta} copy={copy} /> : null}
        <p className="ins-muted">{copy.common.syntheticNote}</p>
      </div>

      <Shell open={drawer !== null} onOpenChange={(o) => { if (!o) setDrawer(null); }} title={fill(i.drawerTitle, { agency: drawer?.agencyName ?? i.own })} wide>
        {drawer && meta ? (
          <div className="ctr-dialog">
            <h3 className="ins-h">{i.howCalculated}</h3>
            <p className="ins-muted">{fill(i.definitionBody, { min: meta.minCases, cohort: meta.minCohort })}</p>
            <p className="ins-muted">{fill(i.componentsNote, { ack: meta.weights.ackTimeliness ?? "—", resp: meta.weights.responseTimeliness ?? "—", res: meta.weights.resolutionProgress ?? "—", back: meta.weights.backlogHealth ?? "—", commit: meta.weights.commitmentCompletion ?? "—" })}</p>
            {drawer.availability === "OK" ? (
              <dl className="ast-kv">
                <div><dt>{i.indicators.healthScore}</dt><dd>{num(drawer.healthScore)}</dd></div><div><dt>{i.indicators.caseload}</dt><dd>{drawer.cases}</dd></div>
                <div><dt>{i.indicators.openConflicts}</dt><dd>{drawer.open}</dd></div><div><dt>{i.indicators.resolvedConflicts}</dt><dd>{drawer.resolved}</dd></div>
                <div><dt>{i.indicators.medianAcknowledgementHours}</dt><dd>{drawer.medianAckHours === null ? "—" : fill(i.card.hours, { n: drawer.medianAckHours })}</dd></div>
                <div><dt>{i.indicators.medianResponseHours}</dt><dd>{drawer.medianResponseHours === null ? "—" : fill(i.card.hours, { n: drawer.medianResponseHours })}</dd></div>
                <div><dt>{i.indicators.negotiationRounds}</dt><dd>{num(drawer.avgRounds)}</dd></div><div><dt>{i.indicators.agreementRate}</dt><dd>{num(drawer.agreementRate, "%")}</dd></div>
              </dl>
            ) : <p className="ins-muted">{fill(i.card.notEnough, { n: drawer.cases, min: meta.minCases })}</p>}
            <div className="ctr-row">
              <Link className="ctr-btn" href="/roadsync/conflicts">{i.links.conflicts}</Link><Link className="ctr-btn" href="/roadsync/coordination">{i.links.coordination}</Link>
              <Link className="ctr-btn" href="/roadsync/approvals">{i.links.approvals}</Link><Link className="ctr-btn" href="/roadsync/history">{i.links.history}</Link>
            </div>
          </div>
        ) : null}
      </Shell>
    </StaffWorkspaceShell>
  );
}

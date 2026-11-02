"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { PrinterIcon } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fmt } from "@/lib/roadsync/assessment";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { customReady, dashQuery, filtersOf, formatKpi } from "@/lib/roadsync/dashboard";
import { fetchBrief } from "@/lib/roadsync/dashboard-api";
import { getDashCopy, signalText } from "@/lib/roadsync/dashboard-copy";
import "@/styles/mission-control-roadsync-dashboard.css";

import { useRoadsyncKeys, whenFmt } from "./resolution-tab";

/** Print-optimized briefing. Same scope and redaction as the dashboard; the Print button is explicit (no auto-print). */
export function DashboardBrief() {
  const [locale] = useWorkspaceLocale();
  const copy = getDashCopy(locale);
  const ac = getAssessmentCopy(locale);
  const keys = useRoadsyncKeys();
  const params = useSearchParams();
  const f = useMemo(() => filtersOf(new URLSearchParams(params.toString())), [params]);
  const qs = dashQuery(f);
  const q = useQuery({ queryKey: keys.key("dash-brief", qs), queryFn: () => fetchBrief(qs), enabled: Boolean(keys.userId) && customReady(f), retry: false });
  const b = q.data;
  const status = q.error instanceof ApiError ? q.error.status : 0;
  const national = b?.scope.level === "national";
  return (
    <main className="dc-brief">
      <div className="dc-brief-bar no-print"><Link className="rs-btn" href={`/roadsync?${qs}`}>{copy.actions.back}</Link><button type="button" className="rs-btn is-primary" onClick={() => window.print()} disabled={!b}><PrinterIcon aria-hidden="true" />{copy.actions.print}</button></div>
      {q.isPending ? <p role="status">{copy.states.loading}</p> : q.isError || !b ? <p role="alert">{status === 403 ? copy.states.forbidden : copy.states.error}</p> : (
        <>
          <header className="dc-brief-cover"><h1>{copy.brief.title}</h1>
            <p>{copy.brief.scope}: <b>{copy.scope[b.scope.level]}</b> · {copy.brief.period}: <b>{b.range.start.slice(0, 10)} → {b.range.end.slice(0, 10)}</b> ({b.range.days} d)</p>
            <p>{fmt(copy.brief.generated, { when: whenFmt(locale, b.generatedAt) })}</p><p className="rs-help">{copy.demoNote}</p></header>
          <section><h2>{copy.brief.kpis}</h2>
            <table><thead><tr><th scope="col">{copy.brief.kpis}</th><th scope="col">{copy.brief.value}</th></tr></thead><tbody>{b.kpis.map((k) => <tr key={k.key}><th scope="row">{copy.kpi[k.key] ?? k.key}</th><td>{formatKpi(k, locale)}{k.denominator !== null ? ` (${k.numerator ?? 0}/${k.denominator})` : ""}</td></tr>)}
              <tr><th scope="row">{copy.health.title}</th><td>{b.health.score ?? "—"}{b.health.grade ? ` · ${copy.health.grade[b.health.grade]}` : ""}</td></tr></tbody></table></section>
          <section><h2>{copy.brief.signals}</h2>{b.signals.length === 0 ? <p>{copy.noSignals}</p> : <ul>{b.signals.map((s) => <li key={`${s.code}${s.params.agencyId ?? ""}`}><b>{copy.severity[s.severity]}</b> — {signalText(copy, s, national)}</li>)}</ul>}</section>
          <section><h2>{copy.brief.top}</h2>{b.topCritical.length === 0 ? <p>{copy.lists.none}</p> : <table><thead><tr><th scope="col">{copy.brief.conflict}</th><th scope="col">{copy.brief.band}</th><th scope="col">{copy.brief.dates}</th><th scope="col">{copy.brief.district}</th><th scope="col">{copy.brief.age}</th></tr></thead>
            <tbody>{b.topCritical.map((c) => <tr key={c.conflictNo}><th scope="row"><code>{c.conflictNo}</code></th><td>{ac.bands[c.band]}</td><td>{c.start ?? "—"} → {c.end ?? "—"}</td><td>{c.district ?? "—"}</td><td>{fmt(copy.lists.days, { n: c.ageDays })}</td></tr>)}</tbody></table>}</section>
          <section><h2>{copy.brief.scorecards}</h2>
            {Array.isArray(b.scorecards) ? <table><thead><tr><th scope="col">{copy.scorecards.agency}</th><th scope="col">{copy.scorecards.cases}</th><th scope="col">{copy.scorecards.open}</th><th scope="col">{copy.scorecards.agreementRate}</th><th scope="col">{copy.scorecards.healthScore}</th></tr></thead>
              <tbody>{b.scorecards.map((s) => <tr key={s.agencyId}><th scope="row">{s.agencyName ?? "—"}</th><td>{s.cases}</td><td>{s.open}</td><td>{s.agreementRate === null ? "—" : `${s.agreementRate}%`}</td><td>{s.healthScore ?? "—"}</td></tr>)}</tbody></table>
              : <p>{copy.scorecards.mine}: {copy.scorecards.healthScore} <b>{b.scorecards.own.healthScore ?? "—"}</b> · {copy.scorecards.cases} {b.scorecards.own.cases} · {b.scorecards.benchmark ? fmt(copy.scorecards.benchmarkCohort, { n: b.scorecards.benchmark.cohort }) : copy.scorecards.benchmarkUnavailable}</p>}</section>
          <section><h2>{copy.brief.definitions}</h2><dl>{b.kpis.map((k) => <div key={k.key}><dt>{copy.kpi[k.key] ?? k.key}</dt><dd>{copy.def[k.key]}</dd></div>)}<div><dt>{copy.health.title}</dt><dd>{copy.health.caption}</dd></div></dl></section>
          <footer className="rs-help">{copy.brief.freshness}</footer>
        </>
      )}
    </main>
  );
}

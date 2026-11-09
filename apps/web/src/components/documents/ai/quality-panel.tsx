"use client";

import { useQuery } from "@tanstack/react-query";

import type { AuthLocale } from "@/lib/auth/types";
import { fetchQuality } from "@/lib/documents/ai/rag-api";
import { getRagCopy } from "@/lib/documents/ai/rag-messages";
import { useDocKeys } from "@/lib/documents/session";
import { fill, fmtNumber } from "@/lib/documents/view";

/** ai.manage only. Real aggregates over the last 30 days: counts, rates and tokens. Never questions, answers or people. */
export function QualityPanel({ locale }: { locale: AuthLocale }) {
  const copy = getRagCopy(locale);
  const { key } = useDocKeys();
  const q = useQuery({ queryKey: key("ai-quality"), queryFn: ({ signal }) => fetchQuality({}, signal), retry: false, staleTime: 30_000 });
  if (q.isPending) return <section className="dt-panel" aria-busy="true"><h3 style={{ margin: 0 }}>{copy.quality.title}</h3><p className="ins-muted">{copy.common.loading}</p></section>;
  if (q.isError) return null;
  const d = q.data;
  const pct = (v: number | null) => (v === null ? copy.common.none : `${v}%`);
  const rows: [string, string][] = [
    [copy.quality.questions, fmtNumber(d.questions, locale)], [copy.quality.answered, pct(d.rates.answered ?? null)], [copy.quality.partial, pct(d.rates.partial ?? null)], [copy.quality.insufficient, pct(d.rates.insufficientEvidence ?? null)],
    [copy.quality.passages, pct(d.rates.passagesOnly ?? null)], [copy.quality.failed, pct(d.rates.failed ?? null)], [copy.quality.helpful, pct(d.feedback.helpfulRatio)], [copy.quality.citations, pct(d.citationVerificationRate)],
    [copy.quality.latency, d.averageLatencyMs === null ? copy.common.none : `${(d.averageLatencyMs / 1000).toFixed(1)} s`],
  ];
  return (
    <section className="dt-panel" aria-label={copy.quality.title} style={{ display: "grid", gap: "0.5rem" }}>
      <h3 style={{ margin: 0 }}>{copy.quality.title} <span className="ins-muted">· {fill(copy.quality.period, { n: 30 })}</span></h3>
      {d.questions === 0 ? <p className="ins-muted">{copy.quality.none}</p> : (
        <>
          <div className="ai-stats">{rows.map(([l, v]) => <div key={l} className="ai-stat"><span>{l}</span><b>{v}</b></div>)}</div>
          <div><strong>{copy.quality.tokens}</strong>
            <ul style={{ margin: "0.2rem 0 0", paddingInlineStart: "1.1rem" }}>{d.tokensByPurpose.map((t) => <li key={t.purpose} className="dt-tabnum">{(copy.quality.purpose as Record<string, string>)[t.purpose] ?? t.purpose}: {fmtNumber(t.inputTokens + t.outputTokens, locale)} ({t.requests})</li>)}</ul></div>
        </>
      )}
      <p className="ins-muted" style={{ margin: 0 }}>{copy.quality.note}</p>
    </section>
  );
}

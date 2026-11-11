"use client";

import { AI_FEATURE_KEYS, AI_MODEL_TIERS } from "@infraos/shared-types";
import { useQuery } from "@tanstack/react-query";
import { BarChart3Icon, ExternalLinkIcon, Table2Icon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { fetchAgencies } from "@/lib/admin-agencies/api";
import { fetchAgencyAiUsage } from "@/lib/ai-admin/api";
import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import type { AiFeatureKey } from "@/lib/ai-admin/types";
import { fillTemplate, formatCurrencyMinor, formatNumber } from "@/lib/ai-admin/view";
import type { AuthLocale } from "@/lib/auth/types";

import "@/styles/ai-copilot.css";
import "@/styles/contractors.css";

const FEATURE_COLORS: Record<AiFeatureKey, string> = {
  qa: "#2563eb",
  summary: "#0d9488",
  extraction: "#7c3aed",
  riskNarrative: "#d97706",
  vision: "#dc2626",
  copilot: "#059669",
  embedding: "#64748b",
};

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function UsageCharts({
  locale,
  roleKey,
}: {
  locale: AuthLocale;
  roleKey: string;
}) {
  const copy = getAiAdminCopy(locale);
  const [from, setFrom] = useState(() => isoDaysAgo(13));
  const [to, setTo] = useState(() => isoDaysAgo(0));
  const [feature, setFeature] = useState<string>("");
  const [agencyId, setAgencyId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  const agenciesQuery = useQuery({
    queryKey: ["admin", "agencies", "ai-usage"],
    queryFn: () => fetchAgencies({ page: 1 }),
    enabled: roleKey === "SUPER_ADMIN",
    staleTime: 60_000,
    retry: false,
  });

  const usageQuery = useQuery({
    queryKey: ["ai", "usage", "agency", from, to, feature, agencyId],
    queryFn: ({ signal }) =>
      fetchAgencyAiUsage(
        {
          from: from || undefined,
          to: to || undefined,
          feature: feature || undefined,
          agencyId: agencyId || undefined,
        },
        signal,
      ),
    retry: false,
  });

  const data = usageQuery.data ?? null;

  const maxDayTotal = useMemo(() => {
    if (!data?.dailyChart?.length) return 1;
    let max = 1;
    for (const row of data.dailyChart) {
      let sum = 0;
      for (const f of AI_FEATURE_KEYS) {
        sum += Number(row[f] ?? 0);
      }
      if (sum > max) max = sum;
    }
    return max;
  }, [data]);

  return (
    <div className="gov-grid">
      <section className="ctr-panel">
        <div className="ctr-row" style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.8rem" }}>
            <span>{copy.agencyUsage.from}</span>
            <input type="date" className="ctr-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.8rem" }}>
            <span>{copy.agencyUsage.to}</span>
            <input type="date" className="ctr-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.8rem" }}>
            <span>{copy.agencyUsage.feature}</span>
            <select className="ctr-input" value={feature} onChange={(e) => setFeature(e.target.value)}>
              <option value="">{copy.common.all}</option>
              {AI_FEATURE_KEYS.map((f) => (
                <option key={f} value={f}>{copy.features[f]}</option>
              ))}
            </select>
          </label>
          {roleKey === "SUPER_ADMIN" ? (
            <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.8rem" }}>
              <span>{copy.settings.scopeAgency}</span>
              <select className="ctr-input" value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
                <option value="">{copy.settings.scopePlatform}</option>
                {(agenciesQuery.data?.agencies ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </section>

      {usageQuery.isPending ? (
        <div className="ctr-panel" role="status">{copy.common.loading}</div>
      ) : null}
      {usageQuery.isError ? (
        <div className="ctr-panel" role="alert">
          <strong>{copy.common.errorTitle}</strong>
          <p className="ctr-small">{copy.common.errorBody}</p>
          <button type="button" className="ctr-btn" onClick={() => void usageQuery.refetch()}>
            {copy.common.retry}
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="gov-cards">
            <div className="gov-stat">
              <div className="gov-stat-label">{copy.agencyUsage.totalRequests}</div>
              <div className="gov-stat-value">{formatNumber(data.totals.requests, locale)}</div>
            </div>
            <div className="gov-stat">
              <div className="gov-stat-label">{copy.agencyUsage.totalTokens}</div>
              <div className="gov-stat-value">
                {formatNumber(data.totals.inputTokens + data.totals.outputTokens, locale)}
              </div>
            </div>
            <div className="gov-stat">
              <div className="gov-stat-label">{copy.agencyUsage.totalImages}</div>
              <div className="gov-stat-value">{formatNumber(data.totals.images, locale)}</div>
            </div>
            <div className="gov-stat">
              <div className="gov-stat-label">{copy.agencyUsage.errorRate}</div>
              <div className="gov-stat-value">{(data.totals.errorRate * 100).toFixed(1)}%</div>
            </div>
            <div className="gov-stat">
              <div className="gov-stat-label">{copy.agencyUsage.fallbackRate}</div>
              <div className="gov-stat-value">{(data.totals.fallbackRate * 100).toFixed(1)}%</div>
            </div>
            <div className="gov-stat">
              <div className="gov-stat-label">{copy.agencyUsage.estimatedCost}</div>
              <div className="gov-stat-value">
                {data.totals.pricesVerified && data.totals.estimatedCostMinor !== null
                  ? formatCurrencyMinor(data.totals.estimatedCostMinor, locale)
                  : copy.common.tokensOnly}
              </div>
              <div className="ctr-small" style={{ marginTop: "0.25rem" }}>
                {data.totals.pricesVerified
                  ? copy.agencyUsage.costVerifiedNote
                  : copy.agencyUsage.costUnverifiedNote}
              </div>
            </div>
          </div>

          <section className="ctr-panel" style={{ display: "grid", gap: "0.75rem" }}>
            <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>
                {copy.agencyUsage.dailyChartTitle}
              </h3>
              <div className="ctr-row" role="group" aria-label={copy.agencyUsage.dailyChartTitle} style={{ gap: "0.35rem" }}>
                <button
                  type="button"
                  className={viewMode === "chart" ? "ctr-btn is-primary" : "ctr-btn"}
                  onClick={() => setViewMode("chart")}
                  aria-pressed={viewMode === "chart"}
                >
                  <BarChart3Icon aria-hidden="true" />
                  <span>{copy.agencyUsage.chartModeChart}</span>
                </button>
                <button
                  type="button"
                  className={viewMode === "table" ? "ctr-btn is-primary" : "ctr-btn"}
                  onClick={() => setViewMode("table")}
                  aria-pressed={viewMode === "table"}
                >
                  <Table2Icon aria-hidden="true" />
                  <span>{copy.agencyUsage.chartModeTable}</span>
                </button>
              </div>
            </div>

            {data.dailyChart.length === 0 ? (
              <p className="ctr-small" style={{ margin: 0 }}>{copy.agencyUsage.noChartData}</p>
            ) : viewMode === "chart" ? (
              <div>
                <svg
                  className="gov-chart-svg"
                  viewBox={`0 0 ${Math.max(480, data.dailyChart.length * 46)} 210`}
                  role="img"
                  aria-label={copy.agencyUsage.dailyChartTitle}
                >
                  {data.dailyChart.map((row, idx) => {
                    const x = 18 + idx * 44;
                    const chartBottom = 175;
                    const chartHeight = 150;
                    const segments = AI_FEATURE_KEYS.reduce<Array<{ key: AiFeatureKey; val: number; y: number; h: number }>>(
                      (acc, fk) => {
                        const val = Number(row[fk] ?? 0);
                        if (val <= 0) return acc;
                        const prevTop = acc.length ? acc[acc.length - 1]!.y : chartBottom;
                        const h = Math.max(2, (val / maxDayTotal) * chartHeight);
                        acc.push({ key: fk, val, y: prevTop - h, h });
                        return acc;
                      },
                      [],
                    );
                    return (
                      <g key={row.day}>
                        {segments.map((seg) => (
                          <rect
                            key={seg.key}
                            x={x}
                            y={seg.y}
                            width={26}
                            height={seg.h}
                            rx={2}
                            fill={FEATURE_COLORS[seg.key]}
                          >
                            <title>{`${row.day} · ${copy.features[seg.key]}: ${seg.val}`}</title>
                          </rect>
                        ))}
                        <text
                          x={x + 13}
                          y={195}
                          textAnchor="middle"
                          fontSize="10"
                          fill="currentColor"
                        >
                          {row.day.slice(5)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="ctr-row" style={{ gap: "0.75rem", flexWrap: "wrap", marginTop: "0.4rem", fontSize: "0.78rem" }}>
                  {AI_FEATURE_KEYS.map((fk) => (
                    <span key={fk} className="ctr-row" style={{ gap: "0.3rem" }}>
                      <span
                        style={{
                          width: "0.65rem",
                          height: "0.65rem",
                          borderRadius: "2px",
                          background: FEATURE_COLORS[fk],
                          display: "inline-block",
                        }}
                        aria-hidden="true"
                      />
                      <span>{copy.features[fk]}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="ctr-table-wrap">
                <table className="ctr-table" style={{ width: "100%", fontSize: "0.84rem" }}>
                  <thead>
                    <tr>
                      <th scope="col">{copy.audit.timestamp}</th>
                      {AI_FEATURE_KEYS.map((fk) => (
                        <th key={fk} scope="col">{copy.features[fk]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.dailyChart.map((row) => (
                      <tr key={row.day}>
                        <td>{row.day}</td>
                        {AI_FEATURE_KEYS.map((fk) => (
                          <td key={fk}>{formatNumber(Number(row[fk] ?? 0), locale)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="ctr-panel" style={{ display: "grid", gap: "0.65rem" }}>
            <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>
                {copy.agencyUsage.budgetsTitle}
              </h3>
              <span className="ctr-small">
                {fillTemplate(copy.agencyUsage.softThresholdNote, {
                  pct: data.budgets.autoDowngradeAtBudgetPercent,
                })} · {copy.agencyUsage.hardCapLabel}
              </span>
            </div>
            <div className="gov-cards">
              {AI_MODEL_TIERS.map((tier) => (
                <div key={tier} className="gov-stat">
                  <div className="gov-stat-label">{copy.tiers[tier]}</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                    {formatNumber(data.budgets.dailyTokenBudget[tier] ?? 0, locale)} / day
                  </div>
                  <div className="ctr-small" style={{ marginTop: "0.2rem" }}>
                    {formatNumber(data.budgets.monthlyTokenBudget[tier] ?? 0, locale)} / mo
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="ctr-panel ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.6rem" }}>
            <span style={{ fontSize: "0.88rem" }}>{copy.agencyUsage.qualityLinkLabel}</span>
            <Link href="/documents/processing" className="ctr-btn">
              <span>{copy.agencyUsage.openProcessing}</span>
              <ExternalLinkIcon aria-hidden="true" />
            </Link>
          </section>

          <section className="ctr-panel" style={{ display: "grid", gap: "0.6rem" }}>
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{copy.agencyUsage.topUsersTitle}</h3>
            {data.topUsers.length === 0 ? (
              <p className="ctr-small" style={{ margin: 0 }}>{copy.agencyUsage.topUsersEmpty}</p>
            ) : (
              <div className="ctr-table-wrap">
                <table className="ctr-table" style={{ width: "100%", fontSize: "0.84rem" }}>
                  <thead>
                    <tr>
                      <th scope="col">{copy.agencyUsage.userCol}</th>
                      <th scope="col">{copy.agencyUsage.reqsCol}</th>
                      <th scope="col">{copy.agencyUsage.flagsCol}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topUsers.map((u) => (
                      <tr key={u.userPseudonymId}>
                        <td><code>{u.userPseudonymId}</code></td>
                        <td>{formatNumber(u.requests, locale)}</td>
                        <td>{formatNumber(u.flaggedPromptsCount, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

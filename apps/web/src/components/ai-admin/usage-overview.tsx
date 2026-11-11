"use client";

import { AI_FEATURE_KEYS, AI_MODEL_TIERS } from "@infraos/shared-types";

import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import type { AiLimitsMeDto, AiUsageMeDto } from "@/lib/ai-admin/types";
import { formatDateTime, formatNumber } from "@/lib/ai-admin/view";
import type { AuthLocale } from "@/lib/auth/types";

import { BudgetGauge } from "./budget-gauge";
import "@/styles/ai-copilot.css";
import "@/styles/contractors.css";

export function UsageOverview({
  limits,
  usage,
  locale,
}: {
  limits: AiLimitsMeDto;
  usage: AiUsageMeDto;
  locale: AuthLocale;
}) {
  const copy = getAiAdminCopy(locale);
  const todayTokens = usage.today.inputTokens + usage.today.outputTokens;
  const weekTokens = usage.week.inputTokens + usage.week.outputTokens;

  return (
    <div className="gov-grid">
      <div className="gov-cards">
        <div className="gov-stat">
          <div className="gov-stat-label">{copy.myUsage.todayRequests}</div>
          <div className="gov-stat-value">{formatNumber(usage.today.requests, locale)}</div>
        </div>
        <div className="gov-stat">
          <div className="gov-stat-label">{copy.myUsage.weekRequests}</div>
          <div className="gov-stat-value">{formatNumber(usage.week.requests, locale)}</div>
        </div>
        <div className="gov-stat">
          <div className="gov-stat-label">{copy.myUsage.todayTokens}</div>
          <div className="gov-stat-value">{formatNumber(todayTokens, locale)}</div>
        </div>
        <div className="gov-stat">
          <div className="gov-stat-label">{copy.myUsage.weekTokens}</div>
          <div className="gov-stat-value">{formatNumber(weekTokens, locale)}</div>
        </div>
      </div>

      <section className="ctr-panel" style={{ display: "grid", gap: "0.75rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{copy.myUsage.dailyBudget}</h3>
        <BudgetGauge
          label={copy.myUsage.dailyBudget}
          used={limits.dailyTokensUsed}
          limit={limits.dailyTokenBudget}
        />
        <BudgetGauge
          label={copy.myUsage.visionBudget}
          used={limits.dailyVisionImagesUsed}
          limit={limits.dailyVisionImagesLimit}
        />
        <div className="gov-cards">
          {AI_MODEL_TIERS.map((tier) => {
            const entry = limits.dailyByTier[tier];
            return entry ? (
              <div key={tier} className="gov-stat">
                <div className="gov-stat-label">{copy.tiers[tier]}</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                  {formatNumber(entry.used, locale)} / {formatNumber(entry.limit, locale)}
                </div>
              </div>
            ) : null;
          })}
        </div>
      </section>

      <section className="ctr-panel" style={{ display: "grid", gap: "0.65rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{copy.myUsage.quotasTitle}</h3>
        <div className="ctr-table-wrap">
          <table className="ctr-table" style={{ width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th scope="col">{copy.myUsage.featureCol}</th>
                <th scope="col">{copy.myUsage.statusCol}</th>
                <th scope="col">{copy.myUsage.windowCol}</th>
                <th scope="col">{copy.myUsage.agencyCol}</th>
                <th scope="col">{copy.myUsage.resetCol}</th>
              </tr>
            </thead>
            <tbody>
              {AI_FEATURE_KEYS.map((feat) => {
                const row = limits.features[feat];
                if (!row) return null;
                return (
                  <tr key={feat}>
                    <td>{copy.features[feat]}</td>
                    <td>
                      <span
                        className="ctr-badge"
                        data-tone={row.enabled ? "success" : "neutral"}
                      >
                        {row.enabled ? copy.myUsage.enabled : copy.myUsage.disabled}
                      </span>
                    </td>
                    <td>
                      {formatNumber(row.remaining10Min, locale)} / {formatNumber(row.limit10Min, locale)}
                    </td>
                    <td>
                      {formatNumber(row.agencyDailyUsed, locale)} / {formatNumber(row.agencyDailyLimit, locale)}
                    </td>
                    <td>{formatDateTime(row.resetAt, locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ctr-panel" style={{ display: "grid", gap: "0.65rem" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{copy.myUsage.recentTitle}</h3>
          <p className="ctr-small" style={{ margin: "0.2rem 0 0" }}>{copy.myUsage.noPromptNote}</p>
        </div>

        {usage.recentRequests.length === 0 ? (
          <p className="ctr-small" style={{ margin: 0 }}>{copy.myUsage.recentEmpty}</p>
        ) : (
          <div className="ctr-table-wrap">
            <table className="ctr-table" style={{ width: "100%", fontSize: "0.84rem" }}>
              <thead>
                <tr>
                  <th scope="col">{copy.myUsage.colTime}</th>
                  <th scope="col">{copy.myUsage.colFeature}</th>
                  <th scope="col">{copy.myUsage.colModel}</th>
                  <th scope="col">{copy.myUsage.colTokens}</th>
                  <th scope="col">{copy.myUsage.colLatency}</th>
                  <th scope="col">{copy.myUsage.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {usage.recentRequests.map((req) => (
                  <tr key={req.id}>
                    <td>{formatDateTime(req.createdAt, locale)}</td>
                    <td>
                      {copy.features[req.feature as keyof typeof copy.features] ?? req.feature}
                    </td>
                    <td><code>{req.model}</code></td>
                    <td>
                      {formatNumber(req.inputTokens, locale)} / {formatNumber(req.outputTokens, locale)}
                    </td>
                    <td>{req.latencyMs} ms</td>
                    <td>
                      <span
                        className="ctr-badge"
                        data-tone={req.status === "OK" ? "success" : "critical"}
                      >
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}


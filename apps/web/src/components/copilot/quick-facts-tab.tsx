"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRightIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";

import { formatCurrencyMinor, formatDateTime, formatNumber } from "@/lib/ai-admin/view";
import type { AuthLocale } from "@/lib/auth/types";
import { fetchQuickFacts } from "@/lib/copilot/api";
import type { CopilotMessages } from "@/lib/copilot/messages";
import type { CopilotPageContext } from "@/lib/copilot/types";
import { isSafeInternalLink } from "@/lib/copilot/view";

import { LimitBanner } from "./limit-banner";
import { QuickFactCard } from "./quick-fact-card";

export function QuickFactsTab({
  epoch,
  userId,
  pageContext,
  includeContext,
  aiDownOrDisabled,
  copy,
  locale,
  onNavigate,
}: {
  epoch: number;
  userId: string;
  pageContext: CopilotPageContext;
  includeContext: boolean;
  aiDownOrDisabled: boolean;
  copy: CopilotMessages;
  locale: AuthLocale;
  onNavigate?: () => void;
}) {
  const projectId = includeContext ? pageContext.projectIdHint : undefined;

  const query = useQuery({
    queryKey: ["copilot", "quick-facts", epoch, userId, projectId ?? "portfolio"],
    queryFn: ({ signal }) => fetchQuickFacts(projectId, signal),
    staleTime: 30_000,
  });

  const data = query.data;

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <header className="ctr-bar">
        <div>
          <strong style={{ fontSize: "0.9rem" }}>{copy.quickFacts.title}</strong>
          <p className="ctr-small">{copy.quickFacts.subtitle}</p>
        </div>
        <button
          type="button"
          className="ctr-btn"
          style={{ minHeight: "2rem", padding: "0.2rem 0.6rem" }}
          onClick={() => void query.refetch()}
        >
          <RefreshCwIcon aria-hidden="true" />
          <span>{copy.quickFacts.retry}</span>
        </button>
      </header>

      {aiDownOrDisabled ? (
        <LimitBanner
          kind="degraded"
          locale={locale}
          messageOverride={copy.quickFacts.aiDownNotice}
        />
      ) : null}

      {query.isPending ? (
        <div role="status" aria-busy="true" style={{ display: "grid", gap: "0.5rem" }}>
          <div className="ctr-skel" style={{ height: "4.5rem" }} />
          <div className="ctr-skel" style={{ height: "4.5rem" }} />
        </div>
      ) : query.isError || !data ? (
        <div className="ai-note" role="status">
          <span>{copy.quickFacts.error}</span>
          <button type="button" className="ctr-btn" onClick={() => void query.refetch()}>
            {copy.quickFacts.retry}
          </button>
        </div>
      ) : (
        <div className="cop-qf-grid">
          {data.status ? (
            <QuickFactCard
              title={copy.quickFacts.statusLabel}
              badge={
                <span className="ctr-badge" data-tone="neutral">
                  {copy.quickFacts.asOf.replace("{date}", formatDateTime(data.asOf, locale))}
                </span>
              }
            >
              <strong style={{ fontSize: "0.92rem" }}>{data.status}</strong>
            </QuickFactCard>
          ) : null}

          {data.progressReported !== undefined || data.progressVerified !== undefined ? (
            <QuickFactCard
              title={copy.quickFacts.progressTitle}
              badge={
                data.progressBasis ? (
                  <span
                    className="ctr-badge"
                    data-tone={data.progressBasis === "VERIFIED" ? "success" : "neutral"}
                  >
                    <ShieldCheckIcon aria-hidden="true" />
                    {data.progressBasis}
                  </span>
                ) : null
              }
            >
              <div className="ctr-row" style={{ justifyContent: "space-between", fontSize: "0.84rem" }}>
                <span>
                  {copy.quickFacts.reportedLabel}:{" "}
                  <strong className="ctr-num">
                    {data.progressReported !== undefined ? `${data.progressReported}%` : "—"}
                  </strong>
                </span>
                <span>
                  {copy.quickFacts.verifiedLabel}:{" "}
                  <strong className="ctr-num">
                    {data.progressVerified !== undefined ? `${data.progressVerified}%` : copy.quickFacts.notVerified}
                  </strong>
                </span>
              </div>
            </QuickFactCard>
          ) : null}

          {data.financialPercent !== undefined || data.financialBudgetMinor !== undefined ? (
            <QuickFactCard title={copy.quickFacts.financeTitle}>
              <div style={{ display: "grid", gap: "0.25rem", fontSize: "0.84rem" }}>
                <div className="ctr-row" style={{ justifyContent: "space-between" }}>
                  <span className="ctr-num">
                    {copy.quickFacts.financialPct.replace("{n}", String(data.financialPercent ?? 0))}
                  </span>
                  <span className="ctr-num">
                    {copy.quickFacts.physicalPct.replace("{n}", String(data.physicalPercent ?? 0))}
                  </span>
                </div>
                <span className="ctr-small">
                  {data.financialBudgetMinor !== undefined
                    ? `${copy.quickFacts.budgetLabel}: ${formatCurrencyMinor(data.financialBudgetMinor, locale)}`
                    : copy.quickFacts.budgetHidden}
                </span>
              </div>
            </QuickFactCard>
          ) : null}

          {data.riskLevel || (data.riskIndicators && data.riskIndicators.length > 0) ? (
            <QuickFactCard
              title={copy.quickFacts.riskTitle}
              badge={
                data.riskLevel ? (
                  <span
                    className="ctr-badge"
                    data-tone={
                      data.riskLevel === "CRITICAL" || data.riskLevel === "HIGH"
                        ? "critical"
                        : data.riskLevel === "MEDIUM"
                          ? "pending"
                          : "success"
                    }
                  >
                    {data.riskLevel}
                  </span>
                ) : null
              }
            >
              {data.riskIndicators && data.riskIndicators.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.82rem", display: "grid", gap: "0.2rem" }}>
                  {data.riskIndicators.map((ind) => (
                    <li key={ind.code}>
                      {ind.label} ({ind.level})
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="ctr-small">{copy.quickFacts.noRisk}</span>
              )}
            </QuickFactCard>
          ) : null}

          {data.overdueMilestonesCount !== undefined ||
          data.openConflictsCount !== undefined ||
          data.latestInspection ? (
            <QuickFactCard title={copy.quickFacts.operationsTitle}>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.82rem", display: "grid", gap: "0.2rem" }}>
                {data.overdueMilestonesCount !== undefined ? (
                  <li className="ctr-num">
                    {copy.quickFacts.overdueMilestones.replace(
                      "{n}",
                      formatNumber(data.overdueMilestonesCount, locale),
                    )}
                  </li>
                ) : null}
                {data.openConflictsCount !== undefined ? (
                  <li className="ctr-num">
                    {copy.quickFacts.openConflicts.replace("{n}", formatNumber(data.openConflictsCount, locale))}
                  </li>
                ) : null}
                {data.overdueMaintenanceCount !== undefined ? (
                  <li className="ctr-num">
                    {copy.quickFacts.overdueMaintenance.replace(
                      "{n}",
                      formatNumber(data.overdueMaintenanceCount, locale),
                    )}
                  </li>
                ) : null}
                {data.latestInspection ? (
                  <li>
                    {copy.quickFacts.latestInspection}: {data.latestInspection.outcome ?? "—"}
                    {data.latestInspection.date ? ` (${data.latestInspection.date})` : ""}
                  </li>
                ) : null}
              </ul>
            </QuickFactCard>
          ) : null}

          {data.links.filter((l) => isSafeInternalLink(l.route)).length > 0 ? (
            <QuickFactCard title={copy.quickFacts.linksTitle}>
              <nav className="cop-nav-row" aria-label={copy.quickFacts.linksTitle}>
                {data.links
                  .filter((l) => isSafeInternalLink(l.route))
                  .map((l) => (
                    <Link
                      key={l.route}
                      href={l.route}
                      className="cop-nav-link"
                      onClick={() => onNavigate?.()}
                    >
                      <span>{l.label}</span>
                      <ArrowUpRightIcon aria-hidden="true" style={{ width: "0.8rem", height: "0.8rem" }} />
                    </Link>
                  ))}
              </nav>
            </QuickFactCard>
          ) : null}
        </div>
      )}
    </div>
  );
}

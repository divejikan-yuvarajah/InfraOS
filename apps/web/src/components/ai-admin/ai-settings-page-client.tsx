"use client";

import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { fetchMyAiLimits, fetchMyAiUsage } from "@/lib/ai-admin/api";
import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import { canManageAi, hasAnyAiAccess } from "@/lib/ai-admin/view";
import { getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { useUrlParams } from "@/lib/finance/url-state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { AboutAi } from "./about-ai";
import { AuditTable } from "./audit-table";
import { SettingsForm } from "./settings-form";
import { UsageCharts } from "./usage-charts";
import { UsageOverview } from "./usage-overview";
import "@/styles/ai-copilot.css";
import "@/styles/contractors.css";

type AiTab = "my" | "agency" | "settings" | "audit" | "about";

function useRoleKey(): string {
  return useSyncExternalStore(subscribeAuth, () => getMemorySession()?.user.roleKey ?? "", () => "");
}

function MyUsageSection({ locale }: { locale: ReturnType<typeof useWorkspaceLocale>[0] }) {
  const copy = getAiAdminCopy(locale);

  const limitsQuery = useQuery({
    queryKey: ["ai", "limits", "me"],
    queryFn: ({ signal }) => fetchMyAiLimits(signal),
    retry: false,
  });

  const usageQuery = useQuery({
    queryKey: ["ai", "usage", "me"],
    queryFn: ({ signal }) => fetchMyAiUsage(signal),
    retry: false,
  });

  if (limitsQuery.isPending || usageQuery.isPending) {
    return <div className="ctr-panel" role="status">{copy.common.loading}</div>;
  }

  if (limitsQuery.isError || usageQuery.isError || !limitsQuery.data || !usageQuery.data) {
    return (
      <div className="ctr-panel" role="alert">
        <strong>{copy.common.errorTitle}</strong>
        <p className="ctr-small">{copy.common.errorBody}</p>
        <button
          type="button"
          className="ctr-btn"
          onClick={() => {
            void limitsQuery.refetch();
            void usageQuery.refetch();
          }}
        >
          {copy.common.retry}
        </button>
      </div>
    );
  }

  return <UsageOverview limits={limitsQuery.data} usage={usageQuery.data} locale={locale} />;
}

export function AiSettingsPageClient() {
  const [locale] = useWorkspaceLocale();
  const copy = getAiAdminCopy(locale);
  const roleKey = useRoleKey();
  const url = useUrlParams();

  const canAccess = hasAnyAiAccess(roleKey);
  const isManager = canManageAi(roleKey);

  const allowedTabs: AiTab[] = isManager
    ? ["my", "agency", "settings", "audit", "about"]
    : canAccess
      ? ["my", "about"]
      : ["about"];

  const requested = (url.get("tab") || "my") as AiTab;
  const activeTab: AiTab = allowedTabs.includes(requested) ? requested : allowedTabs[0]!;

  return (
    <StaffWorkspaceShell title={copy.title} subtitle={copy.subtitle} wide>
      <div className="gov-grid">
        <div className="cop-tabs" role="tablist" aria-label={copy.title}>
          {allowedTabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              className="cop-tab"
              aria-selected={activeTab === t}
              onClick={() => url.set({ tab: t })}
            >
              {copy.tabs[t]}
            </button>
          ))}
        </div>

        {requested !== activeTab && (requested === "agency" || requested === "settings" || requested === "audit") && !isManager ? (
          <div className="ctr-panel" role="status">
            {copy.common.forbidden}
          </div>
        ) : null}

        {activeTab === "my" && canAccess ? <MyUsageSection locale={locale} /> : null}
        {activeTab === "agency" && isManager ? <UsageCharts locale={locale} roleKey={roleKey} /> : null}
        {activeTab === "settings" && isManager ? <SettingsForm locale={locale} roleKey={roleKey} /> : null}
        {activeTab === "audit" && isManager ? <AuditTable locale={locale} roleKey={roleKey} /> : null}
        {activeTab === "about" ? <AboutAi locale={locale} /> : null}
      </div>
    </StaffWorkspaceShell>
  );
}


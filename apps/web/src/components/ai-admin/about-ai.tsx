"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheckIcon, ShieldOffIcon } from "lucide-react";

import { fetchAboutAi } from "@/lib/ai-admin/api";
import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import type { AiFeatureKey } from "@/lib/ai-admin/types";
import { fillTemplate, formatDateTime } from "@/lib/ai-admin/view";
import type { AuthLocale } from "@/lib/auth/types";

import "@/styles/ai-copilot.css";
import "@/styles/contractors.css";

export function AboutAi({ locale }: { locale: AuthLocale }) {
  const copy = getAiAdminCopy(locale);

  const query = useQuery({
    queryKey: ["ai", "about"],
    queryFn: ({ signal }) => fetchAboutAi(signal),
    staleTime: 60_000,
    retry: false,
  });

  if (query.isPending) {
    return <div className="ctr-panel" role="status">{copy.common.loading}</div>;
  }

  if (query.isError || !query.data) {
    return (
      <div className="ctr-panel" role="alert">
        <strong>{copy.common.errorTitle}</strong>
        <p className="ctr-small">{copy.common.errorBody}</p>
        <button type="button" className="ctr-btn" onClick={() => void query.refetch()}>
          {copy.common.retry}
        </button>
      </div>
    );
  }

  const data = query.data;
  const featureEntries = Object.entries(data.features) as Array<
    [AiFeatureKey, NonNullable<(typeof data.features)[keyof typeof data.features]>]
  >;

  return (
    <div className="gov-grid">
      <section className="ctr-panel" style={{ display: "grid", gap: "0.55rem" }}>
        <h3 className="ctr-row" style={{ margin: 0, gap: "0.45rem", fontSize: "1rem", fontWeight: 600 }}>
          <ShieldCheckIcon aria-hidden="true" style={{ width: "1.05rem", height: "1.05rem" }} />
          <span>{copy.about.providerTitle}</span>
        </h3>
        <dl style={{ margin: 0, display: "grid", gap: "0.4rem", fontSize: "0.88rem" }}>
          <div>
            <dt style={{ fontWeight: 600 }}>{copy.about.providerName}</dt>
            <dd style={{ margin: 0 }}>{data.provider.name}</dd>
          </div>
          <div>
            <dt style={{ fontWeight: 600 }}>{copy.about.dataPolicy}</dt>
            <dd style={{ margin: 0 }}>{data.provider.dataHandlingPolicy}</dd>
          </div>
          <div>
            <dt style={{ fontWeight: 600 }}>{copy.about.architecture}</dt>
            <dd style={{ margin: 0 }}>{data.provider.serviceArchitecture}</dd>
          </div>
        </dl>
        <p className="ctr-small" style={{ margin: "0.25rem 0 0" }}>
          {data.lastSettingsUpdatedAt
            ? fillTemplate(copy.about.lastUpdated, {
                date: formatDateTime(data.lastSettingsUpdatedAt, locale),
              })
            : copy.about.neverUpdated}
        </p>
      </section>

      <section className="ctr-panel" style={{ display: "grid", gap: "0.6rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{copy.about.retentionTitle}</h3>
        <div className="gov-cards">
          <div className="gov-stat">
            <div className="gov-stat-label">{copy.about.qaRetention}</div>
            <div className="gov-stat-value">
              {fillTemplate(copy.about.daysValue, { n: data.retention.qaHistoryDays })}
            </div>
          </div>
          <div className="gov-stat">
            <div className="gov-stat-label">{copy.about.copilotRetention}</div>
            <div className="gov-stat-value">
              {fillTemplate(copy.about.daysValue, { n: data.retention.copilotHistoryDays })}
            </div>
          </div>
          <div className="gov-stat">
            <div className="gov-stat-label">{copy.about.auditRetention}</div>
            <div className="gov-stat-value">
              {fillTemplate(copy.about.daysValue, { n: data.retention.usageAuditDays })}
            </div>
          </div>
        </div>
      </section>

      <section className="ctr-panel" style={{ display: "grid", gap: "0.75rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{copy.about.featuresTitle}</h3>
        <div className="gov-cards">
          {featureEntries.map(([key, info]) => (
            <article key={key} className="gov-stat" style={{ display: "grid", gap: "0.4rem" }}>
              <div className="ctr-row" style={{ justifyContent: "space-between", gap: "0.5rem" }}>
                <strong style={{ fontSize: "0.9rem" }}>{copy.features[key] ?? key}</strong>
                <span className="ctr-badge" data-tone={info.enabled ? "success" : "neutral"}>
                  {info.enabled ? copy.myUsage.enabled : copy.myUsage.disabled}
                </span>
              </div>
              <div className="ctr-small">
                <strong>{copy.about.modelLabel}:</strong>{" "}
                <code>{info.model || copy.common.notConfigured}</code>
              </div>
              <div className="ctr-small">
                <strong>{copy.about.sendsLabel}:</strong>
                <ul style={{ margin: "0.2rem 0 0", paddingInlineStart: "1.1rem" }}>
                  {info.sends.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="ctr-small">
                <strong>{copy.about.humanRuleLabel}:</strong> {info.humanReviewRule}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="gov-cards">
        <section className="ctr-panel" style={{ display: "grid", gap: "0.45rem" }}>
          <h3 className="ctr-row" style={{ margin: 0, gap: "0.4rem", fontSize: "0.95rem", fontWeight: 600 }}>
            <ShieldOffIcon aria-hidden="true" style={{ width: "1rem", height: "1rem" }} />
            <span>{copy.about.neverSentTitle}</span>
          </h3>
          <ul style={{ margin: 0, paddingInlineStart: "1.2rem", display: "grid", gap: "0.25rem", fontSize: "0.86rem" }}>
            {data.neverSent.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="ctr-panel" style={{ display: "grid", gap: "0.45rem" }}>
          <h3 className="ctr-row" style={{ margin: 0, gap: "0.4rem", fontSize: "0.95rem", fontWeight: 600 }}>
            <ShieldCheckIcon aria-hidden="true" style={{ width: "1rem", height: "1rem" }} />
            <span>{copy.about.neverDoesTitle}</span>
          </h3>
          <ul style={{ margin: 0, paddingInlineStart: "1.2rem", display: "grid", gap: "0.25rem", fontSize: "0.86rem" }}>
            {data.neverDoes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}


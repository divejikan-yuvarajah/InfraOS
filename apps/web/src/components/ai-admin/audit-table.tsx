"use client";

import { AI_FEATURE_KEYS } from "@infraos/shared-types";
import { useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { downloadAiAuditCsv, fetchAiAudit } from "@/lib/ai-admin/api";
import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import type { AiAuditItemDto, AiAuditQuery, AiFeatureKey } from "@/lib/ai-admin/types";
import { canExportAuditCsv, formatDateTime, formatNumber } from "@/lib/ai-admin/view";
import { ApiError } from "@/lib/api/client";
import type { AuthLocale } from "@/lib/auth/types";

import "@/styles/ai-copilot.css";
import "@/styles/contractors.css";

function AuditResultsBody({
  filterKey,
  queryParams,
  locale,
}: {
  filterKey: string;
  queryParams: AiAuditQuery;
  locale: AuthLocale;
}) {
  const copy = getAiAdminCopy(locale);
  const [extraItems, setExtraItems] = useState<AiAuditItemDto[]>([]);
  const [nextCursorOverride, setNextCursorOverride] = useState<string | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);

  const query = useQuery({
    queryKey: ["ai", "audit", filterKey],
    queryFn: ({ signal }) => fetchAiAudit({ ...queryParams, limit: 50 }, signal),
    retry: false,
  });

  const allItems = [...(query.data?.items ?? []), ...extraItems];
  const nextCursor = nextCursorOverride !== undefined ? nextCursorOverride : (query.data?.nextCursor ?? null);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchAiAudit({
        ...queryParams,
        limit: 50,
        cursor: nextCursor,
      });
      setExtraItems((prev) => [...prev, ...page.items]);
      setNextCursorOverride(page.nextCursor);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.common.errorBody);
    } finally {
      setLoadingMore(false);
    }
  };

  if (query.isPending) {
    return <div className="ctr-panel" role="status">{copy.common.loading}</div>;
  }

  if (query.isError) {
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

  if (allItems.length === 0) {
    return (
      <div className="ctr-panel">
        <p className="ctr-small" style={{ margin: 0 }}>{copy.audit.empty}</p>
      </div>
    );
  }

  return (
    <section className="ctr-panel" style={{ display: "grid", gap: "0.65rem" }}>
      <div className="ctr-table-wrap">
        <table className="ctr-table" style={{ width: "100%", fontSize: "0.83rem" }}>
          <thead>
            <tr>
              <th scope="col">{copy.audit.timestamp}</th>
              <th scope="col">{copy.audit.feature}</th>
              <th scope="col">{copy.audit.user}</th>
              <th scope="col">{copy.audit.model}</th>
              <th scope="col">{copy.audit.tokens}</th>
              <th scope="col">{copy.audit.statusCol}</th>
              <th scope="col">{copy.audit.latency}</th>
              <th scope="col">{copy.audit.flags}</th>
              <th scope="col">{copy.audit.policy}</th>
            </tr>
          </thead>
          <tbody>
            {allItems.map((row) => (
              <tr key={row.id}>
                <td>{formatDateTime(row.timestamp, locale)}</td>
                <td>{copy.features[row.feature as AiFeatureKey] ?? row.feature}</td>
                <td><code>{row.userPseudonymId}</code></td>
                <td><code>{row.model}</code></td>
                <td>
                  {formatNumber(row.inputTokens, locale)} / {formatNumber(row.outputTokens, locale)}
                </td>
                <td>
                  <span
                    className="ctr-badge"
                    data-tone={row.status === "OK" ? "success" : "critical"}
                  >
                    {row.status}
                  </span>
                </td>
                <td>{row.latencyMs} ms</td>
                <td>{row.flags.length ? row.flags.join(", ") : copy.common.none}</td>
                <td>{row.providerPolicy ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor ? (
        <div>
          <button
            type="button"
            className="ctr-btn"
            disabled={loadingMore}
            onClick={() => void handleLoadMore()}
          >
            {copy.audit.loadMore}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function AuditTable({
  locale,
  roleKey,
}: {
  locale: AuthLocale;
  roleKey: string;
}) {
  const copy = getAiAdminCopy(locale);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [feature, setFeature] = useState<AiFeatureKey | "">("");
  const [status, setStatus] = useState<AiAuditQuery["status"]>("");
  const [exporting, setExporting] = useState(false);

  const queryParams: AiAuditQuery = {
    from: from || undefined,
    to: to || undefined,
    feature: feature || undefined,
    status: status || undefined,
  };
  const filterKey = `${from}|${to}|${feature}|${status ?? ""}`;

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadAiAuditCsv(queryParams);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error(copy.audit.exportDenied);
      } else {
        toast.error(err instanceof Error ? err.message : copy.common.errorBody);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="gov-grid">
      <section className="ctr-panel" style={{ display: "grid", gap: "0.75rem" }}>
        <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <p className="ctr-small" style={{ margin: 0 }}>{copy.audit.subtitle}</p>
          {canExportAuditCsv(roleKey) ? (
            <button
              type="button"
              className="ctr-btn"
              disabled={exporting}
              onClick={() => void handleExport()}
            >
              <DownloadIcon aria-hidden="true" />
              <span>{exporting ? copy.audit.exporting : copy.audit.exportCsv}</span>
            </button>
          ) : (
            <span className="ctr-small">{copy.audit.exportDenied}</span>
          )}
        </div>

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
            <span>{copy.audit.feature}</span>
            <select
              className="ctr-input"
              value={feature}
              onChange={(e) => setFeature(e.target.value as AiFeatureKey | "")}
            >
              <option value="">{copy.common.all}</option>
              {AI_FEATURE_KEYS.map((f) => (
                <option key={f} value={f}>{copy.features[f]}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.8rem" }}>
            <span>{copy.audit.status}</span>
            <select
              className="ctr-input"
              value={status ?? ""}
              onChange={(e) => setStatus(e.target.value as AiAuditQuery["status"])}
            >
              <option value="">{copy.common.all}</option>
              <option value="OK">OK</option>
              <option value="ERROR">ERROR</option>
              <option value="RATE_LIMITED">RATE_LIMITED</option>
            </select>
          </label>
        </div>
      </section>

      <AuditResultsBody key={filterKey} filterKey={filterKey} queryParams={queryParams} locale={locale} />
    </div>
  );
}

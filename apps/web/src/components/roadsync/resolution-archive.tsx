"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { DownloadIcon, ArchiveIcon } from "lucide-react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fmt } from "@/lib/roadsync/assessment";
import { archiveCsvPath, downloadFile, fetchArchive } from "@/lib/roadsync/resolution-api";
import { getResolutionCopy } from "@/lib/roadsync/resolution-copy";

import { useRoadsyncKeys, whenFmt } from "./resolution-tab";

const OUTCOMES = ["amendment_cleared", "risk_accepted", "no_action", "opportunity_realized", "directive_cleared"] as const;

/** Read-only archive of closed records within the viewer's agency scope (the server applies scope). */
export function ResolutionArchive() {
  const [locale] = useWorkspaceLocale();
  const copy = getResolutionCopy(locale);
  const ar = copy.archive;
  const keys = useRoadsyncKeys();
  const [outcome, setOutcome] = useState("");
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);
  const qs = new URLSearchParams({ page: String(page), limit: "20", sort: "resolvedAt" });
  if (outcome) qs.set("outcome", outcome);
  const q = useQuery({ queryKey: [...keys.key("history-archive", "all"), qs.toString()], queryFn: () => fetchArchive(qs.toString()), enabled: Boolean(keys.userId), retry: false });
  const status = q.error instanceof ApiError ? q.error.status : 0;
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.limit)) : 1;
  const csvQuery = new URLSearchParams(outcome ? { outcome } : {}).toString();

  return (
    <StaffWorkspaceShell title={copy.archive.title} description={copy.archive.subtitle} wide>
      <div className="rz rz-page">
        <p className="rs-help">{copy.demoNote}</p>
        <div className="rz-filters">
          <div className="rs-field"><label className="rs-label" htmlFor="rz-a-o">{ar.outcome}</label>
            <select id="rz-a-o" className="rs-input" value={outcome} onChange={(e) => { setOutcome(e.target.value); setPage(1); }}><option value="">{ar.allOutcomes}</option>{OUTCOMES.map((o) => <option key={o} value={o}>{copy.outcome[o]}</option>)}</select></div>
          <button type="button" className="rs-btn" onClick={() => void downloadFile(archiveCsvPath(csvQuery), "roadsync-history.csv").catch(() => setFailed(true))}><DownloadIcon aria-hidden="true" />{ar.csv}</button>
        </div>
        {failed ? <p className="rz-toast" role="status">{copy.failed}</p> : null}
        {q.data ? <ul className="rz-tiles">{Object.entries(ar.tiles).map(([k, label]) => <li key={k} className="rz-tile"><strong>{q.data.tiles[k] ?? 0}</strong><span>{label}</span></li>)}</ul> : null}
        {q.isPending ? <p className="rs-help" role="status">{copy.loading}</p>
          : q.isError ? <div className="rz-state" role="alert"><p>{status === 403 ? copy.forbidden : copy.error}</p><button type="button" className="rs-btn" onClick={() => void q.refetch()}>{copy.retry}</button></div>
          : q.data.items.length === 0 ? <div className="rz-state"><ArchiveIcon aria-hidden="true" /><p>{ar.empty}</p></div>
          : (
            <ul className="rz-list">
              {q.data.items.map((r) => (
                <li key={r.conflictId} className="rz-card">
                  <div className="rz-card-top"><code>{r.conflictNo}</code><span className="rz-chip" data-status={r.status === "resolved" ? "resolved" : "cancelled"}>{copy.outcome[r.outcome] ?? r.outcome}</span>{r.resolutionType ? <span className="rs-nb-chip">{copy.types[r.resolutionType] ?? r.resolutionType}</span> : null}</div>
                  <p className="rs-help">{ar.severity}: {r.severityAtDetection} → {r.severityAtResolution ?? "—"} · {ar.duration}: {fmt(ar.days, { n: r.durationDays })} · {ar.amendments}: {r.amendmentsApplied} · {ar.commitments}: {r.openCommitments} · {ar.closed}: {whenFmt(locale, r.closedAt)}</p>
                  <Link className="rs-btn" href={`/roadsync/conflicts/${r.conflictId}?tab=history`}>{copy.historyTab}</Link>
                </li>
              ))}
            </ul>
          )}
        {q.data && q.data.total > q.data.limit ? (
          <div className="rz-actions"><button type="button" className="rs-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{copy.approvals.prev}</button><span className="rs-help">{page} / {pages}</span><button type="button" className="rs-btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>{copy.approvals.next}</button></div>
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}

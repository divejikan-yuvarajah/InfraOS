"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ShieldCheckIcon } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fmt } from "@/lib/roadsync/assessment";
import { fetchAudit, verifyAuditBatch } from "@/lib/roadsync/resolution-api";
import { actionLabel, getResolutionCopy, roleLabel } from "@/lib/roadsync/resolution-copy";

import { useRoadsyncKeys, whenFmt } from "./resolution-tab";

/** Read-only national ledger explorer. The server answers 404 to everyone but SUPER_ADMIN, so this is display only. */
export function NationalAudit() {
  const [locale] = useWorkspaceLocale();
  const copy = getResolutionCopy(locale);
  const au = copy.audit;
  const keys = useRoadsyncKeys();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), limit: "25" });
  if (search) qs.set("q", search.toLowerCase().replace(/[^a-z_]/g, ""));
  const q = useQuery({ queryKey: [...keys.key("audit", "all"), qs.toString()], queryFn: () => fetchAudit(qs.toString()), enabled: Boolean(keys.userId), retry: false });
  const status = q.error instanceof ApiError ? q.error.status : 0;
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.limit)) : 1;
  const ids = q.data ? [...new Set(q.data.items.map((r) => r.conflictId))] : [];
  const verify = useMutation({ mutationFn: () => verifyAuditBatch(ids) });
  const verdict = new Map((verify.data?.results ?? []).map((r) => [r.conflictId, r]));

  return (
    <section className="rz-sec" aria-label={au.title}>
      <h3>{au.title}</h3>
      <p className="rs-help">{au.subtitle}</p>
      <div className="rz-filters">
        <div className="rs-field"><label className="rs-label" htmlFor="rz-au-q">{au.search}</label>
          <input id="rz-au-q" className="rs-input" value={search} maxLength={40} inputMode="text" autoComplete="off" onChange={(e) => { setSearch(e.target.value); setPage(1); verify.reset(); }} /></div>
        <button type="button" className="rs-btn" disabled={ids.length === 0 || verify.isPending} onClick={() => verify.mutate()}><ShieldCheckIcon aria-hidden="true" />{verify.isPending ? au.verifying : au.verifyPage}</button>
      </div>
      {verify.isError ? <p className="rz-toast" role="status">{copy.failed}</p> : null}
      {verify.data ? <p className="rs-help" role="status">{au.note}</p> : null}
      {q.isPending ? <p className="rs-help" role="status">{copy.loading}</p>
        : q.isError ? <div className="rz-state" role="alert"><p>{status === 403 || status === 404 ? copy.forbidden : copy.error}</p><button type="button" className="rs-btn" onClick={() => void q.refetch()}>{copy.retry}</button></div>
        : q.data.items.length === 0 ? <div className="rz-state"><p>{au.empty}</p></div>
        : (
          <>
            <p className="rs-help">{fmt(au.total, { n: q.data.total })}</p>
            <ul className="rz-list">
              {q.data.items.map((r) => {
                const v = verdict.get(r.conflictId);
                return (
                  <li key={`${r.conflictId}-${r.seq}`} className="rz-card">
                    <div className="rz-card-top"><code>{r.entityNo ?? r.entityType}</code><strong>{actionLabel(copy, r.action)}</strong>
                      {v ? <span className="rz-chip" data-status={!v.found ? "cancelled" : v.ok ? "resolved" : "cancelled"}>{!v.found ? au.missing : v.ok ? au.intact : fmt(au.broken, { seq: v.firstBrokenSeq ?? 0 })}</span> : null}</div>
                    <p className="rs-help">{whenFmt(locale, r.at)} · {r.actor.role ? roleLabel(copy, r.actor.role) : au.system} · #{r.seq} · {r.short}</p>
                    <Link className="rs-btn" href={`/roadsync/conflicts/${r.conflictId}?tab=history`}>{au.open}</Link>
                  </li>
                );
              })}
            </ul>
            {q.data.total > q.data.limit ? (
              <div className="rz-actions"><button type="button" className="rs-btn" disabled={page <= 1} onClick={() => { setPage((p) => p - 1); verify.reset(); }}>{copy.approvals.prev}</button><span className="rs-help">{page} / {pages}</span><button type="button" className="rs-btn" disabled={page >= pages} onClick={() => { setPage((p) => p + 1); verify.reset(); }}>{copy.approvals.next}</button></div>
            ) : null}
          </>
        )}
    </section>
  );
}

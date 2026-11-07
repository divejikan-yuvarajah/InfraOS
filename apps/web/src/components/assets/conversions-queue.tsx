"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { approveConversion, cancelConversion, fetchConversion, fetchConversions, rejectConversion } from "@/lib/assets/api";
import { getAssetCopy, type Copy } from "@/lib/assets/messages";
import { hintConvert, useAssetKeys } from "@/lib/assets/session";
import type { ConversionDetail, ConversionRow, ConversionStatus } from "@/lib/assets/types";
import { fill, fmtDate, fmtDateTime, reasonOk } from "@/lib/assets/view";
import type { AuthLocale } from "@/lib/auth/types";
import { useUrlParams } from "@/lib/finance/url-state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { useRefreshAssets } from "./asset-dialogs";
import { Chip, EmptyState, errorText, ErrorState, Field, Shell, Skeletons } from "./asset-ui";
import { GateList } from "./convert-wizard";

const PAGE = 20;
const TABS = ["PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED", "ALL"] as const;
const TONE: Record<ConversionStatus, "pending" | "success" | "critical" | "neutral"> = { PENDING_APPROVAL: "pending", APPROVED: "success", REJECTED: "critical", CANCELLED: "neutral" };
type Common = { copy: Copy; locale: AuthLocale };

function DecisionDialog({ open, onOpenChange, copy, mode, conversion }: { open: boolean; onOpenChange: (o: boolean) => void; copy: Copy; mode: "approve" | "reject"; conversion: ConversionDetail }) {
  const refresh = useRefreshAssets();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; assetNo: string | null; name: string }[] | null>(null);
  const q = copy.queue;
  const ok = mode === "approve" ? note.trim().length === 0 || reasonOk(note) : reasonOk(note);
  const m = useMutation({
    mutationFn: () => (mode === "approve" ? approveConversion(conversion.id, note.trim() ? { note: note.trim() } : {}).then((r) => { setResult(r.assets); return r; }) : rejectConversion(conversion.id, { note: note.trim() })),
    onSuccess: () => { toast.success(mode === "approve" ? q.approved : q.rejected); void refresh(); if (mode === "reject") onOpenChange(false); },
    onError: (e) => setError(errorText(e, copy)),
  });
  return (
    <Shell open={open} onOpenChange={(o) => { if (!o) { setNote(""); setError(null); setResult(null); } onOpenChange(o); }} title={mode === "approve" ? q.approveTitle : q.rejectTitle} description={mode === "approve" ? fill(q.approveBody, { n: conversion.proposedAssets.length }) : q.rejectBody}>
      {result ? (
        <div className="ctr-dialog" role="status">
          <strong>{fill(q.approvedTitle, { n: result.length })}</strong>
          <ul>{result.map((a) => <li key={a.id}><Link className="ins-link" href={`/assets/${a.id}`}>{a.assetNo ?? "—"} · {a.name}</Link></li>)}</ul>
          <div className="ctr-row" style={{ justifyContent: "flex-end" }}><button type="button" className="ctr-btn is-primary" onClick={() => onOpenChange(false)}>{copy.common.close}</button></div>
        </div>
      ) : (
        <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); setError(null); if (ok) m.mutate(); }}>
          <Field label={q.note} hint={q.noteHint}>{(id) => <textarea id={id} className="ctr-input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} required={mode === "reject"} />}</Field>
          {error ? <p className="ctr-error" role="alert">{error}</p> : null}
          <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="ctr-btn" onClick={() => onOpenChange(false)}>{copy.common.cancel}</button>
            <button type="submit" className={`ctr-btn ${mode === "approve" ? "is-primary" : "is-danger"}`} disabled={!ok || m.isPending}>{m.isPending ? copy.common.working : mode === "approve" ? q.approve : q.reject}</button>
          </div>
        </form>
      )}
    </Shell>
  );
}

function DetailDialog({ id, open, onOpenChange, copy, locale }: Common & { id: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { key } = useAssetKeys();
  const refresh = useRefreshAssets();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const q = useQuery({ queryKey: key("conversion", id ?? ""), queryFn: () => fetchConversion(id!), enabled: open && Boolean(id) });
  const cancel = useMutation({ mutationFn: () => cancelConversion(id!), onSuccess: () => { toast.success(copy.queue.cancelled); void refresh(); onOpenChange(false); }, onError: (e) => toast.error(errorText(e, copy)) });
  const c = q.data;
  const qq = copy.queue;
  return (
    <>
      <Shell open={open && mode === null} onOpenChange={onOpenChange} title={c ? fill(qq.detailTitle, { no: c.conversionNo ?? "" }) : copy.nav.conversions} wide>
        {q.isPending ? <Skeletons n={2} /> : q.isError ? <ErrorState error={q.error} copy={copy} onRetry={() => void q.refetch()} /> : c ? (
          <div className="ctr-dialog">
            <div className="ctr-row"><Chip tone={TONE[c.status]}>{qq.tabs[c.status]}</Chip>{c.project ? <Link className="ins-link" href={`/projects/${c.project.id}/overview`}>{c.project.projectCode} · {c.project.title}</Link> : null}</div>
            <p className="ins-muted">{c.requestedByName ? fill(qq.requestedBy, { name: c.requestedByName }) : ""} {c.requestedAt ? `· ${fmtDateTime(c.requestedAt, locale)}` : ""}{c.decidedByName ? ` · ${fill(qq.decidedBy, { name: c.decidedByName })}` : ""}</p>
            {c.decisionNote ? <p>{c.decisionNote}</p> : null}
            {c.status === "PENDING_APPROVAL" && c.liveGates ? <><h3 className="ins-h">{qq.gatesNow}</h3><GateList gates={c.liveGates} copy={copy} projectId={c.project?.id} /></> : c.gateSnapshots.length ? <><h3 className="ins-h">{qq.gatesThen}</h3><GateList gates={c.gateSnapshots[c.gateSnapshots.length - 1]!.gates} copy={copy} /></> : null}
            <h3 className="ins-h">{qq.proposed}</h3>
            <ul>{c.proposedAssets.map((a) => <li key={a.key}><strong>{a.name}</strong> · {copy.assetType[a.assetType]} · {a.geometrySource === "PROJECT" ? copy.wizard.useProject : copy.wizard.noMap}</li>)}</ul>
            <h3 className="ins-h">{qq.handover}</h3>
            <p className="ins-muted">{c.receivingAgencyName ?? "—"} · {c.handover.handoverDate ? fmtDate(c.handover.handoverDate, locale) : "—"} · {copy.condition[c.handover.conditionAtHandover]}{c.handover.defectsLiabilityEndsOn ? ` · ${copy.wizard.dlpEnds}: ${fmtDate(c.handover.defectsLiabilityEndsOn, locale)}` : ""}</p>
            {c.handover.handoverNote ? <p>{c.handover.handoverNote}</p> : null}
            {c.createdAssets.length ? <><h3 className="ins-h">{qq.createdAssets}</h3><ul>{c.createdAssets.map((a) => <li key={a.id}><Link className="ins-link" href={`/assets/${a.id}`}>{a.assetNo ?? "—"} · {a.name}</Link></li>)}</ul></> : null}
            {c.status === "PENDING_APPROVAL" ? (
              <>
                {c.can.decideBlockedReason === "own_request" ? <p className="ins-muted" role="note">{qq.blockedOwn}</p> : null}
                {c.liveGates?.some((g) => g.status === "BLOCK") ? <p className="ctr-error" role="status">{qq.gatesBlocked}</p> : null}
                <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
                  {c.can.cancel ? <button type="button" className="ctr-btn" disabled={cancel.isPending} onClick={() => cancel.mutate()}>{qq.cancel}</button> : null}
                  {c.can.decide ? <button type="button" className="ctr-btn is-danger" onClick={() => setMode("reject")}>{qq.reject}</button> : null}
                  {c.can.decide ? <button type="button" className="ctr-btn is-primary" disabled={Boolean(c.liveGates?.some((g) => g.status === "BLOCK"))} onClick={() => setMode("approve")}>{qq.approve}</button> : null}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </Shell>
      {c && mode ? <DecisionDialog open onOpenChange={(o) => { if (!o) { setMode(null); void q.refetch(); } }} copy={copy} mode={mode} conversion={c} /> : null}
    </>
  );
}

export function ConversionsQueue() {
  const [locale] = useWorkspaceLocale();
  const copy = getAssetCopy(locale);
  const { key, roleKey } = useAssetKeys();
  const url = useUrlParams();
  const tabRaw = url.get("status");
  const tab = (TABS as readonly string[]).includes(tabRaw) ? (tabRaw as (typeof TABS)[number]) : "PENDING_APPROVAL";
  const page = url.page;
  const [open, setOpen] = useState<string | null>(null);
  const list = useQuery({ queryKey: key("conversions", tab, page), queryFn: ({ signal }) => fetchConversions({ status: tab === "ALL" ? undefined : tab, page, limit: PAGE }, signal), placeholderData: keepPreviousData });
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const q = copy.queue;
  const row = (r: ConversionRow) => (
    <tr key={r.id}>
      <td><button type="button" className="ins-link" style={{ all: "unset", cursor: "pointer", fontWeight: 700 }} onClick={() => setOpen(r.id)}>{r.conversionNo ?? "—"}</button></td>
      <td><strong>{r.projectCode}</strong><br /><span className="ins-muted">{r.projectTitle}</span></td>
      <td>{r.agencyName ?? "—"}</td><td>{r.receivingAgencyName ?? "—"}</td><td>{r.requestedByName ?? "—"}{r.requestedByMe ? " ★" : ""}</td>
      <td>{r.requestedAt ? fmtDate(r.requestedAt, locale) : "—"}</td><td>{r.assetCount}</td><td><Chip tone={TONE[r.status]}>{q.tabs[r.status]}</Chip></td>
      <td><button type="button" className="ctr-btn" onClick={() => setOpen(r.id)}>{q.open}</button></td>
    </tr>
  );
  return (
    <StaffWorkspaceShell title={q.title} description={q.description} wide
      context={<ContextBar crumbs={[{ label: copy.nav.assets, href: "/assets" }, { label: copy.nav.conversions }]} scope={copy.dashboard.scope} asOf={null} actions={<div className="ctr-row">
        <button type="button" className="ctr-btn" onClick={() => void list.refetch()}><RefreshCwIcon aria-hidden="true" />{copy.common.refresh}</button>
        {hintConvert(roleKey) ? <Link className="ctr-btn is-primary" href="/assets/convert"><PlusIcon aria-hidden="true" />{copy.nav.convert}</Link> : null}
      </div>} />}>
      <div className="ins ast">
        <div className="ctr-seg" role="group" aria-label={q.title}>
          {TABS.map((t) => <button key={t} type="button" aria-pressed={tab === t} onClick={() => url.set({ status: t === "PENDING_APPROVAL" ? null : t })}>{q.tabs[t]}{t !== "ALL" && list.data?.facets[t] !== undefined ? ` (${list.data.facets[t]})` : ""}</button>)}
        </div>
        {list.isPending ? <Skeletons /> : list.isError ? <ErrorState error={list.error} copy={copy} onRetry={() => void list.refetch()} /> : list.data.rows.length === 0 ? <EmptyState title={q.empty} /> : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="ins-table">
                <thead><tr>{[q.columns.no, q.columns.project, q.columns.from, q.columns.to, q.columns.by, q.columns.when, q.columns.assets, copy.common.status].map((h) => <th key={h} scope="col">{h}</th>)}<th scope="col"><span className="sr-only">{copy.dashboard.table.actions}</span></th></tr></thead>
                <tbody>{list.data.rows.map(row)}</tbody>
              </table>
            </div>
            <nav className="ins-pager" aria-label={fill(copy.common.page, { n: page, total: pages })}>
              <span className="ins-muted">{fill(copy.common.total, { n: total })}</span>
              <span className="ctr-row">
                <button type="button" className="ctr-btn" disabled={page <= 1} onClick={() => url.set({ page: String(page - 1) })}>{copy.common.prev}</button>
                <span>{fill(copy.common.page, { n: page, total: pages })}</span>
                <button type="button" className="ctr-btn" disabled={page >= pages} onClick={() => url.set({ page: String(page + 1) })}>{copy.common.next}</button>
              </span>
            </nav>
          </>
        )}
      </div>
      <DetailDialog id={open} open={open !== null} onOpenChange={(o) => { if (!o) setOpen(null); }} copy={copy} locale={locale} />
    </StaffWorkspaceShell>
  );
}

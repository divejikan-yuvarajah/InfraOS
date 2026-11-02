"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DownloadIcon, FileClockIcon, Loader2Icon, ShieldCheckIcon, ShieldAlertIcon } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { AuthLocale } from "@/lib/auth/types";
import { fmt } from "@/lib/roadsync/assessment";
import { LEDGER_CATEGORIES, type Chronicle, type ChronicleItem, type LedgerCategory, type VerifyOut } from "@/lib/roadsync/resolution";
import { chronicleCsvPath, downloadFile, evidencePackPath, fetchChronicle, verifyChronicle } from "@/lib/roadsync/resolution-api";
import { actionLabel, getResolutionCopy } from "@/lib/roadsync/resolution-copy";

import { useRoadsyncKeys, whenFmt } from "./resolution-tab";

type Entry = Extract<ChronicleItem, { kind: "entry" }>;

/** Chronological, read-only ledger timeline. Server redacts by agency; hidden runs show as a count only. */
export function HistoryTab({ conflictId, conflictNo, locale }: { conflictId: string; conflictNo: string; locale: AuthLocale }) {
  const copy = getResolutionCopy(locale);
  const keys = useRoadsyncKeys();
  const [cats, setCats] = useState<LedgerCategory[]>([]);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [extra, setExtra] = useState<ChronicleItem[]>([]);
  const [cursor, setCursor] = useState<number | null | undefined>(undefined);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [verify, setVerify] = useState<VerifyOut | "busy" | "error" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const params = new URLSearchParams({ limit: "40" });
  if (cats.length) params.set("category", cats.join(","));
  if (search.trim()) params.set("q", search.trim().toLowerCase().replace(/\s+/g, "_"));
  if (from) params.set("from", new Date(from).toISOString());
  if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString());
  const qs = params.toString();
  const q = useQuery({ queryKey: [...keys.key("conflict-history", conflictId), qs], queryFn: () => fetchChronicle(conflictId, qs), enabled: Boolean(keys.userId), retry: false, refetchOnWindowFocus: true });

  const reset = () => { setExtra([]); setCursor(undefined); };
  const data: Chronicle | undefined = q.data;
  const next = cursor === undefined ? data?.nextCursor ?? null : cursor;
  const items = data ? [...data.items, ...extra] : [];
  const loadMore = async () => {
    if (next === null) return;
    setMore(true);
    try { const page = await fetchChronicle(conflictId, `${qs}&cursor=${next}`); setExtra((e) => [...e, ...page.items]); setCursor(page.nextCursor); } catch { setNote(copy.error); } finally { setMore(false); }
  };
  const doVerify = async () => { setVerify("busy"); try { setVerify(await verifyChronicle(conflictId)); } catch { setVerify("error"); } };
  const download = (path: string, name: string) => void downloadFile(path, name).catch(() => setNote(copy.failed));
  const toggle = (c: LedgerCategory) => { reset(); setCats((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c])); };
  const h = copy.history;

  if (q.isPending) return <p className="rs-help" role="status">{copy.loading}</p>;
  if (q.isError) {
    const status = q.error instanceof ApiError ? q.error.status : 0;
    return <div className="rz-state" role="alert"><p>{status === 403 ? copy.forbidden : status === 404 ? copy.notFound : copy.error}</p><button type="button" className="rs-btn" onClick={() => void q.refetch()}>{copy.retry}</button></div>;
  }
  const filtered = cats.length > 0 || search.trim() !== "" || from !== "" || to !== "";
  return (
    <div className="rz">
      <header className="rz-hhead">
        <div><h3>{h.title}</h3><p className="rs-help">{h.subtitle}</p><p className="rs-help">{h.asOf} {data ? fmt(h.integrity, { n: data.integrity.count, head: data.integrity.shortHead ?? h.noHead }) : ""}</p></div>
        <div className="rz-actions">
          <button type="button" className="rs-btn" onClick={() => void doVerify()} disabled={verify === "busy"}>{verify === "busy" ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : <ShieldCheckIcon aria-hidden="true" />}{verify === "busy" ? h.verifying : h.verify}</button>
          <button type="button" className="rs-btn" onClick={() => download(chronicleCsvPath(conflictId), `chronicle-${conflictNo}.csv`)}><DownloadIcon aria-hidden="true" />{h.csv}</button>
          <button type="button" className="rs-btn" onClick={() => download(evidencePackPath(conflictId), `${conflictNo}-evidence.json`)}><DownloadIcon aria-hidden="true" />{h.pack}</button>
        </div>
      </header>
      {verify && verify !== "busy" ? (
        <p className="rz-verify" role="status" data-result={verify !== "error" && verify.ok ? "cleared" : "worse"}>
          {verify === "error" ? <><ShieldAlertIcon aria-hidden="true" />{copy.failed}</> : verify.ok ? <><ShieldCheckIcon aria-hidden="true" />{fmt(h.verifyOk, { n: verify.count, head: verify.shortHead ?? "—" })}</> : <><ShieldAlertIcon aria-hidden="true" />{fmt(h.verifyBad, { seq: verify.firstBrokenSeq ?? "?" })}</>}
          {verify !== "error" ? <span className="rs-help"> {h.notice}</span> : null}
        </p>
      ) : null}
      {note ? <p className="rz-toast" role="status">{note}</p> : null}
      <div className="rz-filters">
        <div className="rz-chipset" role="group" aria-label={h.all}>{LEDGER_CATEGORIES.map((c) => <button key={c} type="button" className="rz-fchip" aria-pressed={cats.includes(c)} onClick={() => toggle(c)}>{h.cat[c]}</button>)}</div>
        <div className="rs-field"><label className="rs-label" htmlFor="rz-h-q">{h.search}</label><input id="rz-h-q" className="rs-input" value={search} maxLength={40} onChange={(e) => { reset(); setSearch(e.target.value); }} /></div>
        <div className="rs-field"><label className="rs-label" htmlFor="rz-h-f">{h.from}</label><input id="rz-h-f" type="date" className="rs-input" value={from} onChange={(e) => { reset(); setFrom(e.target.value); }} /></div>
        <div className="rs-field"><label className="rs-label" htmlFor="rz-h-t">{h.to}</label><input id="rz-h-t" type="date" className="rs-input" value={to} onChange={(e) => { reset(); setTo(e.target.value); }} /></div>
        {filtered ? <button type="button" className="rs-btn" onClick={() => { reset(); setCats([]); setSearch(""); setFrom(""); setTo(""); }}>{h.clear}</button> : null}
      </div>
      {items.length === 0 ? <div className="rz-state"><FileClockIcon aria-hidden="true" /><p>{filtered ? h.empty : h.emptyAll}</p></div> : (
        <ol className="rz-timeline" aria-label={h.title}>
          {items.map((it, i) => it.kind === "hidden"
            ? <li key={`h${i}`} className="rz-tl rz-tl-hidden">{fmt(h.hidden, { n: it.count })}</li>
            : it.kind === "preledger"
              ? <li key={`p${i}`} className="rz-tl" data-cat={it.category}><span className="rz-tl-dot" aria-hidden="true" /><div className="rz-tl-body"><strong>{actionLabel(copy, it.action)}</strong><span className="rs-help">{it.entityNo ?? ""} · {whenFmt(locale, it.at)} · {h.preLedger}</span></div></li>
              : <EntryRow key={it.seq} e={it} open={open === it.seq} onToggle={() => setOpen(open === it.seq ? null : it.seq)} locale={locale} />)}
        </ol>
      )}
      <p className="rs-help">{fmt(h.total, { n: data?.total ?? 0 })}</p>
      {next !== null ? <button type="button" className="rs-btn" disabled={more} onClick={() => void loadMore()}>{more ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : null}{h.loadMore}</button> : null}
    </div>
  );
}

function EntryRow({ e, open, onToggle, locale }: { e: Entry; open: boolean; onToggle: () => void; locale: AuthLocale }) {
  const copy = getResolutionCopy(locale);
  const h = copy.history;
  const actor = e.actorLabel.person ? (e.actorLabel.role ?? h.actor) : h.system;
  return (
    <li className="rz-tl" data-cat={e.category}>
      <span className="rz-tl-dot" aria-hidden="true" />
      <div className="rz-tl-body">
        <div className="rz-tl-top"><strong>{actionLabel(copy, e.action)}</strong><span className="rs-nb-chip">{h.cat[e.category]}</span>{e.entityNo ? <code>{e.entityNo}</code> : null}</div>
        <span className="rs-help">{whenFmt(locale, e.at)} · {actor} · {fmt(h.seq, { n: e.seq })}</span>
        <button type="button" className="rz-link" aria-expanded={open} onClick={onToggle}>{open ? h.showLess : h.showMore}</button>
        {open ? (
          <dl className="rz-tl-detail">
            <dt>{h.recorded}</dt><dd>{whenFmt(locale, e.recordedAt)}</dd>
            <dt>{h.stateAfter}</dt><dd>{h.rec}: {e.stateAfter.recordStatus}{e.stateAfter.coordinationState ? ` · ${h.coord}: ${e.stateAfter.coordinationState}` : ""}{e.stateAfter.resolutionState ? ` · ${h.res}: ${e.stateAfter.resolutionState}` : ""}{e.stateAfter.severity ? ` · ${h.sev}: ${e.stateAfter.severity.band} (${e.stateAfter.severity.score})` : ""}</dd>
            <dt>{h.hash}</dt><dd><code>{e.hash ? `${e.hash.slice(0, 16)}…` : e.short}</code></dd>
            {e.prevHash ? <><dt>{h.prev}</dt><dd><code>{e.prevHash.slice(0, 16)}…</code></dd></> : null}
          </dl>
        ) : null}
      </div>
    </li>
  );
}

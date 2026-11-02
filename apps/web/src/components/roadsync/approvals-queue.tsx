"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ClockIcon, InboxIcon } from "lucide-react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fmt } from "@/lib/roadsync/assessment";
import type { ApprovalStep } from "@/lib/roadsync/resolution";
import { fetchApprovals } from "@/lib/roadsync/resolution-api";
import { getResolutionCopy } from "@/lib/roadsync/resolution-copy";

import { useRoadsyncKeys, whenFmt } from "./resolution-tab";

type Tab = "mine" | "submitted" | "all";
const TABS: Tab[] = ["mine", "submitted", "all"];
const STEPS: ApprovalStep[] = ["agency_admin", "party_confirmation", "national", "national_second"];

/** Read-only queue; deciding happens in the resolution workspace where the full context and server checks live. */
export function ApprovalsQueue() {
  const [locale] = useWorkspaceLocale();
  const copy = getResolutionCopy(locale);
  const a = copy.approvals;
  const keys = useRoadsyncKeys();
  const initial = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (TABS as string[]).includes(initial.get("tab") ?? "") ? (initial.get("tab") as Tab) : "mine");
  const [step, setStep] = useState(() => (STEPS as string[]).includes(initial.get("step") ?? "") ? initial.get("step")! : "");
  const [overdue, setOverdue] = useState(() => initial.get("overdue") === "true");
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ tab, page: String(page), limit: "20" });
  if (step) qs.set("step", step);
  if (overdue) qs.set("overdue", "true");
  const q = useQuery({ queryKey: [...keys.key("approvals", "queue"), qs.toString()], queryFn: () => fetchApprovals(qs.toString()), enabled: Boolean(keys.userId), retry: false, refetchOnWindowFocus: true });
  const status = q.error instanceof ApiError ? q.error.status : 0;
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.limit)) : 1;

  return (
    <StaffWorkspaceShell title={copy.approvals.title} description={copy.approvals.subtitle} wide>
      <div className="rz rz-page">
        <p className="rs-help">{copy.demoNote}</p>
        <div className="rz-filters">
          <div className="rz-chipset" role="tablist" aria-label={a.title}>{TABS.map((t) => <button key={t} role="tab" type="button" aria-selected={tab === t} className="rz-fchip" onClick={() => { setTab(t); setPage(1); }}>{a.tabs[t]}</button>)}</div>
          <div className="rs-field"><label className="rs-label" htmlFor="rz-q-step">{a.step}</label>
            <select id="rz-q-step" className="rs-input" value={step} onChange={(e) => { setStep(e.target.value); setPage(1); }}><option value="">{a.allSteps}</option>{STEPS.map((s) => <option key={s} value={s}>{copy.steps[s]}</option>)}</select></div>
          <label className="rz-check"><input type="checkbox" checked={overdue} onChange={(e) => { setOverdue(e.target.checked); setPage(1); }} />{a.overdueOnly}</label>
        </div>
        {q.isPending ? <p className="rs-help" role="status">{copy.loading}</p>
          : q.isError ? <div className="rz-state" role="alert"><p>{status === 403 ? copy.forbidden : copy.error}</p><button type="button" className="rs-btn" onClick={() => void q.refetch()}>{copy.retry}</button></div>
          : q.data.items.length === 0 ? <div className="rz-state"><InboxIcon aria-hidden="true" /><p>{tab === "mine" && !step && !overdue ? a.empty : a.emptyOther}</p></div>
          : (
            <ul className="rz-list">
              {q.data.items.map((r) => (
                <li key={r.stepId} className="rz-card" data-overdue={r.overdue}>
                  <div className="rz-card-top"><code>{r.amendmentNo ?? r.resolutionNo}</code><span className="rs-nb-chip">{copy.types[r.type]}</span><span className="rz-chip" data-status="pending_approval">{copy.steps[r.step]}</span>{r.overdue ? <span className="rz-chip" data-status="contested">{copy.f.overdue}</span> : null}</div>
                  <p className="rs-help">{copy.f.conflictNo} {r.conflictNo} · {r.requestedBy ?? "—"} · <ClockIcon aria-hidden="true" className="rz-inline" /> {fmt(copy.f.dueIn, { when: whenFmt(locale, r.dueAt) })}</p>
                  {r.impact ? <p className="rz-impact" data-bad={r.impact.thirdParty.newConflicts > 0 || r.impact.thirdParty.worsened > 0}>{fmt(copy.f.impactLine, { n: r.impact.thirdParty.newConflicts, w: r.impact.thirdParty.worsened, c: r.impact.thirdParty.cleared })}</p> : null}
                  {!r.fourEyesOk ? <p className="rz-warn" role="note">{a.fourEyes}</p> : null}
                  <Link className="rs-btn" href={`/roadsync/conflicts/${r.conflictId}?tab=resolution`}>{a.open}</Link>
                </li>
              ))}
            </ul>
          )}
        {q.data && q.data.total > q.data.limit ? (
          <div className="rz-actions"><button type="button" className="rs-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{a.prev}</button><span className="rs-help">{page} / {pages} · {fmt(a.total, { n: q.data.total })}</span><button type="button" className="rs-btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>{a.next}</button></div>
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}

"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CloudOffIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { fetchMyWork, startInspection } from "@/lib/inspections/api";
import { getInspectionCopy, type Copy } from "@/lib/inspections/messages";
import { useInspectionKeys } from "@/lib/inspections/session";
import type { InspectionRow } from "@/lib/inspections/types";
import { fill, fmtDate, fmtDayLong, fmtTime } from "@/lib/inspections/view";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import type { AuthLocale } from "@/lib/auth/types";

import { useRefreshInspections } from "./inspection-dialogs";
import { EmptyState, ErrorState, PriorityChip, Skeletons, StatusBadge, errorText } from "./inspection-ui";

function Card({ row, copy, locale, onStart, starting }: { row: InspectionRow; copy: Copy; locale: AuthLocale; onStart: (id: string) => void; starting: boolean }) {
  const action = row.status === "SCHEDULED"
    ? <button type="button" className="ctr-btn is-primary" disabled={row.canStart === false || starting} onClick={() => onStart(row.id)}>{copy.my.start}</button>
    : row.status === "IN_PROGRESS" ? <Link className="ctr-btn is-primary" href={`/inspections/${row.id}/report`}>{copy.my.cont}</Link>
    : row.status === "REQUIRES_REVIEW" ? <Link className="ctr-btn is-primary" href={`/inspections/${row.id}/report`}>{copy.my.revise}</Link>
    : <Link className="ctr-btn" href={`/inspections/${row.id}`}>{copy.my.view}</Link>;
  return (
    <div className="ins-card" data-overdue={row.overdue}>
      <div className="ins-card-top">
        <div><strong>{fmtTime(row.inspectionDate, locale)}</strong> · <Link className="ins-link" href={`/inspections/${row.id}`}>{row.projectCode}</Link><br /><span className="ins-muted">{row.projectTitle}</span></div>
        <PriorityChip priority={row.priority} copy={copy} />
      </div>
      <div className="ctr-row"><StatusBadge status={row.status} overdue={row.overdue} copy={copy} />{row.dueIn24h ? <span className="ins-prio" data-p="HIGH">{copy.my.dueSoon}</span> : null}</div>
      <span className="ins-muted">{copy.type[row.inspectionType]} · {fmtDate(row.inspectionDate, locale)} · {row.inspectionNo}</span>
      {row.status === "SCHEDULED" && row.canStart === false ? <span className="ins-muted">{copy.my.windowNote}</span> : null}
      <div className="ctr-row">{action}</div>
    </div>
  );
}

function Section({ title, rows, empty, ...rest }: { title: string; rows: InspectionRow[]; empty: string; copy: Copy; locale: AuthLocale; onStart: (id: string) => void; starting: boolean }) {
  return (
    <section className="ins-panel" aria-label={title}>
      <h2 className="ins-h">{title} <span className="ins-muted">({rows.length})</span></h2>
      {rows.length ? <div className="ins-cards">{rows.map((r) => <Card key={r.id} row={r} {...rest} />)}</div> : <p className="ins-muted">{empty}</p>}
    </section>
  );
}

export function MyWorkClient() {
  const [locale] = useWorkspaceLocale();
  const copy = getInspectionCopy(locale);
  const router = useRouter();
  const { key } = useInspectionKeys();
  const refresh = useRefreshInspections();
  const q = useQuery({ queryKey: key("my"), queryFn: ({ signal }) => fetchMyWork(signal), refetchInterval: 120_000 });
  const [online, setOnline] = useState(true);
  useEffect(() => { const up = () => setOnline(true); const down = () => setOnline(false); queueMicrotask(() => setOnline(navigator.onLine)); window.addEventListener("online", up); window.addEventListener("offline", down); return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); }; }, []);
  const start = useMutation({ mutationFn: (id: string) => startInspection(id), onSuccess: (_d, id) => { toast.success(copy.dialogs.started); void refresh(); router.push(`/inspections/${id}/report`); }, onError: (e) => toast.error(errorText(e, copy)) });
  const common = { copy, locale, onStart: (id: string) => start.mutate(id), starting: start.isPending };

  return (
    <StaffWorkspaceShell title={copy.my.title} description={copy.my.description} wide
      context={<ContextBar crumbs={[{ label: copy.nav.title, href: "/inspections" }, { label: copy.my.title }]} asOf={q.data?.asOf ?? null} actions={<button type="button" className="ctr-btn" onClick={() => void q.refetch()}><RefreshCwIcon aria-hidden="true" />{copy.common.refresh}</button>} />}>
      <div className="ins">
        {!online ? <p className="ins-offline" role="status"><CloudOffIcon aria-hidden="true" style={{ width: 14, height: 14, display: "inline" }} /> {copy.my.offlineBanner}</p> : null}
        <p><strong>{fill(copy.my.greeting, { date: fmtDayLong(new Date(), locale) })}</strong></p>
        {q.isPending ? <Skeletons /> : q.isError ? <ErrorState error={q.error} copy={copy} onRetry={() => void q.refetch()} /> : (
          <>
            {q.data.overdue.length ? <Section title={copy.my.overdue} rows={q.data.overdue} empty="" {...common} /> : null}
            <Section title={copy.my.today} rows={q.data.today.filter((r) => !r.overdue)} empty={copy.my.nothingToday} {...common} />
            <Section title={copy.my.revisions} rows={q.data.revisions} empty={copy.my.nothingRevisions} {...common} />
            <Section title={copy.my.inProgress} rows={q.data.inProgress.filter((r) => !r.overdue && !q.data.today.some((t) => t.id === r.id))} empty={copy.my.nothingToday} {...common} />
            <Section title={copy.my.upcoming} rows={q.data.upcoming} empty={copy.my.nothingUpcoming} {...common} />
            <Section title={copy.my.recent} rows={q.data.recentDecisions} empty={copy.my.nothingRecent} {...common} />
            {!q.data.today.length && !q.data.upcoming.length && !q.data.overdue.length && !q.data.revisions.length && !q.data.inProgress.length ? <EmptyState title={copy.my.nothingToday} body={copy.my.windowNote} /> : null}
          </>
        )}
      </div>
    </StaffWorkspaceShell>
  );
}

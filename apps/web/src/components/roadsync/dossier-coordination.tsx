"use client";

import Link from "next/link";

import { fmt } from "@/lib/roadsync/assessment";
import type { ConflictCoordination } from "@/lib/roadsync/coordination";
import type { CoordCopy } from "@/lib/roadsync/coordination-copy";
import type { Dossier } from "@/lib/roadsync/conflict-records";

import { useNow } from "./conflict-primitives";
import { AgreementMeter, DeadlineClock, StatusChip } from "./coordination-primitives";

/** Dossier tab: requests on this record (participants only) plus the CTA. Non-participants see the summary only. */
export function CoordinationTab({ d, data, loading, copy, locale }: { d: Dossier; data: ConflictCoordination | null; loading: boolean; copy: CoordCopy; locale: string }) {
  const now = useNow();
  const canStart = ["open", "acknowledged", "awaiting_response", "negotiating"].includes(d.status);
  if (loading) return <p className="rs-help" role="status">{copy.room.loading}</p>;
  const summary = data?.coordination;
  return (
    <div className="co-dtab">
      {canStart ? <Link className="rs-btn is-primary" href={`/roadsync/conflicts/${d.id}/coordination/new`}>{copy.integrations.start}</Link> : null}
      {summary && summary.state !== "none" ? <p className="rs-help">{copy.integrations.stateLabel[summary.state]} · {fmt(copy.integrations.activeChipNone, { active: summary.activeCount })}</p> : null}
      {!data || data.items.length === 0 ? <p className="rs-help">{summary && summary.activeCount > 0 ? copy.integrations.summaryOnly : copy.integrations.noRequests}</p> : (
        <ul className="co-dlist">
          {data.items.map((r) => (
            <li key={r.id}>
              <Link href={`/roadsync/coordination/${r.id}`} className="co-dcard">
                <span className="co-row-top"><code>{r.requestNo}</code><span className="rs-nb-chip">{copy.types[r.type]}</span><StatusChip status={r.status} escalated={r.escalated} copy={copy} /><span className="rs-nb-chip">{fmt(copy.round, { n: r.round, max: r.maxRounds })}</span></span>
                <span className="co-row-bottom"><AgreementMeter participants={r.participants} copy={copy} /><DeadlineClock at={r.deadline.at} closed={r.deadline.state === "closed"} now={now} copy={copy} locale={locale} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

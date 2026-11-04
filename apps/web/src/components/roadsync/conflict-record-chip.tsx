"use client";

import Link from "next/link";

import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fmt } from "@/lib/roadsync/assessment";
import { ackSlaDue, type RecordRow } from "@/lib/roadsync/conflict-records";
import { getConflictCopy } from "@/lib/roadsync/conflict-records-copy";

import { SlaChip, useNow } from "./conflict-primitives";

/** "RSC-2026-000012 · Open · 1/3 acked": links a stored pair to its formal record. Absent when no record exists. */
export function RecordChip({ link, row }: { link: { id: string; no: string; status: string }; row: RecordRow | null }) {
  const [locale] = useWorkspaceLocale();
  const copy = getConflictCopy(locale);
  const now = useNow(60_000);
  const status = copy.status[row?.status ?? link.status] ?? link.status;
  const progress = row?.ackProgress ?? { done: 0, required: 0 };
  return (
    <span className="cr-recchip">
      <Link href={`/roadsync/conflicts/${link.id}`} className="rs-nb-chip">
        <code>{link.no}</code> · {fmt(copy.integrations.chip, { status, done: progress.done, required: progress.required })}
      </Link>
      {row ? <SlaChip due={ackSlaDue(row.status, row.myAgency)} now={now} copy={copy} locale={locale} /> : null}
    </span>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fetchHealth } from "@/lib/inframap/inframap-api";
import type { InframapCopy } from "@/lib/inframap/inframap-copy";
import type { B3Copy } from "@/lib/inframap/inframap-copy-b3";
import { fmt } from "@/lib/roadsync/assessment";

type Locale = "en" | "si" | "ta";
/** "2 days ago" in the active language. Intl is used because date-fns ships no Sinhala locale. */
function ago(iso: string, locale: Locale, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86_400], ["hour", 3_600], ["minute", 60]];
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  return rtf.format(seconds, "second");
}

/** Per-layer completeness and freshness, scoped like the layers; restricted records the viewer cannot see are a count only. */
export default function DataHealth({ open, onOpenChange, copy, c3, locale, userKey, queryKey }: {
  open: boolean; onOpenChange: (o: boolean) => void; copy: InframapCopy; c3: B3Copy; locale: Locale; userKey: string; queryKey: readonly unknown[];
}) {
  const q = useQuery({ queryKey: [...queryKey, "health", userKey], queryFn: ({ signal }) => fetchHealth(signal), enabled: open && Boolean(userKey), staleTime: 15_000, retry: false });
  const h = c3.hl;
  const when = (iso: string | null) => (iso ? fmt(h.updated, { when: ago(iso, locale) }) : h.never);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="im-health">
        <DialogTitle>{h.title}</DialogTitle>
        <DialogDescription className="sr-only">{h.title}</DialogDescription>
        {q.isLoading ? <p className="rs-help" role="status">{h.loading}</p> : null}
        {q.isError ? <p className="rs-help" role="alert">{h.error}</p> : null}
        {q.data && q.data.layers.length === 0 ? <p className="rs-help">{h.noData}</p> : null}
        {q.data ? (
          <div className="im-health-body">
            {q.data.layers.map((l) => (
              <section key={l.layer} className="im-health-row">
                <div className="im-health-top"><b>{copy.layers[l.layer]}</b><small>{fmt(h.total, { n: l.total })} · {fmt(h.withGeometry, { n: l.withGeometry })}</small></div>
                <div className="im-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={l.completenessPct ?? 0} aria-label={`${copy.layers[l.layer]}: ${l.completenessPct ?? 0}%`}>
                  <span style={{ width: `${l.completenessPct ?? 0}%` }} />
                </div>
                <p className="rs-help">{l.completenessPct === null ? h.never : fmt(h.completeness, { n: l.completenessPct })} · {when(l.latestUpdatedAt)}</p>
                {l.demoCount > 0 ? <p className="im-tier">{fmt(h.demo, { n: l.demoCount })}</p> : null}
                {l.restrictedHidden ? <p className="im-tier">{fmt(h.restricted, { n: l.restrictedHidden })}</p> : null}
                {l.neverInspected ? <p className="rs-help">{fmt(h.neverInspected, { n: l.neverInspected })}</p> : null}
                {l.overdueMaintenance ? <p className="rs-help">{fmt(h.overdueMaintenance, { n: l.overdueMaintenance })}</p> : null}
              </section>
            ))}
            {q.data.unmappedProjects.total > 0 ? (
              <section>
                <h3 className="im-h">{h.unmapped} · {q.data.unmappedProjects.total}</h3>
                <ul>{q.data.unmappedProjects.items.map((p) => <li key={p.id}><Link href={`/projects/${p.id}/overview`}>{p.projectCode} · {p.title}</Link></li>)}</ul>
                {q.data.unmappedProjects.total > q.data.unmappedProjects.items.length ? <p className="rs-help">{fmt(h.moreNotShown, { n: q.data.unmappedProjects.total - q.data.unmappedProjects.items.length })}</p> : null}
              </section>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { InfoIcon } from "lucide-react";

import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fmt } from "@/lib/roadsync/assessment";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { previewNearby } from "@/lib/roadsync/nearby-api";
import { workRequestQueryKey, type GeometryInput } from "@/lib/roadsync/work-requests-view";

import { getConflictCopy } from "@/lib/roadsync/conflict-records-copy";
import { initials } from "@/lib/roadsync/conflict-records";
import { KindPill, RiskChip } from "./risk-visuals";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Advisory conflict preview while drafting. It uses the same engine as the stored assessment, never blocks
 * Next or Submit, and the compact row and the review card share one cached request.
 */
export function ConflictPreview({ variant, geometry, plannedStart, plannedEnd, workType, priority }: { variant: "compact" | "review"; geometry: GeometryInput | null; plannedStart: string | null; plannedEnd: string | null; workType: string; priority: string }) {
  const [locale] = useWorkspaceLocale();
  const copy = getAssessmentCopy(locale);
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const geoKey = useDebounced(geometry ? JSON.stringify(geometry) : "", 500);
  const schedKey = useDebounced(plannedStart && plannedEnd ? `${plannedStart}|${plannedEnd}` : "", 500);
  const subject = useDebounced(`${workType}|${priority}`, 500);

  const query = useQuery({
    queryKey: workRequestQueryKey(epoch, userId, roleKey, "conflict-preview", geoKey, schedKey, subject),
    queryFn: () => {
      const [start, end] = schedKey.split("|");
      const [type, prio] = subject.split("|");
      return previewNearby({
        geometry: JSON.parse(geoKey) as GeometryInput,
        radiusMeters: 250,
        ...(start && end ? { schedule: { plannedStart: start, plannedEnd: end } } : {}),
        subject: { ...(type ? { workType: type } : {}), ...(prio ? { priority: prio } : {}) },
      });
    },
    enabled: Boolean(userId) && Boolean(geoKey),
    retry: false,
  });
  const cc = getConflictCopy(locale);
  const agencies = query.data?.summary.agenciesToCoordinate ?? [];
  const w = copy.wizard;
  const a = query.data?.summary.assessment ?? null;
  const top = (query.data?.candidates ?? [])
    .filter((c) => c.assessment?.kind === "conflict")
    .sort((x, y) => (y.assessment?.score ?? 0) - (x.assessment?.score ?? 0))
    .slice(0, 5);

  const body = !geoKey ? <p className="rs-help">{w.waiting}</p>
    : query.isPending ? <p className="rs-help" role="status">{copy.states.loading}</p>
    : query.isError || !a ? <p className="rs-help" role="status">{w.failed}</p>
    : a.counts.conflicts === 0 && a.counts.opportunities === 0 ? <p className="rs-help">{w.clear}</p>
    : <p>{fmt(a.counts.conflicts === 1 ? w.lineOne : w.line, { n: a.counts.conflicts, band: copy.bands[a.maxBand ?? "info"], m: a.counts.opportunities })}</p>;

  return (
    <section className="rs-cpv" aria-label={w.title} data-variant={variant}>
      <div className="rs-cpv-head">
        <h4>{w.title}</h4>
        {a ? <RiskChip value={a.riskIndex} band={a.maxBand} copy={copy} /> : null}
      </div>
      <div aria-live="polite">{body}</div>
      {variant === "review" && top.length > 0 ? (
        <>
          <p className="rs-help">{w.top}</p>
          <ul className="rs-cpv-top">
            {top.map((c) => (
              <li key={c.key}>
                <KindPill kind={c.assessment!.kind} band={c.assessment!.band} copy={copy} />
                <code>{c.other.ref}</code>
                <span>{c.other.agencyName ?? copy.card.agencyUnknown}</span>
                {c.assessment!.primaryClass ? <span className="rs-nb-chip">{copy.classes[c.assessment!.primaryClass]}</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {agencies.length > 0 ? (
        <div className="cr-coord" aria-label={cc.integrations.agenciesTitle}>
          <p className="rs-help"><strong>{cc.integrations.agenciesTitle}</strong></p>
          <ul>{agencies.map((x) => <li key={x.agencyId} title={x.roles.map((r) => cc.roles[r] ?? r).join(", ")}><span className="cr-disc" data-state={x.required ? "pending" : "excluded"} style={{ width: 30, height: 30 }}>{initials(x.name)}</span><span>{x.name}<small>{x.required ? cc.integrations.required : cc.integrations.informed}</small></span></li>)}</ul>
          <p className="rs-help">{cc.integrations.agenciesNote}</p>
        </div>
      ) : null}
      {a && a.incompleteInputs.length > 0 && workType ? <p className="rs-help"><InfoIcon aria-hidden="true" style={{ width: "0.9rem", verticalAlign: "-0.15em" }} /> {copy.states.traffic}</p> : null}
      {a && !workType ? <p className="rs-help"><InfoIcon aria-hidden="true" style={{ width: "0.9rem", verticalAlign: "-0.15em" }} /> {w.nudge}</p> : null}
      <p className="rs-help">{w.advisory}</p>
    </section>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { ArrowLeftIcon, CheckCircle2Icon, InfoIcon } from "lucide-react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { StatusChip } from "@/components/site-plan/site-plan";
import { RouteLines } from "@/components/motif/connected-motif";
import { classifyWorkRequestError, fetchWorkRequest, FAILURE_COPY } from "@/lib/roadsync/api";
import {
  canHintCreate,
  formatColombo,
  formatPosition,
  summarizeGeometry,
  WORK_TYPE_LABELS,
  workRequestQueryKey,
} from "@/lib/roadsync/work-requests-view";
import type { NearbyOverlay } from "@/lib/roadsync/nearby";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { ConflictsPanel, useAssessment } from "./conflicts-panel";
import { NearbyActivityPanel } from "./nearby-activity";
import { getConflictCopy } from "@/lib/roadsync/conflict-records-copy";
import { fmt } from "@/lib/roadsync/assessment";
import { RiskChip } from "./risk-visuals";
import { PriorityMark, WorkTypeIcon } from "./roadsync-shared";
import { WorkMap } from "./work-map";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

export function WorkRequestDetailClient({ id }: { id: string }) {
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const [nearbyOverlay, setNearbyOverlay] = useState<NearbyOverlay | null>(null);
  const [conflictOverlay, setConflictOverlay] = useState<NearbyOverlay | null>(null);
  const [layer, setLayer] = useState<"conflicts" | "nearby">("conflicts");
  const [locale] = useWorkspaceLocale();
  const risk = getAssessmentCopy(locale);
  const cc = getConflictCopy(locale);
  const created = useSearchParams().get("created") === "1";
  const query = useQuery({
    queryKey: workRequestQueryKey(epoch, userId, roleKey, "detail", id),
    queryFn: () => fetchWorkRequest(id),
    enabled: Boolean(userId),
    retry: false,
  });
  const wr = query.data;
  const assessment = useAssessment(id, Boolean(wr && wr.status !== "DRAFT"));
  const assessed = assessment.query.data;
  const severity = new Map((assessed?.items ?? []).map((i) => [i.candidateId, { kind: i.assessment.kind, band: i.assessment.effective.band }] as const));
  const overlay = layer === "nearby" ? nearbyOverlay ?? conflictOverlay : conflictOverlay ?? nearbyOverlay;
  const failure = query.error ? classifyWorkRequestError(query.error) : null;
  const geo = wr ? summarizeGeometry(wr.geometry) : null;
  const vertices = wr ? (wr.geometry.type === "Point" ? [wr.geometry.coordinates] : wr.geometry.type === "LineString" ? wr.geometry.coordinates : (wr.geometry.coordinates[0] ?? [])) : [];

  return (
    <StaffWorkspaceShell title={wr ? WORK_TYPE_LABELS[wr.workType] : "Work request"} description={wr ? "Draft work request. Details are read-only in this release." : undefined} wide>
      <div className="rs-page">
        <div className="rs-eyebrow">
          <p className="rs-crumb">Operations / RoadSync / Work request</p>
          <Link href="/roadsync/work-requests" className="rs-btn">
            <ArrowLeftIcon aria-hidden="true" />
            All work requests
          </Link>
        </div>

        {query.isPending ? (
          <div className="rs-list" role="status" aria-label="Loading work request">
            <div className="rs-skel-row" /><div className="rs-skel-row" /><div className="rs-skel-row" />
          </div>
        ) : failure ? (
          <div className="rs-state" role="alert">
            <RouteLines className="rs-state-motif" />
            <h2>{failure === "not-found" ? "Work request not found" : "Work request could not be loaded"}</h2>
            <p>{failure === "not-found" ? "It does not exist, or it is outside your authorised scope." : FAILURE_COPY[failure]}</p>
            <Link href="/roadsync/work-requests" className="rs-btn">Back to work requests</Link>
          </div>
        ) : wr && geo ? (
          <>
            {created ? (
              <div className="mc-alert" role="status" style={{ background: "var(--status-success-bg)", borderColor: "var(--status-success-border)", color: "var(--status-success-fg)" }}>
                <CheckCircle2Icon aria-hidden="true" />
                <p>Draft work request created. It has not been submitted.</p>
              </div>
            ) : null}
            <section className="rs-hero" aria-label="Work request summary">
              <div className="rs-hero-top">
                <WorkTypeIcon type={wr.workType} />
                <h2>{WORK_TYPE_LABELS[wr.workType]}</h2>
                <StatusChip domain="work" status={wr.status} />
                <PriorityMark priority={wr.priority} />
                {wr.status !== "DRAFT" ? (
                  <span className="rs-nb-chip" role="status">
                    {wr.detection?.status === "running" ? "Scanning…" : wr.detection?.status === "failed" ? "Scan failed" : wr.detection?.status === "completed" ? "Scanned" : "Not scanned"}
                    {wr.nearbyCount > 0 ? ` · ${wr.nearbyCount} nearby` : ""}
                  </span>
                ) : null}
                {wr.status !== "DRAFT" && assessed?.summary.status === "completed" ? <a href="#conflicts" className="rs-listrisk" aria-label={`${risk.riskIndex}: ${assessed.summary.riskIndex}`}><RiskChip value={assessed.summary.riskIndex} band={assessed.summary.maxBand} copy={risk} /></a> : null}
                {wr.status !== "DRAFT" && wr.conflictRecords && wr.conflictRecords.total > 0 ? <Link href={`/roadsync/conflicts?requestId=${wr.id}`} className="rs-nb-chip">{wr.conflictRecords.needsAck > 0 ? fmt(cc.integrations.heroChip, { total: wr.conflictRecords.total, needs: wr.conflictRecords.needsAck }) : fmt(cc.integrations.heroChipNone, { total: wr.conflictRecords.total })}</Link> : null}
              </div>
              <dl className="rs-facts">
                <div><dt>Project</dt><dd>{wr.projectTitle ?? "—"}{wr.projectCode ? ` (${wr.projectCode})` : ""}</dd></div>
                <div><dt>Agency</dt><dd>{wr.agencyName ?? "—"}</dd></div>
                <div><dt>Planned start</dt><dd>{formatColombo(wr.plannedStart)}</dd></div>
                <div><dt>Planned end</dt><dd>{formatColombo(wr.plannedEnd)}</dd></div>
                <div><dt>Created</dt><dd>{formatColombo(wr.createdAt)}</dd></div>
                <div><dt>Reference</dt><dd style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: "0.8rem" }}>{wr.id}</dd></div>
              </dl>
            </section>

            {wr.status === "DRAFT" ? <div className="rs-notice" role="note">
              <InfoIcon aria-hidden="true" style={{ width: "1.1rem", height: "1.1rem", flex: "none", marginTop: "0.1rem" }} />
              <p style={{ margin: 0 }}>
                <strong>Draft work request.</strong> Drafts are not assessed for conflicts. Use the conflict preview while drafting; the full assessment runs once the request is submitted. Times are shown in Sri Lanka time.
              </p>
            </div> : null}

            <div className="rs-detail-grid">
              <section className="rs-section" aria-labelledby="rs-geo">
                <h2 id="rs-geo">Location</h2>
                {nearbyOverlay && conflictOverlay ? (
                  <div className="rs-cseg" role="group" aria-label="Map layer">
                    <button type="button" className="rs-btn" aria-pressed={layer === "conflicts"} onClick={() => setLayer("conflicts")}>{risk.tab}</button>
                    <button type="button" className="rs-btn" aria-pressed={layer === "nearby"} onClick={() => setLayer("nearby")}>Nearby</button>
                  </div>
                ) : null}
                <WorkMap features={[{ geometry: wr.geometry }]} height={300} label="Work request location map" overlay={overlay} />
                <p className="rs-help">
                  {geo.label} · {geo.vertices} {geo.vertices === 1 ? "vertex" : "vertices"}
                  {geo.lengthKm !== null ? ` · about ${geo.lengthKm.toFixed(2)} km` : ""}.
                </p>
              </section>
              <section className="rs-section" aria-labelledby="rs-coords">
                <h2 id="rs-coords">Coordinates</h2>
                <ol className="rs-coords" aria-label="Vertex list">
                  {vertices.slice(0, 200).map((p, i) => (
                    <li key={i}>{i + 1}. {formatPosition(p)}</li>
                  ))}
                </ol>
                {vertices.length > 200 ? <p className="rs-help">Showing the first 200 of {vertices.length} vertices.</p> : null}
              </section>
            </div>
            {wr.status !== "DRAFT" ? (
              <>
                <div className="rs-section" id="conflicts">
                  <ConflictsPanel requestId={wr.id} self={{ workType: wr.workType, plannedStart: wr.plannedStart, plannedEnd: wr.plannedEnd, geometry: wr.geometry }} canRun={canHintCreate(roleKey)} national={roleKey === "SUPER_ADMIN"} onOverlay={setConflictOverlay} />
                </div>
                <div className="rs-section" id="nearby">
                  <NearbyActivityPanel mode="persisted" requestId={wr.id} self={{ workType: wr.workType, plannedStart: wr.plannedStart, plannedEnd: wr.plannedEnd, geometry: wr.geometry }} canRun={canHintCreate(roleKey)} onOverlay={setNearbyOverlay} severity={severity} />
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}

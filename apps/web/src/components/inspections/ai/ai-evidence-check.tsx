"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SparklesIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAiStatus } from "@/components/ai-admin/ai-status-provider";
import { LimitBanner } from "@/components/copilot/limit-banner";
import { fetchMyAiLimits } from "@/lib/ai-admin/api";
import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import { mapAiFailure } from "@/lib/ai-admin/view";
import type { AuthLocale } from "@/lib/auth/types";
import {
  fetchVisionAnalyses,
  fetchVisionAnalysis,
  fetchVisionEligibility,
  requestVisionAnalysis,
} from "@/lib/inspections/ai/api";
import { getInspectionAiCopy } from "@/lib/inspections/ai/messages";
import type { InspectionAiAnalysisView } from "@/lib/inspections/ai/types";
import { isVisionTerminalStatus, visionPollIntervalMs } from "@/lib/inspections/ai/view";
import type { Copy as InspectionCopy } from "@/lib/inspections/messages";
import type { EvidenceItem } from "@/lib/inspections/types";

import { ErrorState, Skeletons } from "../inspection-ui";
import { AiLimitations } from "./ai-limitations";
import { AnalysisProgress } from "./analysis-progress";
import { CostEstimate } from "./cost-estimate";
import { EvidencePicker } from "./evidence-picker";
import { InsertObservationsDialog } from "./insert-observations-dialog";
import { InspectorReviewControls } from "./inspector-review-controls";
import { AnalysisPhotoDialog, AnalysisResultSections } from "./observation-card";
import { ProviderNoticeDialog } from "./provider-notice-dialog";
import { QualityChecksTable } from "./quality-checks-table";
import "@/styles/contractors.css";
import "@/styles/inspections.css";

export function AiEvidenceCheck({
  mode,
  inspectionId,
  evidence,
  inspectionCopy,
  locale,
  locked = false,
  onInsertedTexts,
}: {
  mode: "editor" | "workspace";
  inspectionId: string;
  evidence: EvidenceItem[];
  inspectionCopy: InspectionCopy;
  locale: AuthLocale;
  locked?: boolean;
  onInsertedTexts?: (texts: string[]) => void;
}) {
  const aiCopy = getInspectionAiCopy(locale);
  const aiAdminCopy = getAiAdminCopy(locale);
  const qc = useQueryClient();
  const aiStatus = useAiStatus();

  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitFailure, setSubmitFailure] = useState<{
    kind: "rate_limited" | "budget_exceeded" | "degraded" | "disabled" | "unavailable";
    message: string;
    untilMs?: number | null;
    resetsAt?: string;
  } | null>(null);
  const [dismissedPending, setDismissedPending] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState !== "hidden",
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => setIsVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const eligibilityQuery = useQuery({
    queryKey: ["inspections", inspectionId, "ai-eligibility", evidence.length],
    queryFn: ({ signal }) => fetchVisionEligibility(inspectionId, signal),
    enabled: aiStatus.canAccessAi,
    retry: false,
  });

  const analysesQuery = useQuery({
    queryKey: ["inspections", inspectionId, "ai-analyses"],
    queryFn: ({ signal }) => fetchVisionAnalyses(inspectionId, signal),
    enabled: aiStatus.canAccessAi,
    retry: false,
  });

  const limitsQuery = useQuery({
    queryKey: ["ai", "limits", "me"],
    queryFn: ({ signal }) => fetchMyAiLimits(signal),
    enabled: aiStatus.canAccessAi && !locked,
    staleTime: 20_000,
    retry: false,
  });

  const latestFromList = analysesQuery.data?.[0] ?? null;
  const activePollId = latestFromList && !isVisionTerminalStatus(latestFromList.status) ? latestFromList.id : null;

  const liveAnalysisQuery = useQuery({
    queryKey: ["inspections", inspectionId, "ai-analysis", activePollId],
    queryFn: ({ signal }) =>
      activePollId ? fetchVisionAnalysis(inspectionId, activePollId, signal) : Promise.resolve(null),
    enabled: Boolean(activePollId),
    refetchInterval: (q) => visionPollIntervalMs(q.state.data?.status ?? latestFromList?.status, isVisible),
    retry: false,
  });

  const activeAnalysis: InspectionAiAnalysisView | null = useMemo(() => {
    const polled = liveAnalysisQuery.data;
    if (polled && latestFromList && polled.id === latestFromList.id) return polled;
    return latestFromList;
  }, [latestFromList, liveAnalysisQuery.data]);

  if (!aiStatus.canAccessAi) return null;

  const eligibility = eligibilityQuery.data ?? null;
  const maxImages = eligibility?.maxImages ?? 6;
  const effectiveSelected =
    selectedIds !== null
      ? selectedIds.filter((id) =>
          (eligibility?.selectableEvidence ?? []).some((e) => e.evidenceId === id),
        )
      : (eligibility?.selectableEvidence ?? []).slice(0, maxImages).map((e) => e.evidenceId);

  const toggleEvidence = (evidenceId: string) => {
    setSelectedIds(() => {
      if (effectiveSelected.includes(evidenceId)) {
        return effectiveSelected.filter((id) => id !== evidenceId);
      }
      if (effectiveSelected.length >= maxImages) return effectiveSelected;
      return [...effectiveSelected, evidenceId];
    });
  };

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ["inspections", inspectionId, "ai-analyses"] });
    void qc.invalidateQueries({ queryKey: ["inspections", inspectionId, "ai-eligibility"] });
    void qc.invalidateQueries({ queryKey: ["ai", "limits", "me"] });
  };

  const handleConfirmRun = async () => {
    if (effectiveSelected.length === 0 || submitting) return;
    setSubmitting(true);
    setSubmitFailure(null);
    setDismissedPending(false);
    try {
      await requestVisionAnalysis(inspectionId, {
        evidenceIds: effectiveSelected,
        acknowledgedProvider: true,
      });
      setNoticeOpen(false);
      refreshAll();
    } catch (err) {
      setNoticeOpen(false);
      const mapped = mapAiFailure(err, aiAdminCopy, locale);
      const kind: "rate_limited" | "budget_exceeded" | "degraded" | "disabled" | "unavailable" =
        mapped.code === "AI_RATE_LIMITED"
          ? "rate_limited"
          : mapped.code === "AI_BUDGET_EXCEEDED"
            ? "budget_exceeded"
            : mapped.code === "FEATURE_DISABLED"
              ? "disabled"
              : "unavailable";
      setSubmitFailure({
        kind,
        message: mapped.message,
        untilMs: mapped.retryAfterSeconds ? Date.now() + mapped.retryAfterSeconds * 1000 : null,
        resetsAt: mapped.resetsAt,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const visionStatus = aiStatus.getFeatureStatus("vision");
  const activeEvidenceIds = new Set(evidence.filter((e) => e.status === "ACTIVE").map((e) => e.id));
  const deterministicQuality = activeAnalysis?.qualityChecks ?? eligibility?.qualityPreview ?? null;
  const canPickAndRun = Boolean(
    !locked &&
      eligibility?.visionEnabled &&
      eligibility.eligible &&
      eligibility.role === "INSPECTOR" &&
      eligibility.selectableEvidence.length > 0 &&
      visionStatus !== "disabled" &&
      visionStatus !== "unavailable",
  );

  const canInspectorReview = Boolean(
    !locked &&
      eligibility?.role === "INSPECTOR" &&
      activeAnalysis?.status === "READY" &&
      activeAnalysis.requestedByRole === "INSPECTOR",
  );

  return (
    <section className="ins-ai-advisory" aria-label={aiCopy.cardTitle}>
      <div className="ins-ai-advisory-banner">
        <span className="ctr-row" style={{ gap: "0.4rem" }}>
          <SparklesIcon aria-hidden="true" style={{ width: "1rem", height: "1rem" }} />
          <strong>{aiCopy.cardTitle}</strong>
        </span>
        <span>{aiCopy.advisoryBanner} — {aiCopy.advisoryNote}</span>
      </div>

      {eligibilityQuery.isPending && analysesQuery.isPending ? <Skeletons n={2} /> : null}
      {eligibilityQuery.isError ? (
        <ErrorState error={eligibilityQuery.error} copy={inspectionCopy} onRetry={() => void eligibilityQuery.refetch()} />
      ) : null}

      {eligibility && !eligibility.visionEnabled ? (
        <div className="ai-limit-banner" data-tone="warning" role="status">
          {aiCopy.disabled.visionOff}
        </div>
      ) : visionStatus === "disabled" ? (
        <LimitBanner kind="disabled" locale={locale} messageOverride={aiCopy.disabled.visionOff} />
      ) : visionStatus === "unavailable" ? (
        <LimitBanner kind="unavailable" locale={locale} messageOverride={aiCopy.disabled.aiUnavailable} />
      ) : null}

      {submitFailure ? (
        <LimitBanner
          kind={submitFailure.kind}
          locale={locale}
          untilMs={submitFailure.untilMs}
          resetsAt={submitFailure.resetsAt}
          messageOverride={submitFailure.message}
        />
      ) : null}

      {eligibility && eligibility.visionEnabled && !eligibility.eligible && !locked ? (
        <p className="ins-muted" style={{ margin: 0, fontSize: "0.86rem" }}>
          {eligibility.selectableEvidence.length === 0
            ? aiCopy.disabled.noEvidence
            : aiCopy.disabled.notEligible}
        </p>
      ) : null}

      {deterministicQuality && (!activeAnalysis || activeAnalysis.status !== "READY") ? (
        <QualityChecksTable qualityChecks={deterministicQuality} copy={aiCopy} />
      ) : null}

      {canPickAndRun && eligibility ? (
        <div className="ins-panel" style={{ display: "grid", gap: "0.75rem" }}>
          <EvidencePicker
            selectableEvidence={eligibility.selectableEvidence}
            selectedIds={effectiveSelected}
            maxImages={maxImages}
            qualityPreview={eligibility.qualityPreview}
            onToggle={toggleEvidence}
            aiCopy={aiCopy}
            inspectionCopy={inspectionCopy}
            disabled={submitting}
          />

          <CostEstimate
            selectedCount={effectiveSelected.length}
            maxImages={maxImages}
            estimatedCostUnits={Math.max(1, effectiveSelected.length)}
            limits={limitsQuery.data ?? null}
            copy={aiCopy}
          />

          <div className="ctr-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="ctr-btn is-primary"
              disabled={effectiveSelected.length === 0 || submitting}
              onClick={() => setNoticeOpen(true)}
            >
              <SparklesIcon aria-hidden="true" />
              <span>{aiCopy.picker.runCheck}</span>
            </button>
          </div>
        </div>
      ) : null}

      {activeAnalysis && (activeAnalysis.status === "QUEUED" || activeAnalysis.status === "RUNNING") && !dismissedPending ? (
        <AnalysisProgress
          analysis={activeAnalysis}
          copy={aiCopy}
          locale={locale}
          onContinueManually={() => setDismissedPending(true)}
        />
      ) : null}

      {activeAnalysis && activeAnalysis.status === "FAILED" && !dismissedPending ? (
        <AnalysisProgress
          analysis={activeAnalysis}
          copy={aiCopy}
          locale={locale}
          onRetry={canPickAndRun ? () => setNoticeOpen(true) : undefined}
          onContinueManually={() => setDismissedPending(true)}
        />
      ) : null}

      {activeAnalysis && activeAnalysis.status === "READY" ? (
        <>
          <AnalysisResultSections
            analysis={activeAnalysis}
            aiCopy={aiCopy}
            onOpenPhoto={(n) => setLightboxPhoto(n)}
          />

          {canInspectorReview ? (
            <InspectorReviewControls
              key={`${activeAnalysis.id}:${activeAnalysis.inspectorReview.reviewedAt ?? "pending"}`}
              inspectionId={inspectionId}
              analysis={activeAnalysis}
              copy={aiCopy}
              canInsert={mode === "editor" && Boolean(onInsertedTexts)}
              onSaved={() => refreshAll()}
              onOpenInsert={() => setInsertOpen(true)}
            />
          ) : null}
        </>
      ) : null}

      <AiLimitations copy={aiCopy} />

      {eligibility ? (
        <ProviderNoticeDialog
          open={noticeOpen}
          photoCount={effectiveSelected.length}
          copy={aiCopy}
          busy={submitting}
          onOpenChange={setNoticeOpen}
          onConfirm={() => void handleConfirmRun()}
        />
      ) : null}

      {activeAnalysis && onInsertedTexts ? (
        <InsertObservationsDialog
          open={insertOpen}
          inspectionId={inspectionId}
          analysis={activeAnalysis}
          copy={aiCopy}
          onOpenChange={setInsertOpen}
          onInserted={(texts) => {
            refreshAll();
            onInsertedTexts(texts);
          }}
        />
      ) : null}

      {activeAnalysis && lightboxPhoto !== null ? (
        <AnalysisPhotoDialog
          analysis={activeAnalysis}
          photoNumber={lightboxPhoto}
          activeEvidenceIds={activeEvidenceIds}
          aiCopy={aiCopy}
          inspectionCopy={inspectionCopy}
          onClose={() => setLightboxPhoto(null)}
        />
      ) : null}
    </section>
  );
}

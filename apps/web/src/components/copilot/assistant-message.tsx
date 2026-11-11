"use client";

import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  CheckIcon,
  ClipboardCopyIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldHalfIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/inspections/inspection-ui";
import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import { formatDateTime } from "@/lib/ai-admin/view";
import type { AuthLocale } from "@/lib/auth/types";
import { submitCopilotFeedback } from "@/lib/copilot/api";
import type { CopilotMessages } from "@/lib/copilot/messages";
import type { CopilotTurnDto, FeedbackReason } from "@/lib/copilot/types";
import { splitCitationSegments } from "@/lib/copilot/view";

import { AnswerSources } from "./answer-sources";
import { LookedAtSteps } from "./looked-at-steps";
import { NavigationLinks } from "./navigation-links";

import "@/styles/contractors.css";
import "@/styles/doctrace-ai-rag.css";

const REASONS: readonly FeedbackReason[] = ["WRONG", "MISSING_SOURCE", "OUTDATED", "UNCLEAR", "OTHER"];

function statusBadgeProps(status: CopilotTurnDto["status"]): {
  tone: "success" | "pending" | "critical" | "neutral";
  Icon: typeof ShieldCheckIcon;
} {
  if (status === "ANSWERED") return { tone: "success", Icon: ShieldCheckIcon };
  if (status === "PARTIAL") return { tone: "pending", Icon: ShieldHalfIcon };
  if (status === "INSUFFICIENT_EVIDENCE") return { tone: "pending", Icon: ShieldAlertIcon };
  if (status === "CANCELLED") return { tone: "neutral", Icon: AlertTriangleIcon };
  return { tone: "critical", Icon: XCircleIcon };
}

export function AssistantMessage({
  turn,
  copy,
  locale,
  busy,
  onRetry,
  onFollowUp,
  onNavigate,
}: {
  turn: CopilotTurnDto;
  copy: CopilotMessages;
  locale: AuthLocale;
  busy: boolean;
  onRetry: (turn: CopilotTurnDto) => void;
  onFollowUp: (prompt: string) => void;
  onNavigate?: () => void;
}) {
  const aiCopy = getAiAdminCopy(locale);
  const [selectedRef, setSelectedRef] = useState<number | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(turn.evidence?.level === "PARTIAL");
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<string | null>(turn.feedback?.rating ?? null);
  const [reasonOpen, setReasonOpen] = useState(false);

  const feedbackMutation = useMutation({
    mutationFn: (payload: { rating: "HELPFUL" | "NOT_HELPFUL"; reason?: FeedbackReason }) =>
      submitCopilotFeedback(turn.id, payload),
    onSuccess: (_data, vars) => {
      setRating(vars.rating);
      setReasonOpen(false);
      toast.success(copy.answer.feedbackSaved);
    },
    onError: () => {
      toast.error(aiCopy.failures.GENERIC);
    },
  });

  const { tone, Icon } = statusBadgeProps(turn.status);
  const evidenceLevel = turn.evidence?.level ?? "NONE";
  const hasAnswer = Boolean(turn.answer?.text) && (turn.status === "ANSWERED" || turn.status === "PARTIAL");
  const hasDeniedStep = turn.steps.some((s) => s.status === "DENIED");
  const bySourceRef = new Map(turn.sources.map((s) => [s.n, s]));

  const errKey = turn.errorCode as keyof typeof aiCopy.failures | undefined;
  const errMessage = errKey && errKey in aiCopy.failures ? aiCopy.failures[errKey] : null;

  const doCopy = async () => {
    const raw = turn.answer?.text ?? "";
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(aiCopy.failures.GENERIC);
    }
  };

  return (
    <article className="ai-answer" data-status={turn.status} aria-label={copy.header.title}>
      <div className="ai-rail" data-level={evidenceLevel} aria-hidden="true" />
      <div className="ai-body">
        <header className="ctr-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
          <Chip tone={tone} icon={<Icon aria-hidden="true" />}>
            {copy.status[turn.status] ?? turn.status}
          </Chip>
          <span className="ctr-muted ctr-num" style={{ fontSize: "0.75rem" }}>
            {formatDateTime(turn.createdAt, locale)}
          </span>
        </header>

        {hasAnswer && turn.answer ? (
          <div className="ai-text">
            {turn.answer.text.split("\n").map((line, i) => (
              <p key={i}>
                {splitCitationSegments(line).map((seg, j) => {
                  if (seg.kind === "text") return <span key={j}>{seg.value}</span>;
                  return (
                    <span key={j} className="ai-cites">
                      {seg.nums.map((n) => {
                        const src = bySourceRef.get(n);
                        return (
                          <button
                            key={n}
                            type="button"
                            className="ai-cite"
                            aria-pressed={selectedRef === n}
                            title={src?.label ?? `[${n}]`}
                            onClick={() => setSelectedRef((prev) => (prev === n ? null : n))}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </span>
                  );
                })}
              </p>
            ))}
          </div>
        ) : null}

        {!hasAnswer && turn.status === "INSUFFICIENT_EVIDENCE" ? (
          <div className="ai-note" role="status">
            <ShieldAlertIcon aria-hidden="true" />
            <span>{copy.answer.noAnswerFallback}</span>
          </div>
        ) : null}

        {(turn.status === "FAILED" || turn.status === "CANCELLED" || turn.status === "BLOCKED_BY_POLICY") ? (
          <p className="ctr-small" role="status">
            {errMessage ?? copy.answer.noAnswerFallback}
          </p>
        ) : null}

        {hasDeniedStep ? (
          <div className="ai-note" role="status">
            <AlertTriangleIcon aria-hidden="true" />
            <span>{copy.answer.accessLimitation}</span>
          </div>
        ) : null}

        <AnswerSources
          sources={turn.sources}
          selectedRef={selectedRef}
          onSelectRef={(n) => setSelectedRef((prev) => (prev === n ? null : n))}
          onNavigate={onNavigate}
          copy={copy}
          locale={locale}
        />

        <NavigationLinks sources={turn.sources} copy={copy} onNavigate={onNavigate} />

        {turn.evidence && (turn.status === "ANSWERED" || turn.status === "PARTIAL") ? (
          <section className="ai-evidence" data-level={turn.evidence.level} aria-label={copy.answer.evidenceTitle}>
            <button
              type="button"
              className="ai-evidence-head"
              aria-expanded={evidenceOpen}
              onClick={() => setEvidenceOpen((v) => !v)}
            >
              {turn.evidence.level === "VERIFIED" ? (
                <ShieldCheckIcon aria-hidden="true" />
              ) : turn.evidence.level === "PARTIAL" ? (
                <ShieldHalfIcon aria-hidden="true" />
              ) : (
                <ShieldAlertIcon aria-hidden="true" />
              )}
              <strong>{copy.answer.evidenceTitle}</strong>
            </button>
            {evidenceOpen ? (
              <ul>
                <li>
                  {turn.evidence.level === "VERIFIED"
                    ? copy.answer.evidenceLevelVERIFIED
                    : turn.evidence.level === "PARTIAL"
                      ? copy.answer.evidenceLevelPARTIAL
                      : copy.answer.evidenceLevelNONE}
                </li>
                {turn.evidence.droppedClaims > 0 ? (
                  <li>{copy.answer.droppedClaimsNote.replace("{n}", String(turn.evidence.droppedClaims))}</li>
                ) : null}
                {turn.evidence.unverifiedFigures.length > 0 ? (
                  <li>
                    {copy.answer.unverifiedFiguresNote.replace("{figs}", turn.evidence.unverifiedFigures.join(", "))}
                  </li>
                ) : null}
              </ul>
            ) : null}
          </section>
        ) : null}

        <LookedAtSteps steps={turn.steps} copy={copy} />

        <div className="ctr-row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
          {hasAnswer ? (
            <button type="button" className="ctr-btn is-ghost" onClick={() => void doCopy()}>
              {copied ? <CheckIcon aria-hidden="true" /> : <ClipboardCopyIcon aria-hidden="true" />}
              <span>{copied ? copy.answer.copied : copy.answer.copy}</span>
            </button>
          ) : null}
          {turn.status === "FAILED" || turn.status === "CANCELLED" ? (
            <button type="button" className="ctr-btn" disabled={busy} onClick={() => onRetry(turn)}>
              <RefreshCwIcon aria-hidden="true" />
              <span>{copy.answer.retry}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="ctr-btn is-ghost"
            onClick={() => onFollowUp(turn.message ? `${turn.message} — ` : "")}
          >
            {copy.answer.followUp}
          </button>
          {hasAnswer ? (
            <div className="ctr-row" style={{ gap: "0.25rem" }}>
              <button
                type="button"
                className="ctr-btn is-ghost"
                aria-pressed={rating === "HELPFUL"}
                disabled={feedbackMutation.isPending}
                onClick={() => feedbackMutation.mutate({ rating: "HELPFUL" })}
              >
                <ThumbsUpIcon aria-hidden="true" />
                <span>{copy.answer.helpful}</span>
              </button>
              <button
                type="button"
                className="ctr-btn is-ghost"
                aria-pressed={rating === "NOT_HELPFUL"}
                aria-expanded={reasonOpen}
                disabled={feedbackMutation.isPending}
                onClick={() => setReasonOpen((v) => !v)}
              >
                <ThumbsDownIcon aria-hidden="true" />
                <span>{copy.answer.notHelpful}</span>
              </button>
            </div>
          ) : null}
        </div>

        {reasonOpen ? (
          <div className="ai-reasons" role="group" aria-label={copy.answer.feedbackReasonTitle}>
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                className="ctr-chip-btn"
                disabled={feedbackMutation.isPending}
                onClick={() => feedbackMutation.mutate({ rating: "NOT_HELPFUL", reason: r })}
              >
                {copy.answer.feedbackReasons[r]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

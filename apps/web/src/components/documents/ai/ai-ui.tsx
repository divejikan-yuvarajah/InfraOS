"use client";

import {
  AlertTriangleIcon, BanIcon, CheckCircle2Icon, CircleDashedIcon, CircleSlashIcon, ClockIcon, FileSearchIcon, FileXIcon, Loader2Icon, MinusCircleIcon, ScanLineIcon, ShieldCheckIcon, XCircleIcon, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { AiStageStatus, AiWarningCode } from "@infraos/shared-types";

import { Chip } from "@/components/inspections/inspection-ui";
import type { AiCopy } from "@/lib/documents/ai/messages";
import { chipKind, stageStates, type ChipKind, type ListAi } from "@/lib/documents/ai/view";
import type { AiJob } from "@/lib/documents/ai/types";
import { fill, fmtDate } from "@/lib/documents/view";
import type { AuthLocale } from "@/lib/auth/types";

import "@/styles/doctrace-ai.css";

type Tone = "success" | "pending" | "critical" | "neutral" | "active";
const CHIP: Record<ChipKind, { tone: Tone; Icon: LucideIcon }> = {
  READY: { tone: "success", Icon: ShieldCheckIcon }, ATTENTION: { tone: "pending", Icon: AlertTriangleIcon }, QUEUED: { tone: "active", Icon: ClockIcon }, PROCESSING: { tone: "active", Icon: Loader2Icon },
  FAILED: { tone: "critical", Icon: XCircleIcon }, UNSUPPORTED: { tone: "neutral", Icon: FileXIcon }, SCANNED: { tone: "pending", Icon: ScanLineIcon }, EXCLUDED: { tone: "neutral", Icon: BanIcon },
  NOT_ELIGIBLE: { tone: "neutral", Icon: CircleSlashIcon }, NOT_PROCESSED: { tone: "neutral", Icon: CircleDashedIcon },
};

/** One status chip for every surface (table, grid, cards, drawer, linked panels). Icon + text, never colour alone. Optionally links to the document's AI tab. */
export function AiChip({ ai, aiCopy, locale, docId, stage }: { ai: ListAi; aiCopy: AiCopy; locale: AuthLocale; docId?: string; stage?: string | null }) {
  const kind = chipKind(ai);
  const { tone, Icon } = CHIP[kind];
  const c = aiCopy.chip;
  const label = { READY: c.ready, ATTENTION: c.attention, QUEUED: c.queued, PROCESSING: fill(c.processing, { stage: stage ? (aiCopy.stage as Record<string, string>)[stage] ?? stage : "…" }), FAILED: c.failed, UNSUPPORTED: c.unsupported, SCANNED: c.scanned, EXCLUDED: c.excluded, NOT_ELIGIBLE: c.notEligible, NOT_PROCESSED: c.notProcessed }[kind];
  const tip = { READY: fill(c.tipReady, { date: fmtDate(ai.indexedAt, locale) }), ATTENTION: c.tipAttention, QUEUED: c.tipQueued, PROCESSING: c.tipProcessing, FAILED: c.tipFailed, UNSUPPORTED: c.tipUnsupported, SCANNED: c.tipScanned, EXCLUDED: c.tipExcluded, NOT_ELIGIBLE: c.tipNotEligible, NOT_PROCESSED: c.tipNotProcessed }[kind];
  const chip = <Chip tone={tone} title={tip} icon={<Icon aria-hidden="true" />}>{label}</Chip>;
  return docId ? <Link className="ai-chip" href={`/documents/${docId}?tab=ai`} aria-label={`${label}. ${tip}`}>{chip}</Link> : <span className="ai-chip" role="status" aria-live="polite">{chip}</span>;
}

const STEP_ICON: Record<AiStageStatus, LucideIcon> = { DONE: CheckCircle2Icon, RUNNING: Loader2Icon, FAILED: XCircleIcon, SKIPPED: MinusCircleIcon, PENDING: CircleDashedIcon };

/** Extract -> Chunk -> Embed -> Index, with an explicit text state per stage and an aria-live announcement of changes. */
export function PipelineStepper({ job, indexed, aiCopy }: { job: Pick<AiJob, "stages" | "status"> | null; indexed: boolean; aiCopy: AiCopy }) {
  const states = stageStates(job, indexed);
  return (
    <ol className="ai-steps" aria-label={aiCopy.aria.stepper} aria-live="polite">
      {states.map((s, i) => {
        const Icon = STEP_ICON[s.status];
        return (
          <li key={s.key} className="ai-step" data-state={s.status} aria-current={s.status === "RUNNING" ? "step" : undefined}>
            <b><Icon aria-hidden="true" />{i + 1}. {aiCopy.stage[s.key]}</b>
            <small>{aiCopy.stageState[s.status]}</small>
          </li>
        );
      })}
    </ol>
  );
}

export function WarningList({ warnings, aiCopy }: { warnings: AiWarningCode[]; aiCopy: AiCopy }) {
  if (!warnings.length) return null;
  return (
    <div style={{ display: "grid", gap: "0.5rem" }} role="list">
      {warnings.map((w) => (
        <div key={w} className="ai-warn" role="listitem">
          <b><AlertTriangleIcon aria-hidden="true" />{(aiCopy.warning as Record<string, string>)[w] ?? w}</b>
          <span className="ins-muted">{(aiCopy.warningHelp as Record<string, string>)[w] ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

export const ServiceBanner = ({ aiCopy, kind }: { aiCopy: AiCopy; kind: "down" | "unconfigured" }) => (
  <div className="ai-banner" role="status"><FileSearchIcon aria-hidden="true" />{kind === "down" ? aiCopy.center.banner.down : aiCopy.center.banner.unconfigured}</div>
);

export function durationLabel(aiCopy: AiCopy, seconds: number | null): string {
  if (seconds === null) return aiCopy.common.none;
  return seconds >= 60 ? fill(aiCopy.panel.durationMin, { m: Math.floor(seconds / 60), s: seconds % 60 }) : fill(aiCopy.panel.duration, { s: seconds });
}

"use client";

import { useCallback, useId, useState } from "react";

import { LifecycleStageIcon } from "@/components/landing/lifecycle-stage-icon";
import { PublicRouteLine } from "@/components/landing/public-route-line";
import { LIFECYCLE_STAGE_IDS, type LifecycleStageId } from "@/lib/landing/lifecycle-stages";
import { cn } from "@/lib/utils";

export type LifecycleStepperStage = {
  id: LifecycleStageId;
  title: string;
  /** One-sentence summary — emphasized on focus/hover in horizontal mode */
  summary: string;
};

type LifecycleStepperProps = {
  stages: readonly LifecycleStepperStage[];
  variant: "vertical" | "horizontal" | "compact";
  labelledBy?: string;
  scrollTargetPrefix?: string;
  className?: string;
};

export function LifecycleStepper({
  stages,
  variant,
  labelledBy,
  scrollTargetPrefix,
  className,
}: LifecycleStepperProps) {
  const baseId = useId();
  const ordered = LIFECYCLE_STAGE_IDS.map((id) => stages.find((s) => s.id === id)).filter(
    Boolean,
  ) as LifecycleStepperStage[];

  const [activeId, setActiveId] = useState<LifecycleStageId | null>(null);
  const reveal = useCallback((id: LifecycleStageId) => setActiveId(id), []);
  const hide = useCallback(() => setActiveId(null), []);

  if (variant === "compact") {
    return (
      <nav
        aria-labelledby={labelledBy}
        className={cn("flex flex-wrap items-center gap-2", className)}
      >
        {ordered.map((stage, index) => (
          <span key={stage.id} className="inline-flex items-center gap-2">
            {index > 0 ? (
              <PublicRouteLine orientation="horizontal" className="max-w-[1.25rem] opacity-60" />
            ) : null}
            <span
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 type-caption text-text-secondary"
              title={stage.summary}
            >
              <LifecycleStageIcon stageId={stage.id} className="size-3.5 text-link" />
              <span>{stage.title}</span>
            </span>
          </span>
        ))}
      </nav>
    );
  }

  if (variant === "horizontal") {
    return (
      <ol
        aria-labelledby={labelledBy}
        className={cn(
          "flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin]",
          className,
        )}
      >
        {ordered.map((stage, index) => {
          const active = activeId === stage.id;
          const detailId = `${baseId}-${stage.id}-detail`;
          return (
            <li key={stage.id} className="flex min-w-[9rem] max-w-[11rem] shrink-0 flex-col gap-2">
              <button
                type="button"
                className={cn(
                  "public-motion-interactive flex flex-1 flex-col gap-2 rounded-lg border bg-surface p-3 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active ? "border-link shadow-elevation-sm" : "border-border",
                )}
                aria-expanded={active}
                aria-controls={detailId}
                onMouseEnter={() => reveal(stage.id)}
                onMouseLeave={hide}
                onFocus={() => reveal(stage.id)}
                onBlur={hide}
                onClick={() => {
                  const target = scrollTargetPrefix
                    ? `${scrollTargetPrefix}-${stage.id}`
                    : undefined;
                  if (target) {
                    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
              >
                <span className="flex size-9 items-center justify-center rounded-full border border-border text-link">
                  <LifecycleStageIcon stageId={stage.id} className="size-4" />
                </span>
                <span className="type-label text-text-primary">{stage.title}</span>
                <span
                  id={detailId}
                  className={cn(
                    "type-caption text-text-secondary",
                    !active && "sr-only",
                  )}
                >
                  {stage.summary}
                </span>
              </button>
              {index < ordered.length - 1 ? (
                <PublicRouteLine orientation="horizontal" className="opacity-40" decorative />
              ) : null}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol aria-labelledby={labelledBy} className={cn("atlas-route list-none space-y-0 p-0", className)}>
      {ordered.map((stage) => {
        const active = activeId === stage.id;
        const detailId = `${baseId}-${stage.id}-detail`;
        return (
          <li
            key={stage.id}
            id={scrollTargetPrefix ? `${scrollTargetPrefix}-${stage.id}` : undefined}
            className="atlas-route-stop grid grid-cols-[auto_minmax(0,1fr)] gap-4"
          >
            <span className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-link">
              <LifecycleStageIcon stageId={stage.id} className="size-5" />
            </span>
            <div className="min-w-0 pb-8">
              <button
                type="button"
                className="public-motion-interactive rounded-md text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-expanded={active}
                aria-controls={detailId}
                onMouseEnter={() => reveal(stage.id)}
                onMouseLeave={hide}
                onFocus={() => reveal(stage.id)}
                onBlur={hide}
              >
                <h3 className="type-card-title text-text-primary">{stage.title}</h3>
              </button>
              <p
                id={detailId}
                className={cn(
                  "type-body-small mt-2 max-w-prose text-text-secondary",
                  active && "text-text-primary",
                )}
              >
                {stage.summary}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

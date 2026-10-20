"use client";

import { useState } from "react";

import { AsyncContent } from "@/components/feedback/async-content";
import { ContentSkeleton } from "@/components/feedback/content-skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorStateFromPresentation } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { SuccessState } from "@/components/feedback/success-state";
import { Button } from "@/components/ui/button";
import { presentApiFailure } from "@/lib/api/error-presentation";

const SCENARIOS = [
  "loading",
  "skeleton",
  "refreshing",
  "empty",
  "no-results",
  "success",
  "403",
  "404",
  "429",
  "5xx",
  "network",
] as const;

type Scenario = (typeof SCENARIOS)[number];

export function FeedbackPreview() {
  const [scenario, setScenario] = useState<Scenario>("empty");
  const [retryCount, setRetryCount] = useState(0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={scenario === item ? "default" : "outline"}
            onClick={() => setScenario(item)}
          >
            {item}
          </Button>
        ))}
      </div>

      {scenario === "loading" ? <LoadingState label="Loading section" /> : null}
      {scenario === "skeleton" ? <ContentSkeleton variant="card" /> : null}
      {scenario === "refreshing" ? (
        <AsyncContent isRefreshing>
          <p className="type-body-small text-text-secondary">
            Prior results remain visible while an inline update runs.
          </p>
        </AsyncContent>
      ) : null}
      {scenario === "empty" ? <EmptyState /> : null}
      {scenario === "no-results" ? (
        <EmptyState variant="no-results" onClearFilters={() => setRetryCount((n) => n + 1)} />
      ) : null}
      {scenario === "success" ? (
        <SuccessState
          title="Request submitted"
          description="Waiting for authorized review. This is not an approval."
        />
      ) : null}
      {scenario === "403" ? (
        <ErrorStateFromPresentation
          presentation={presentApiFailure({
            success: false,
            error: { code: "FORBIDDEN", message: "secret agency id", details: null },
            meta: { requestId: "req-demo-403" },
          })}
        />
      ) : null}
      {scenario === "404" ? (
        <ErrorStateFromPresentation
          presentation={presentApiFailure({
            success: false,
            error: { code: "RESOURCE_NOT_FOUND", message: "INF-SECRET", details: null },
            meta: { requestId: "req-demo-404" },
          })}
        />
      ) : null}
      {scenario === "429" ? (
        <ErrorStateFromPresentation
          presentation={presentApiFailure({
            success: false,
            error: { code: "RATE_LIMITED", message: "token", details: null },
            meta: { requestId: "req-demo-429" },
          })}
          onRetry={() => setRetryCount((n) => n + 1)}
        />
      ) : null}
      {scenario === "5xx" ? (
        <ErrorStateFromPresentation
          presentation={presentApiFailure({
            success: false,
            error: { code: "INTERNAL_ERROR", message: "stack", details: null },
            meta: { requestId: "req-demo-500" },
          })}
          onRetry={() => setRetryCount((n) => n + 1)}
        />
      ) : null}
      {scenario === "network" ? (
        <AsyncContent error={new TypeError("Failed to fetch")} onRetry={() => setRetryCount((n) => n + 1)}>
          <span>hidden</span>
        </AsyncContent>
      ) : null}

      <p className="type-caption text-text-muted">Retry taps (demo only): {retryCount}</p>
    </div>
  );
}

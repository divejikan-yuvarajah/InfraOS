"use client";

import { AlertCircleIcon } from "lucide-react";

import { FeedbackState } from "@/components/feedback/feedback-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { FeedbackPresentation } from "@/lib/api/error-presentation";

export function ErrorState({
  title,
  description,
  onRetry,
  requestId,
  layout = "panel",
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
  requestId?: string;
  layout?: "panel" | "alert";
}) {
  if (layout === "alert") {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>{title}</AlertTitle>
        {description ? <AlertDescription>{description}</AlertDescription> : null}
        {onRetry ? (
          <div className="mt-3">
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : null}
        {requestId ? (
          <p className="type-caption mt-2 text-text-muted">Reference: {requestId}</p>
        ) : null}
      </Alert>
    );
  }

  return (
    <FeedbackState
      role="alert"
      icon={<AlertCircleIcon className="text-status-critical-fg" />}
      title={title}
      description={
        requestId ? `${description ?? ""}${description ? " " : ""}(Reference: ${requestId})`.trim() : description
      }
      actions={
        onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : null
      }
    />
  );
}

export function ErrorStateFromPresentation({
  presentation,
  onRetry,
  layout = "panel",
}: {
  presentation: FeedbackPresentation;
  onRetry?: () => void;
  layout?: "panel" | "alert";
}) {
  if (presentation.kind === "validation-delegate") {
    return null;
  }
  return (
    <ErrorState
      layout={layout}
      title={presentation.title}
      description={presentation.description}
      requestId={presentation.requestId}
      onRetry={presentation.showRetry ? onRetry : undefined}
    />
  );
}

"use client";

import type { ReactNode } from "react";

import { ContentSkeleton } from "@/components/feedback/content-skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorStateFromPresentation } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import {
  presentApiFailure,
  presentUnknownError,
  type FeedbackPresentation,
} from "@/lib/api/error-presentation";
import type { ApiFailure } from "@infraos/shared-types";

export function AsyncContent({
  isLoading = false,
  isRefreshing = false,
  error,
  apiFailure,
  presentation,
  isEmpty = false,
  isNoResults = false,
  onRetry,
  onClearFilters,
  loadingLabel = "Loading",
  skeletonVariant = "section",
  children,
}: {
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: unknown;
  apiFailure?: ApiFailure;
  presentation?: FeedbackPresentation;
  isEmpty?: boolean;
  isNoResults?: boolean;
  onRetry?: () => void;
  onClearFilters?: () => void;
  loadingLabel?: string;
  skeletonVariant?: "card" | "list" | "section";
  children: ReactNode;
}) {
  const resolvedPresentation =
    presentation ??
    (apiFailure ? presentApiFailure(apiFailure) : error ? presentUnknownError(error) : undefined);

  if (isLoading) {
    return <ContentSkeleton variant={skeletonVariant} label={loadingLabel} />;
  }

  if (resolvedPresentation && resolvedPresentation.kind !== "validation-delegate") {
    return <ErrorStateFromPresentation presentation={resolvedPresentation} onRetry={onRetry} />;
  }

  if (isEmpty) {
    return <EmptyState variant="empty" />;
  }

  if (isNoResults) {
    return <EmptyState variant="no-results" onClearFilters={onClearFilters} />;
  }

  return (
    <div className="relative grid gap-3" aria-busy={isRefreshing || undefined}>
      {isRefreshing ? (
        <LoadingState variant="inline" label="Updating…" className="justify-start" />
      ) : null}
      {children}
    </div>
  );
}

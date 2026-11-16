"use client";

import type { ReactNode } from "react";
import { InboxIcon, SearchXIcon, ShieldOffIcon } from "lucide-react";

import { FeedbackState } from "@/components/feedback/feedback-state";
import { MotifIllustration } from "@/components/motif/connected-motif";
import { Button } from "@/components/ui/button";

export type EmptyStateVariant = "empty" | "no-results" | "forbidden" | "not-found";

const VARIANT_META: Record<
  EmptyStateVariant,
  {
    icon: typeof InboxIcon;
    motif: "no-projects" | "all-clear" | "unavailable";
    defaultTitle: string;
    defaultDescription?: string;
  }
> = {
  empty: {
    icon: InboxIcon,
    motif: "no-projects",
    defaultTitle: "No records available",
    defaultDescription: "There is nothing to show yet.",
  },
  "no-results": {
    icon: SearchXIcon,
    motif: "all-clear",
    defaultTitle: "No matching results",
    defaultDescription: "Try changing filters or search terms.",
  },
  forbidden: {
    icon: ShieldOffIcon,
    motif: "unavailable",
    defaultTitle: "Access not available",
    defaultDescription: "You do not have permission to view this content.",
  },
  "not-found": {
    icon: SearchXIcon,
    motif: "unavailable",
    defaultTitle: "Record not available",
    defaultDescription: "The requested record could not be found.",
  },
};

export function EmptyState({
  variant = "empty",
  title,
  description,
  action,
  onClearFilters,
}: {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  action?: ReactNode;
  onClearFilters?: () => void;
}) {
  const meta = VARIANT_META[variant];

  return (
    <FeedbackState
      icon={<MotifIllustration kind={meta.motif} className="h-16 w-28" />}
      title={title ?? meta.defaultTitle}
      description={description ?? meta.defaultDescription}
      role="status"
      actions={
        <>
          {variant === "no-results" && onClearFilters ? (
            <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null}
          {action}
        </>
      }
    />
  );
}

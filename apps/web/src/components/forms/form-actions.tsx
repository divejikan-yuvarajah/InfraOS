"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function FormActions({
  submitLabel,
  resetLabel = "Reset",
  onReset,
  isSubmitting,
  children,
}: {
  submitLabel: string;
  resetLabel?: string;
  onReset?: () => void;
  isSubmitting?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" loading={isSubmitting} aria-busy={isSubmitting || undefined}>
        {isSubmitting ? "Submitting" : submitLabel}
      </Button>
      {onReset ? (
        <Button type="button" variant="outline" onClick={onReset} disabled={isSubmitting}>
          {resetLabel}
        </Button>
      ) : null}
      {children}
    </div>
  );
}

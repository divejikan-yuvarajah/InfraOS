import type {
  ConflictSeverity,
  ConflictStatus,
  ProjectStatus,
  WorkStatus,
} from "@infraos/shared-types";

import { Badge, type badgeVariants } from "@/components/ui/badge";
import {
  conflictSeverityVisual,
  conflictStatusVisual,
  projectStatusVisual,
  workStatusVisual,
  type StatusBadgeVariant,
} from "@/lib/design/semantic-colors";
import { cn } from "cn";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

function formatStatusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export type StatusBadgeProps = {
  variant: StatusBadgeVariant;
  label: string;
  className?: string;
};

/** Low-level status badge with explicit variant + label (always include text). */
export function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  return (
    <Badge variant={variant as BadgeVariant} className={cn(className)}>
      {label}
    </Badge>
  );
}

export function ProjectStatusBadge({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}) {
  const variant = projectStatusVisual(status);
  return (
    <StatusBadge
      variant={variant}
      label={formatStatusLabel(status)}
      className={className}
    />
  );
}

export function WorkStatusBadge({
  status,
  className,
}: {
  status: WorkStatus;
  className?: string;
}) {
  const variant = workStatusVisual(status);
  return (
    <StatusBadge
      variant={variant}
      label={formatStatusLabel(status)}
      className={className}
    />
  );
}

export function ConflictStatusBadge({
  status,
  className,
}: {
  status: ConflictStatus;
  className?: string;
}) {
  const variant = conflictStatusVisual(status);
  return (
    <StatusBadge
      variant={variant}
      label={formatStatusLabel(status)}
      className={className}
    />
  );
}

export function ConflictSeverityBadge({
  severity,
  className,
}: {
  severity: ConflictSeverity;
  className?: string;
}) {
  const variant = conflictSeverityVisual(severity);
  return (
    <StatusBadge
      variant={variant}
      label={formatStatusLabel(severity)}
      className={className}
    />
  );
}

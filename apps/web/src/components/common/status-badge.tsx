import type {
  ConflictSeverity,
  ConflictStatus,
  ProjectStatus,
  WorkStatus,
} from "@infraos/shared-types";

import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  MinusCircleIcon,
  type LucideIcon,
} from "lucide-react";

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
  const spaced = status.replaceAll("_", " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export type StatusBadgeProps = {
  variant: StatusBadgeVariant;
  label: string;
  size?: "sm" | "md";
  className?: string;
};

/** Unified status vocabulary: every status carries an icon plus its text label, never colour alone. */
const STATUS_ICON: Record<StatusBadgeVariant, LucideIcon> = {
  success: CheckCircle2Icon,
  pending: ClockIcon,
  warning: ClockIcon,
  critical: AlertTriangleIcon,
  info: ActivityIcon,
  neutral: MinusCircleIcon,
};

/** Low-level status badge with explicit variant + label (always include text). */
export function StatusBadge({ variant, label, size = "md", className }: StatusBadgeProps) {
  const Icon = STATUS_ICON[variant];
  return (
    <Badge
      variant={variant as BadgeVariant}
      className={cn(size === "md" ? "h-6" : "h-5", "gap-1 px-2 font-medium", className)}
    >
      <Icon aria-hidden="true" />
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

import type { ReactNode } from "react";

import { cn } from "cn";

export function FeedbackState({
  icon,
  title,
  description,
  actions,
  className,
  role = "status",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface px-6 py-10 text-center",
        className,
      )}
      role={role}
    >
      {icon ? <div className="text-text-secondary [&_svg]:size-8" aria-hidden="true">{icon}</div> : null}
      <div className="space-y-1">
        <h2 className="type-label text-text-primary">{title}</h2>
        {description ? (
          <p className="type-body-small max-w-prose text-text-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

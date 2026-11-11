"use client";

import type { ReactNode } from "react";

export function QuickFactCard({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="cop-qf-card">
      <div className="cop-qf-head">
        <span>{title}</span>
        {badge ?? null}
      </div>
      <div>{children}</div>
    </article>
  );
}

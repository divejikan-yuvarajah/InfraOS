import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">{title}</h1>
        {description ? (
          <p className="hidden sm:block text-xs text-slate-600 truncate max-w-2xl mt-0.5">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </header>
  );
}

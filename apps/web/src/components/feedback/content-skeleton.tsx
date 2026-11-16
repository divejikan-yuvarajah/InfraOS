import { cn } from "cn";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-md bg-muted motion-safe:animate-pulse",
        className,
      )}
    />
  );
}

export function ContentSkeleton({
  variant = "card",
  label = "Loading content",
  className,
}: {
  variant?: "card" | "list" | "section" | "kpi" | "table" | "form" | "detail" | "map";
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-3", className)}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">{label}</span>
      {variant === "kpi" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="cac-card p-4 space-y-2">
              <SkeletonBar className="h-3.5 w-24" />
              <SkeletonBar className="h-7 w-16" />
              <SkeletonBar className="h-3 w-28" />
            </div>
          ))}
        </div>
      ) : variant === "table" ? (
        <div className="cac-card overflow-hidden" aria-hidden="true">
          <div className="bg-slate-50 border-b border-slate-200 p-3">
            <SkeletonBar className="h-4 w-48" />
          </div>
          <div className="divide-y divide-slate-100 p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBar key={i} className="h-9 w-full" />
            ))}
          </div>
        </div>
      ) : variant === "form" ? (
        <div className="cac-card p-6 space-y-4" aria-hidden="true">
          <SkeletonBar className="h-5 w-40" />
          <SkeletonBar className="h-10 w-full" />
          <SkeletonBar className="h-24 w-full" />
          <SkeletonBar className="h-10 w-32" />
        </div>
      ) : variant === "detail" ? (
        <div className="grid gap-4 lg:grid-cols-3" aria-hidden="true">
          <div className="cac-card p-6 space-y-3 lg:col-span-2">
            <SkeletonBar className="h-6 w-52" />
            <SkeletonBar className="h-4 w-full" />
            <SkeletonBar className="h-4 w-5/6" />
            <SkeletonBar className="h-32 w-full" />
          </div>
          <div className="cac-card p-6 space-y-3">
            <SkeletonBar className="h-5 w-32" />
            <SkeletonBar className="h-4 w-full" />
            <SkeletonBar className="h-4 w-3/4" />
          </div>
        </div>
      ) : variant === "map" ? (
        <div className="cac-card h-[360px] w-full flex items-center justify-center bg-slate-100/70" aria-hidden="true">
          <SkeletonBar className="h-8 w-44" />
        </div>
      ) : variant === "list" ? (
        <div className="grid gap-2" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBar key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : variant === "section" ? (
        <div className="grid gap-3" aria-hidden="true">
          <SkeletonBar className="h-6 w-40" />
          <SkeletonBar className="h-4 w-full max-w-lg" />
          <SkeletonBar className="h-4 w-full max-w-md" />
        </div>
      ) : (
        <div
          className="grid gap-3 rounded-lg border border-border p-6"
          aria-hidden="true"
        >
          <SkeletonBar className="h-5 w-32" />
          <SkeletonBar className="h-4 w-full" />
          <SkeletonBar className="h-4 w-5/6" />
          <SkeletonBar className="h-9 w-28" />
        </div>
      )}
    </div>
  );
}

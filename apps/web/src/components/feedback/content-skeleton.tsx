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
  variant?: "card" | "list" | "section";
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
      {variant === "list" ? (
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

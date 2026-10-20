import { Loader2Icon } from "lucide-react";

import { cn } from "cn";

export function LoadingState({
  label = "Loading",
  variant = "section",
  className,
}: {
  label?: string;
  variant?: "inline" | "section" | "page";
  className?: string;
}) {
  const isPage = variant === "page";
  const isInline = variant === "inline";

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-text-secondary",
        isPage && "min-h-[40vh] flex-1 items-center justify-center px-4",
        isInline && "type-caption",
        !isInline && !isPage && "justify-center py-10",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2Icon
        className={cn("size-4 shrink-0 motion-safe:animate-spin", isPage && "size-5")}
        aria-hidden="true"
      />
      <span className={cn(isPage ? "type-body-small" : "type-caption")}>{label}</span>
    </div>
  );
}

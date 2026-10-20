import { cn } from "@/lib/utils";

type PublicRouteLineProps = {
  orientation?: "horizontal" | "vertical";
  className?: string;
  /** Decorative when true; default false — line connects real UI structure */
  decorative?: boolean;
};

/** Thin route-line motif — structural connector for lifecycle and nav (Section 9.1). */
export function PublicRouteLine({
  orientation = "horizontal",
  className,
  decorative = false,
}: PublicRouteLineProps) {
  return (
    <span
      aria-hidden={decorative ? true : undefined}
      className={cn(
        "block shrink-0 bg-link",
        orientation === "horizontal" ? "h-0.5 w-full max-w-[3rem]" : "h-full min-h-[1.5rem] w-0.5",
        className,
      )}
    />
  );
}

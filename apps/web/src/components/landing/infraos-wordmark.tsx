import { InfraosMark } from "@/components/landing/infraos-mark";
import { cn } from "@/lib/utils";

type WordmarkTone = "on-dark" | "on-light";

export function InfraosWordmark({
  tagline,
  tone = "on-dark",
  markSize = "size-11",
  className,
}: {
  tagline?: string;
  tone?: WordmarkTone;
  markSize?: string;
  className?: string;
}) {
  const onDark = tone === "on-dark";

  return (
    <span className={cn("cf-wordmark inline-flex items-center gap-3", className)}>
      <InfraosMark className={markSize} variant={onDark ? "brand" : "light"} />
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={cn(
            "cf-wordmark__title text-lg font-bold tracking-tight sm:text-xl",
            onDark ? "text-white" : "text-[#111827]",
          )}
        >
          INFRA<span className="text-[#FF5B00]">OS</span>
        </span>
        {tagline ? (
          <span
            className={cn(
              "mt-1 type-caption font-normal tracking-normal",
              onDark ? "text-slate-300" : "text-[#475569]",
            )}
          >
            {tagline}
          </span>
        ) : null}
      </span>
    </span>
  );
}

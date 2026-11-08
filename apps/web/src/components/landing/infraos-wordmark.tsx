import Image from "next/image";
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
      <span className={cn("inline-flex shrink-0 items-center justify-center rounded-lg p-1", onDark ? "bg-white/10 ring-1 ring-white/15" : "bg-white ring-1 ring-black/10 shadow-xs")}>
        <Image
          src="/brand/infraos-icon-transparent.png"
          alt="InfraOS"
          width={36}
          height={36}
          className={cn("shrink-0 object-contain", markSize)}
          priority
        />
      </span>
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

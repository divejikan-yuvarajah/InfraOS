import type { LifecycleStageId } from "@/lib/landing/lifecycle-stages";

const STAGE_PATHS: Record<LifecycleStageId, string> = {
  plan:
    "M4 18V8l6-4 6 4v10M4 18h16M10 18v-6h4v6",
  coordinate:
    "M4 12h6M14 12h6M10 8v8M7 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0M17 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
  approve: "M6 12l3 3 7-7M4 20h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z",
  build: "M4 20V8l8-4 8 4v12M8 20v-8h8v8",
  verify: "M9 11l2 2 4-4M5 20h14a2 2 0 0 0 2-2V9l-7-4-7 4v9a2 2 0 0 0 2 2z",
  monitor: "M4 16V8l4-2v10M12 18V6l4-2v14M20 14V10l4-2v8",
  complete: "M8 12l2 2 6-6M4 20h16",
  maintain: "M12 4v4M12 16v4M4 12h4M16 12h4M7.05 7.05l2.83 2.83M14.12 14.12l2.83 2.83M7.05 16.95l2.83-2.83M14.12 9.88l2.83-2.83",
};

export function LifecycleStageIcon({
  stageId,
  className,
}: {
  stageId: LifecycleStageId;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={STAGE_PATHS[stageId]} />
    </svg>
  );
}

import { cn } from "@/lib/utils";

type MarkVariant = "brand" | "light" | "maroon";

const variantStyles: Record<MarkVariant, { panel: string; vertical: string; panelStroke?: string }> =
  {
    brand: { panel: "#111827", vertical: "#F8FAFC" },
    light: { panel: "#FFFFFF", vertical: "#8C1F28", panelStroke: "#E2E8F0" },
    maroon: { panel: "#8C1F28", vertical: "#FEB600", panelStroke: "#6B1820" },
  };

/** Infrastructure intersection mark — route corridors, not a government seal. */
export function InfraosMark({
  className,
  variant = "brand",
}: {
  className?: string;
  variant?: MarkVariant;
}) {
  const v = variantStyles[variant];

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("shrink-0", className)}>
      <rect
        width="48"
        height="48"
        rx="10"
        fill={v.panel}
        stroke={v.panelStroke}
        strokeWidth={v.panelStroke ? 1 : 0}
      />
      <path d="M10 34 L38 34" stroke="#FF5B00" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M24 10 L24 38" stroke={v.vertical} strokeWidth="3" strokeLinecap="round" />
      <path
        d="M14 18 L34 26"
        stroke="#279541"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="2 5"
        opacity="0.95"
      />
      <circle cx="24" cy="34" r="4" fill="#FEB600" stroke={v.panel} strokeWidth="1.5" />
      <circle cx="24" cy="24" r="2.5" fill="#FF5B00" />
      <circle cx="32" cy="22" r="1.75" fill="#FEB600" opacity="0.9" />
    </svg>
  );
}

import { cn } from "@/lib/utils";

/**
 * Connected Infrastructure motif. Purely decorative: aria-hidden, token colours,
 * low opacity, never animated. Do not place behind tables, charts or forms.
 */
function Nodes({ points, accent }: { points: ReadonlyArray<readonly [number, number]>; accent: number }) {
  return (
    <>
      {points.map(([x, y], i) =>
        i % accent === 0 ? (
          <circle key={i} cx={x} cy={y} r="4" fill="var(--infra-orange)" />
        ) : (
          <circle key={i} cx={x} cy={y} r="3.5" fill="var(--surface, #fff)" stroke="currentColor" strokeWidth="1.25" />
        ),
      )}
    </>
  );
}

/** Route lines with junction nodes, for page-header backdrops (right side, faded). */
export function RouteLines({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 120" aria-hidden="true" focusable="false" className={cn("text-slate-500", className)}>
      <g fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M0 96H92L128 60H220L252 28H360" />
        <path d="M128 60V120" />
        <path d="M220 60L252 92H360" />
        <path d="M176 0V60" />
      </g>
      <Nodes points={[[128, 60], [220, 60], [252, 28], [176, 60], [252, 92]]} accent={5} />
    </svg>
  );
}

/** Very faint survey grid with a soft radial fade, for one corner of an insight panel. */
export function SurveyGrid({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" className={cn("text-slate-500", className)} viewBox="0 0 160 160">
      <defs>
        <pattern id="mc-grid-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="currentColor" />
        </pattern>
        <radialGradient id="mc-grid-fade" cx="100%" cy="0%" r="100%">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="mc-grid-mask">
          <rect width="160" height="160" fill="url(#mc-grid-fade)" />
        </mask>
      </defs>
      <rect width="160" height="160" fill="url(#mc-grid-dots)" mask="url(#mc-grid-mask)" />
    </svg>
  );
}

type IllustrationKind = "no-projects" | "all-clear" | "unavailable";

/** Composed empty-state illustrations built only from the motif. */
export function MotifIllustration({ kind, className }: { kind: IllustrationKind; className?: string }) {
  return (
    <svg viewBox="0 0 200 120" aria-hidden="true" focusable="false" className={cn("text-slate-400", className)}>
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {kind === "no-projects" ? (
          <>
            <path d="M20 90H60M140 90H180M100 30V50" strokeDasharray="3 6" />
            <circle cx="60" cy="90" r="6" fill="var(--surface, #fff)" />
            <circle cx="140" cy="90" r="6" fill="var(--surface, #fff)" />
            <circle cx="100" cy="30" r="6" fill="var(--surface, #fff)" />
            <circle cx="100" cy="64" r="5" strokeDasharray="2 3" />
          </>
        ) : null}
        {kind === "all-clear" ? (
          <>
            <path d="M24 88H70L96 62H140L164 38H184M96 62V100" />
            <circle cx="70" cy="88" r="5" fill="var(--surface, #fff)" />
            <circle cx="96" cy="62" r="5" fill="var(--surface, #fff)" />
            <circle cx="164" cy="38" r="5" fill="var(--surface, #fff)" />
            <circle cx="140" cy="62" r="7" fill="var(--infra-green)" stroke="var(--infra-green)" />
          </>
        ) : null}
        {kind === "unavailable" ? (
          <>
            <path d="M24 70H78M122 70H176" />
            <circle cx="24" cy="70" r="5" fill="var(--surface, #fff)" />
            <circle cx="176" cy="70" r="5" fill="var(--surface, #fff)" />
            <rect x="90" y="60" width="20" height="16" rx="3" fill="var(--surface, #fff)" />
            <path d="M95 60v-5a5 5 0 0110 0v5" />
          </>
        ) : null}
      </g>
    </svg>
  );
}

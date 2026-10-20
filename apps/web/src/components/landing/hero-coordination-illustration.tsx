import { Badge } from "@/components/ui/badge";
import type { PublicLandingCopy } from "@/lib/landing/messages";

export function HeroCoordinationIllustration({
  illustration,
}: {
  illustration: PublicLandingCopy["illustration"];
}) {
  return (
    <figure
      className="relative w-full max-w-lg justify-self-center rounded-xl border border-border bg-surface p-4 shadow-elevation-sm"
      aria-labelledby="hero-illustration-caption"
    >
      <svg
        viewBox="0 0 320 200"
        className="h-auto w-full text-border"
        role="img"
        aria-labelledby="hero-illustration-title hero-illustration-desc"
      >
        <title id="hero-illustration-title">{illustration.title}</title>
        <desc id="hero-illustration-desc">{illustration.description}</desc>
        <rect x="8" y="88" width="304" height="24" rx="4" fill="currentColor" opacity="0.35" />
        <path
          d="M 24 100 L 296 100"
          stroke="var(--infra-orange)"
          strokeWidth="3"
          strokeDasharray="6 4"
          fill="none"
        />
        <circle cx="120" cy="100" r="10" fill="var(--infra-yellow)" />
        <circle cx="200" cy="100" r="10" fill="var(--infra-maroon)" />
        <text x="120" y="72" textAnchor="middle" fill="var(--text-secondary)" fontSize="10">
          {illustration.pipeline}
        </text>
        <text x="200" y="72" textAnchor="middle" fill="var(--text-secondary)" fontSize="10">
          {illustration.resurfacing}
        </text>
        <text x="160" y="140" textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="500">
          {illustration.overlap}
        </text>
      </svg>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="warning">{illustration.pending}</Badge>
        <Badge variant="critical">{illustration.critical}</Badge>
        <Badge variant="success">{illustration.resolved}</Badge>
      </div>
      <figcaption id="hero-illustration-caption" className="type-caption mt-3 text-text-muted">
        {illustration.caption}
      </figcaption>
    </figure>
  );
}

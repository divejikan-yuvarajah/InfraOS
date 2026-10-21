/** Lightweight route/corridor annotation for the public hero (non-data-bearing). */
export function HeroCoordinationOverlay({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 480 320"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="cf-route-glow" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF5B00" stopOpacity="0" />
          <stop offset="45%" stopColor="#FEB600" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#279541" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path
        d="M24 220 C120 180, 200 240, 280 200 S420 160, 456 120"
        fill="none"
        stroke="url(#cf-route-glow)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M40 260 C140 230, 220 270, 320 240"
        fill="none"
        stroke="#8C1F28"
        strokeWidth="1.5"
        strokeDasharray="6 5"
        opacity="0.55"
      />
      <circle cx="280" cy="200" r="5" fill="#FEB600" stroke="#fff" strokeWidth="1.5" />
      <circle cx="320" cy="240" r="4" fill="#FF5B00" />
      <circle cx="200" cy="230" r="3.5" fill="#279541" />
    </svg>
  );
}

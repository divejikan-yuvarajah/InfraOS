/** Decorative corridor linework for the Connected Future hero (non-data-bearing). */
export function HeroRouteLayer({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="cf-hero-gold" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FEB600" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#FEB600" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FF5B00" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <g opacity="0.9" strokeLinecap="round" fill="none">
        <path
          d="M-20 420 C120 360, 260 480, 420 400 S680 320, 820 380"
          stroke="url(#cf-hero-gold)"
          strokeWidth="2"
        />
        <path
          d="M40 520 C200 460, 340 540, 520 480 S740 440, 860 500"
          stroke="#FF5B00"
          strokeWidth="1.5"
          strokeDasharray="10 8"
          opacity="0.55"
        />
        <path
          d="M600 80 L600 560"
          stroke="#279541"
          strokeWidth="1"
          strokeDasharray="4 6"
          opacity="0.35"
        />
        <path
          d="M120 120 L720 120"
          stroke="#FEB600"
          strokeWidth="1"
          opacity="0.25"
        />
      </g>
      {[180, 320, 460, 600].map((x) => (
        <circle key={x} cx={x} cy={400} r="3" fill="#FEB600" opacity="0.5" />
      ))}
    </svg>
  );
}

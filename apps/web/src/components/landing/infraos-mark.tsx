/** Original INFRAOS intersection mark — route corridors, not a government seal. */
export function InfraosMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <rect width="40" height="40" rx="8" fill="#111827" />
      <path
        d="M8 28 L32 28"
        stroke="#FF5B00"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M20 8 L20 32"
        stroke="#F8FAFC"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M11 14 L29 22"
        stroke="#279541"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="1 4"
        opacity="0.9"
      />
      <circle cx="20" cy="28" r="3.5" fill="#FEB600" stroke="#111827" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="2" fill="#FF5B00" />
    </svg>
  );
}

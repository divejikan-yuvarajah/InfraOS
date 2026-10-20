/** Original Civic Atlas mark: two corridors meeting. Not a government seal. */
export function InfraosMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
    >
      <rect width="32" height="32" rx="6" fill="#111827" />
      <path d="M6 22h20" stroke="#FF5B00" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8 10h16" stroke="#F8FAFC" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
      <circle cx="16" cy="16" r="2.5" fill="#FEB600" />
    </svg>
  );
}

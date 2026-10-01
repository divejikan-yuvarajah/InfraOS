export default function Loading() {
  return (
    <div
      className="flex min-h-full flex-1 items-center justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm text-text-secondary">Loading INFRAOS…</p>
    </div>
  );
}

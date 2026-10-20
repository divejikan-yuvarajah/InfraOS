"use client";

export function FormErrorSummary({
  message,
  requestId,
}: {
  message?: string;
  requestId?: string;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-status-critical-border bg-status-critical-bg px-3 py-2 text-sm text-status-critical-fg"
    >
      <p className="font-medium">Please review this form</p>
      <p>{message}</p>
      {requestId ? (
        <p className="type-caption mt-1">Reference: {requestId}</p>
      ) : null}
    </div>
  );
}

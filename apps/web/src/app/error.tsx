"use client";

import Link from "next/link";
import { MotifIllustration } from "@/components/motif/connected-motif";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
      <div className="cac-card max-w-md w-full p-8 text-center space-y-4">
        <MotifIllustration kind="unavailable" className="mx-auto h-16 w-28" />
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-[#8c1f28]">
          Runtime Fault Boundary
        </p>
        <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="text-sm text-slate-600">
          An unexpected error occurred while rendering this view. Your session and data remain safe.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="min-h-[44px] rounded-lg bg-[#c43d00] px-4 py-2 text-sm font-semibold text-white hover:bg-[#802a00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5b00]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="min-h-[44px] inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5b00]"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

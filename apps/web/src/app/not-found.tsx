import Link from "next/link";
import { MotifIllustration } from "@/components/motif/connected-motif";

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center"
    >
      <div className="cac-card w-full p-8 space-y-4">
        <MotifIllustration kind="unavailable" className="mx-auto h-16 w-28" />
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-[#c43d00]">
          404 · Route Not Found
        </p>
        <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="text-sm text-slate-600">
          The requested infrastructure record or route does not exist or may have moved.
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center rounded-lg bg-[#c43d00] px-4 py-2 text-sm font-semibold text-white hover:bg-[#802a00]"
          >
            Open Command Workspace
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Public Home
          </Link>
        </div>
      </div>
    </main>
  );
}

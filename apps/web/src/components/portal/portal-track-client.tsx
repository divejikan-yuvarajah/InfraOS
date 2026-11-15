"use client";

import { useState, type FormEvent } from "react";

import type { AuthLocale } from "@/lib/auth/types";
import { publicIssuePhotoUrl, trackPublicIssue } from "@/lib/public/api";
import { PORTAL_COPY } from "@/lib/public/messages";
import type { PublicIssueTrackResponse } from "@/lib/public/types";
import { PortalShell } from "./portal-shell";

export function PortalTrackClient({ locale = "en" }: { locale?: AuthLocale }) {
  const copy = PORTAL_COPY[locale];
  const [referenceNo, setReferenceNo] = useState("");
  const [trackingSecret, setTrackingSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicIssueTrackResponse | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await trackPublicIssue(referenceNo, trackingSecret);
      setResult(data);
    } catch {
      setResult(null);
      setError(copy.trackNotFound);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PortalShell locale={locale} activeNav="track">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{copy.trackTitle}</h1>
          <p className="mt-1 text-sm text-slate-600">{copy.trackSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div>
            <label htmlFor="ref-no" className="block text-xs font-medium text-slate-700">
              {copy.referenceLabel}
            </label>
            <input
              id="ref-no"
              required
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="ISS-2026-000001"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="track-secret" className="block text-xs font-medium text-slate-700">
              {copy.secretLabel}
            </label>
            <input
              id="track-secret"
              required
              value={trackingSecret}
              onChange={(e) => setTrackingSecret(e.target.value)}
              placeholder="Paste your one-time tracking secret"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 font-mono text-sm"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded-md bg-blue-700 px-4 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? "Checking…" : copy.trackSubmit}
          </button>
        </form>

        {result ? (
          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-mono text-xs text-slate-500">{result.referenceNo}</div>
                <h2 className="text-lg font-semibold text-slate-900">{result.title || result.category}</h2>
                <p className="text-xs text-slate-500">
                  {result.district}, {result.province} {result.assignedAgencyName ? `· ${result.assignedAgencyName}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{result.status}</span>
            </div>

            <p className="text-sm text-slate-700">{result.description}</p>

            {result.photoCount > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Submitted Photos ({result.photoCount})</h3>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: result.photoCount }).map((_, idx) => (
                    <a
                      key={idx}
                      href={publicIssuePhotoUrl(result.referenceNo, trackingSecret, idx)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-slate-50"
                    >
                      Photo #{idx + 1}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.updatesTitle}</h3>
              <ul className="space-y-2">
                {result.publicMessages.map((msg, i) => (
                  <li key={i} className="rounded-md bg-slate-50 p-3 text-sm">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{msg.authorLabel}</span>
                      <span>{new Date(msg.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-slate-800">{msg.body}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.timelineTitle}</h3>
              <ol className="space-y-1.5 text-xs text-slate-600">
                {result.statusHistory.map((h, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus}</span>
                    <span className="tabular-nums">{new Date(h.changedAt).toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ) : null}
      </div>
    </PortalShell>
  );
}

"use client";

import { useState, type FormEvent } from "react";

import {
  AlignmentTimeline,
  BenchmarkStatusBadge,
  CommandHeader,
  DataSourceBadge,
} from "@/components/common/civic-atlas-primitives";
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

  const normalizedStatus = result?.status?.toUpperCase() ?? "";
  const isResolved = normalizedStatus === "RESOLVED" || normalizedStatus === "CLOSED";
  const isInProgress =
    isResolved || normalizedStatus === "IN_PROGRESS" || normalizedStatus === "ASSIGNED";
  const isUnderReview =
    isInProgress || normalizedStatus === "TRIAGED" || normalizedStatus === "UNDER_REVIEW";

  return (
    <PortalShell locale={locale} activeNav="track">
      <div className="mx-auto max-w-3xl space-y-6">
        <CommandHeader
          variant="light"
          eyebrow="CITIZEN REPORT TRACKING"
          title={copy.trackTitle}
          subtitle={copy.trackSubtitle}
          sourceKind="live"
        />

        <form onSubmit={handleSubmit} className="cac-card space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ref-no" className="block text-xs font-semibold text-slate-700 mb-1">
                {copy.referenceLabel}
              </label>
              <input
                id="ref-no"
                required
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="ISS-2026-000001"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm focus:border-[#ff5b00] focus:outline-2 focus:outline-offset-2 focus:outline-[#ff5b00]"
              />
            </div>
            <div>
              <label htmlFor="track-secret" className="block text-xs font-semibold text-slate-700 mb-1">
                {copy.secretLabel}
              </label>
              <input
                id="track-secret"
                required
                value={trackingSecret}
                onChange={(e) => setTrackingSecret(e.target.value)}
                placeholder="Paste your one-time tracking secret"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm focus:border-[#ff5b00] focus:outline-2 focus:outline-offset-2 focus:outline-[#ff5b00]"
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-xs font-semibold text-[#8c1f28]">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-10 items-center rounded-lg bg-[#c43d00] px-5 py-2 text-xs font-semibold text-white hover:bg-[#802a00] disabled:opacity-50"
            >
              {loading ? "Checking…" : copy.trackSubmit}
            </button>
          </div>
        </form>

        {result ? (
          <section className="cac-card space-y-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                    {result.referenceNo}
                  </span>
                  <DataSourceBadge kind="recorded" label="Public-Safe Status" />
                </div>
                <h2 className="mt-1.5 text-lg font-bold text-slate-900">
                  {result.title || result.category}
                </h2>
                <p className="text-xs text-slate-600">
                  {result.district}, {result.province}{" "}
                  {result.assignedAgencyName ? `· ${result.assignedAgencyName}` : ""}
                </p>
              </div>
              <BenchmarkStatusBadge status={result.status} />
            </div>

            {/* Citizen Report Alignment Timeline (§5.8) */}
            <AlignmentTimeline
              orientation="horizontal"
              ariaLabel="Report resolution stages"
              items={[
                {
                  id: "rep-1",
                  stationCode: "ST-01",
                  title: "Submitted",
                  subtitle: "Logged in public ledger",
                  state: "completed",
                  statusLabel: "Recorded",
                },
                {
                  id: "rep-2",
                  stationCode: "ST-02",
                  title: "Agency Triage",
                  subtitle: result.assignedAgencyName || "Jurisdiction routing",
                  state: isUnderReview ? "completed" : "recorded",
                  statusLabel: isUnderReview ? "Assigned" : "In Queue",
                },
                {
                  id: "rep-3",
                  stationCode: "ST-03",
                  title: "Field Action",
                  subtitle: "Inspection & repair",
                  state: isResolved ? "completed" : isInProgress ? "recorded" : "planned",
                  statusLabel: isResolved ? "Done" : isInProgress ? "Active" : "Pending",
                },
                {
                  id: "rep-4",
                  stationCode: "ST-04",
                  title: "Resolution",
                  subtitle: "Public closure notice",
                  state: isResolved ? "verified" : "planned",
                  statusLabel: isResolved ? "Resolved" : "Awaiting",
                },
              ]}
            />

            <p className="text-sm text-slate-700">{result.description}</p>

            {result.photoCount > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Submitted Photos ({result.photoCount})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: result.photoCount }).map((_, idx) => (
                    <a
                      key={idx}
                      href={publicIssuePhotoUrl(result.referenceNo, trackingSecret, idx)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-[#c43d00] hover:bg-slate-100"
                    >
                      Photo #{idx + 1}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {copy.updatesTitle}
              </h3>
              {result.publicMessages.length > 0 ? (
                <ul className="space-y-2">
                  {result.publicMessages.map((msg, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm"
                    >
                      <div className="flex justify-between text-xs text-slate-500">
                        <span className="font-semibold text-slate-800">{msg.authorLabel}</span>
                        <span className="font-mono">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-700">{msg.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">
                  No public agency updates posted yet. Check back with your reference number.
                </p>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </PortalShell>
  );
}

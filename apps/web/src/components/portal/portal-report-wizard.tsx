"use client";

import Link from "next/link";
import { useState, type ChangeEvent } from "react";

import type { AuthLocale } from "@/lib/auth/types";
import { submitPublicIssue } from "@/lib/public/api";
import { PORTAL_COPY } from "@/lib/public/messages";
import type { PublicIssueSubmitResponse } from "@/lib/public/types";
import { PortalShell } from "./portal-shell";

const CATEGORIES = ["POTHOLE", "ROAD_DAMAGE", "WATER_LEAK", "DRAINAGE", "STREET_LIGHT", "UTILITY_DAMAGE", "PUBLIC_ASSET_DAMAGE", "OTHER"] as const;
const DISTRICTS = ["Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Galle", "Matara", "Jaffna", "Anuradhapura", "Kurunegala", "Ratnapura", "Badulla"] as const;
const PROVINCES = ["Western", "Central", "Southern", "Northern", "Eastern", "North Western", "North Central", "Uva", "Sabaragamuwa"] as const;

type PhotoDraft = { base64: string; fileName: string; sizeBytes: number };

export function PortalReportWizard({ locale = "en" }: { locale?: AuthLocale }) {
  const copy = PORTAL_COPY[locale];
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("POTHOLE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "CRITICAL">("NORMAL");
  const [province, setProvince] = useState<(typeof PROVINCES)[number]>("Western");
  const [district, setDistrict] = useState<(typeof DISTRICTS)[number]>("Colombo");
  const [addressLine, setAddressLine] = useState("");
  const [lat, setLat] = useState("6.927");
  const [lng, setLng] = useState("79.861");
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState(""); // Honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PublicIssueSubmitResponse | null>(null);

  function handleUseGps() {
    if (!navigator.geolocation) {
      setError("Browser geolocation unavailable.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5));
        setLng(pos.coords.longitude.toFixed(5));
        setError(null);
      },
      () => setError("Unable to read GPS location."),
    );
  }

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4 - photos.length);
    const next: PhotoDraft[] = [];
    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        setError(`${f.name} exceeds 5 MB limit.`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.readAsDataURL(f);
      });
      next.push({ base64: dataUrl, fileName: f.name, sizeBytes: f.size });
    }
    setPhotos((prev) => [...prev, ...next].slice(0, 4));
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const parsedLat = lat.trim() ? Number(lat) : undefined;
      const parsedLng = lng.trim() ? Number(lng) : undefined;
      const res = await submitPublicIssue({
        category,
        title: title.trim() || undefined,
        description: description.trim(),
        priority,
        website: website || undefined,
        location: {
          province,
          district,
          addressLine: addressLine.trim() || undefined,
          lat: Number.isFinite(parsedLat) ? parsedLat : undefined,
          lng: Number.isFinite(parsedLng) ? parsedLng : undefined,
        },
        contact:
          contactName.trim() || contactPhone.trim() || contactEmail.trim()
            ? {
                name: contactName.trim() || undefined,
                phone: contactPhone.trim() || undefined,
                email: contactEmail.trim() || undefined,
              }
            : undefined,
        photos: photos.map((p) => ({ base64: p.base64, fileName: p.fileName })),
      });
      setReceipt(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <PortalShell locale={locale} activeNav="report">
        <div className="mx-auto max-w-xl space-y-4 rounded-lg border border-emerald-200 bg-white p-6 shadow-xs">
          <h1 className="text-xl font-semibold text-emerald-900">Report Submitted</h1>
          <p className="rounded-md bg-amber-50 p-3 text-xs font-medium text-amber-900">{copy.saveSecretWarning}</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">{copy.referenceLabel}</dt>
              <dd className="font-mono font-semibold text-slate-900">{receipt.referenceNo}</dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">{copy.secretLabel}</dt>
              <dd className="font-mono font-semibold text-blue-700">{receipt.trackingSecret}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Initial Status</dt>
              <dd className="font-medium text-slate-900">{receipt.status}</dd>
            </div>
          </dl>
          <div className="flex gap-2 pt-2">
            <Link href="/portal/track" className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800">
              {copy.navTrack}
            </Link>
            <Link href="/portal" className="rounded-md border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700">
              {copy.backToPortal}
            </Link>
          </div>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell locale={locale} activeNav="report">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{copy.reportTitle}</h1>
          <p className="mt-1 text-sm text-slate-600">{copy.reportSubtitle}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {[copy.stepCategory, copy.stepLocation, copy.stepPhotos, copy.stepContact, copy.stepReview].map((label, idx) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(idx + 1)}
              className={`rounded-md px-3 py-1.5 font-medium ${step === idx + 1 ? "bg-blue-700 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          {/* Honeypot */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            aria-hidden="true"
            className="hidden"
          />

          {step === 1 ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Short Title (optional)</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Deep pothole at junction" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Description (min 10 chars)</label>
                <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
                  <option value="LOW">LOW</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Province</label>
                  <select value={province} onChange={(e) => setProvince(e.target.value as typeof province)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
                    {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">District</label>
                  <select value={district} onChange={(e) => setDistrict(e.target.value as typeof district)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
                    {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Address / Landmark</label>
                <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder="Street name or kilometer post" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Latitude (5.85–9.90)</label>
                  <input value={lat} onChange={(e) => setLat(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm tabular-nums" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Longitude (79.45–81.95)</label>
                  <input value={lng} onChange={(e) => setLng(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm tabular-nums" />
                </div>
              </div>
              <button type="button" onClick={handleUseGps} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                Use Device GPS
              </button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">Upload up to 4 JPEG/PNG/WebP photos (max 5 MB each). EXIF metadata is stripped automatically.</p>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFiles} className="block text-xs" />
              {photos.length > 0 ? (
                <ul className="space-y-1 text-xs text-slate-700">
                  {photos.map((p, idx) => (
                    <li key={idx} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                      <span>{p.fileName} ({Math.round(p.sizeBytes / 1024)} KB)</span>
                      <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))} className="text-red-600 hover:underline">
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">Optional contact details (private to assigned staff only).</p>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Your name (optional)" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone number (optional)" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email (optional)" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-2 text-sm text-slate-700">
              <p><strong>Category:</strong> {category} ({priority})</p>
              <p><strong>Title:</strong> {title || "—"}</p>
              <p><strong>Location:</strong> {district}, {province} {addressLine ? `(${addressLine})` : ""} [{lat}, {lng}]</p>
              <p><strong>Photos:</strong> {photos.length}</p>
              <p><strong>Description:</strong> {description}</p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              disabled={step <= 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="rounded-md border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 disabled:opacity-40"
            >
              Back
            </button>
            {step < 5 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(5, s + 1))}
                className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting || description.trim().length < 10}
                onClick={handleSubmit}
                className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {submitting ? copy.submitting : copy.submitReport}
              </button>
            )}
          </div>
        </div>
      </div>
    </PortalShell>
  );
}

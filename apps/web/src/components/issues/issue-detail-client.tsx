"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { apiClient } from "@/lib/api/client";
import {
  addStaffIssueNote,
  fetchStaffIssueDetail,
  fetchStaffIssuePhotoBlobUrl,
  routeStaffIssue,
  transitionStaffIssue,
} from "@/lib/issues/api";

export function IssueDetailClient({ id }: { id: string }) {
  const qc = useQueryClient();
  const [agencyIdOverride, setAgencyId] = useState<string | null>(null);
  const [publicMapOverride, setPublicMapVisible] = useState<boolean | null>(null);
  const [toStatusOverride, setToStatus] = useState<string | null>(null);
  const [publicMessage, setPublicMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [noteKind, setNoteKind] = useState<"PUBLIC" | "INTERNAL">("PUBLIC");
  const [noteBody, setNoteBody] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const detailQuery = useQuery({
    queryKey: ["issues", "detail", id],
    queryFn: () => fetchStaffIssueDetail(id),
  });

  const agenciesQuery = useQuery({
    queryKey: ["admin", "agencies", "lookup"],
    queryFn: () => apiClient<{ items: Array<{ id: string; code: string; name: string }> }>("/api/v1/admin/agencies?limit=50", { authenticated: true }),
  });

  const detail = detailQuery.data;
  const agencyId = agencyIdOverride ?? detail?.assignedAgency?.id ?? "";
  const publicMapVisible = publicMapOverride ?? detail?.publicMapVisible ?? false;
  const toStatus = toStatusOverride ?? detail?.allowedTransitions[0] ?? "";

  useEffect(() => {
    if (!detail || detail.photoCount === 0) return;
    let active = true;
    const urls: string[] = [];
    void Promise.all(
      Array.from({ length: detail.photoCount }).map(async (_, idx) => {
        const u = await fetchStaffIssuePhotoBlobUrl(detail.id, idx);
        if (u) urls.push(u);
      }),
    ).then(() => {
      if (active) setPhotoUrls(urls);
    });
    return () => {
      active = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [detail]);

  const routeMut = useMutation({
    mutationFn: () => routeStaffIssue(id, { agencyId, publicMapVisible }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["issues", "detail", id] }),
  });

  const statusMut = useMutation({
    mutationFn: () =>
      transitionStaffIssue(id, {
        toStatus,
        publicMessage: publicMessage.trim() || undefined,
        internalNote: internalNote.trim() || undefined,
        publicMapVisible,
      }),
    onSuccess: () => {
      setPublicMessage("");
      setInternalNote("");
      setToStatus(null);
      void qc.invalidateQueries({ queryKey: ["issues", "detail", id] });
    },
  });

  const noteMut = useMutation({
    mutationFn: () => addStaffIssueNote(id, { kind: noteKind, body: noteBody }),
    onSuccess: () => {
      setNoteBody("");
      void qc.invalidateQueries({ queryKey: ["issues", "detail", id] });
    },
  });

  return (
    <StaffWorkspaceShell title={detail ? `Issue ${detail.referenceNo}` : "Citizen Issue Detail"}>
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <Link href="/issues" className="text-xs font-medium text-blue-700 hover:underline">
            ← Back to Issues Inbox
          </Link>
        </div>

        {detailQuery.isLoading ? (
          <div className="h-48 animate-pulse rounded-lg border border-slate-200 bg-white p-6" />
        ) : !detail ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Issue not found.</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs text-slate-500">{detail.referenceNo ?? detail.id}</span>
                    <h1 className="text-xl font-semibold text-slate-900">{detail.title || detail.category}</h1>
                    <p className="text-xs text-slate-500">
                      {detail.location.addressLine ? `${detail.location.addressLine}, ` : ""}
                      {detail.location.district}, {detail.location.province}
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{detail.status}</span>
                </div>
                <p className="text-sm text-slate-700">{detail.description}</p>
                {detail.contact ? (
                  <div className="rounded bg-slate-50 p-3 text-xs text-slate-600">
                    Reporter Contact (Staff Only): {detail.contact.name || "—"} · {detail.contact.phone || "—"} · {detail.contact.email || "—"}
                  </div>
                ) : null}
              </section>

              {photoUrls.length > 0 ? (
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
                  <h2 className="mb-3 text-sm font-semibold text-slate-900">Submitted Photos</h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {photoUrls.map((url, idx) => (
                      <img key={idx} src={url} alt={`Issue photo ${idx + 1}`} className="h-28 w-full rounded border border-slate-200 object-cover" />
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
                <h2 className="text-sm font-semibold text-slate-900">Public Timeline & Internal Notes</h2>
                <div className="flex flex-wrap gap-2">
                  <select value={noteKind} onChange={(e) => setNoteKind(e.target.value as "PUBLIC" | "INTERNAL")} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
                    <option value="PUBLIC">Public Citizen Update</option>
                    <option value="INTERNAL">Internal Staff Note</option>
                  </select>
                  <input
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Write update or internal note…"
                    className="h-9 flex-1 rounded-md border border-slate-300 px-3 text-xs"
                  />
                  <button
                    type="button"
                    disabled={noteBody.trim().length < 2 || noteMut.isPending}
                    onClick={() => noteMut.mutate()}
                    className="h-9 rounded-md bg-blue-700 px-3 text-xs font-medium text-white disabled:opacity-50"
                  >
                    Post
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Public Messages</h3>
                    <ul className="space-y-2 text-xs">
                      {detail.publicMessages.map((m, i) => (
                        <li key={i} className="rounded bg-slate-50 p-2.5">
                          <div className="font-medium text-slate-700">{m.authorLabel}</div>
                          <p className="mt-0.5 text-slate-800">{m.body}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Internal Notes</h3>
                    <ul className="space-y-2 text-xs">
                      {detail.internalNotes.map((n, i) => (
                        <li key={i} className="rounded bg-amber-50 p-2.5 text-amber-950">
                          <p>{n.body}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
                <h2 className="text-sm font-semibold text-slate-900">Route Agency & Visibility</h2>
                <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} className="h-9 w-full rounded-md border border-slate-300 px-2 text-xs">
                  <option value="">Select agency…</option>
                  {(agenciesQuery.data?.items ?? []).map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={publicMapVisible} onChange={(e) => setPublicMapVisible(e.target.checked)} />
                  Show coarsened marker on Public Map
                </label>
                <button
                  type="button"
                  disabled={!agencyId || routeMut.isPending}
                  onClick={() => routeMut.mutate()}
                  className="h-9 w-full rounded-md bg-slate-900 text-xs font-medium text-white disabled:opacity-50"
                >
                  Save Routing
                </button>
              </section>

              <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
                <h2 className="text-sm font-semibold text-slate-900">Update Status</h2>
                {detail.allowedTransitions.length === 0 ? (
                  <p className="text-xs text-slate-500">Terminal status reached.</p>
                ) : (
                  <>
                    <select value={toStatus} onChange={(e) => setToStatus(e.target.value)} className="h-9 w-full rounded-md border border-slate-300 px-2 text-xs">
                      {detail.allowedTransitions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <input
                      value={publicMessage}
                      onChange={(e) => setPublicMessage(e.target.value)}
                      placeholder="Public timeline note (optional)"
                      className="h-9 w-full rounded-md border border-slate-300 px-3 text-xs"
                    />
                    <input
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                      placeholder="Internal note (optional)"
                      className="h-9 w-full rounded-md border border-slate-300 px-3 text-xs"
                    />
                    <button
                      type="button"
                      disabled={!toStatus || statusMut.isPending}
                      onClick={() => statusMut.mutate()}
                      className="h-9 w-full rounded-md bg-blue-700 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Apply Transition
                    </button>
                  </>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </StaffWorkspaceShell>
  );
}

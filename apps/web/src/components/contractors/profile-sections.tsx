"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, ShieldOffIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AuthLocale } from "@/lib/auth/types";
import { addCertification, addDocumentRef, failureOf, fetchTimeline, removeDocumentRef, revokeCertification, updateCertification } from "@/lib/contractors/api";
import { daysUntil, fill, formatDate, formatDateTime, relativeTime } from "@/lib/contractors/format";
import { failureMessage, type Copy } from "@/lib/contractors/messages";
import { certificationRow, documentRow, statusReasonSchema } from "@/lib/contractors/schema";
import { useContractorKeys } from "@/lib/contractors/session";
import { DOCUMENT_TYPES, type CertificationItem, type ContractorProfile, type DocumentRefItem, type Performance, type TimelineEvent } from "@/lib/contractors/types";

import { Badge, CertChip, Restricted } from "./contractor-badges";
import { FlagsPanel } from "./profile-performance";

const dayInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string | null; hint?: string; children: React.ReactNode }) {
  return (
    <div className="ctr-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p className="ctr-small">{hint}</p> : null}
      {error ? <p className="ctr-error" role="alert">{error}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- overview */

export function OverviewPanel({ profile, copy, locale }: { profile: ContractorProfile; copy: Copy; locale: AuthLocale }) {
  const manage = profile.tier === "manage";
  const gaps = profile.gaps ?? [];
  const completeness = manage ? Math.round(((3 - gaps.length) / 3) * 100) : null;
  const fact = (label: string, value: React.ReactNode) => <><dt>{label}</dt><dd>{value || <span className="ctr-muted">{copy.common.notProvided}</span>}</dd></>;
  return (
    <div className="ctr-cols">
      <div className="ctr">
        <section className="sp-surface ctr-panel" aria-label={copy.profile.business}>
          <h3>{copy.profile.business}</h3>
          {manage && profile.business ? (
            <dl className="ctr-facts">
              {fact(copy.profile.legalName, profile.business.legalName)}
              {fact(copy.profile.taxId, profile.business.taxId)}
              {fact(copy.profile.authority, profile.business.registrationAuthority)}
              {fact(copy.profile.grade, profile.business.cidaGrade)}
              {fact(copy.profile.registeredOn, profile.business.registeredOn ? formatDate(profile.business.registeredOn, locale) : "")}
            </dl>
          ) : <Restricted copy={copy} text={copy.profile.businessRestricted} />}
        </section>
        <section className="sp-surface ctr-panel" aria-label={copy.profile.contact}>
          <h3>{copy.profile.contact}</h3>
          {manage && profile.contact ? (
            <dl className="ctr-facts">
              {fact(copy.profile.person, profile.contact.contactPersonName)}
              {fact(copy.form.email, profile.contact.email ? <a href={`mailto:${profile.contact.email}`}>{profile.contact.email}</a> : "")}
              {fact(copy.form.phone, profile.contact.phone)}
              {fact(copy.form.address, profile.contact.address)}
            </dl>
          ) : <Restricted copy={copy} text={copy.profile.contactRestricted} />}
        </section>
        {profile.statusReason ? (
          <section className="sp-surface ctr-panel" aria-label={copy.profile.statusReason}>
            <h3>{copy.profile.statusReason}</h3>
            <p className="ctr-wrap">{profile.statusReason}</p>
            {profile.statusChangedAt ? <p className="ctr-small">{fill(copy.profile.changedAt, { when: formatDateTime(profile.statusChangedAt, locale) })}</p> : null}
          </section>
        ) : null}
      </div>
      <div className="ctr">
        <section className="sp-surface ctr-panel" aria-label={copy.profile.regions}>
          <h3>{copy.profile.regions}</h3>
          <div className="ctr-chips">{profile.operatingDistricts.length ? profile.operatingDistricts.map((d) => <span key={d} className="ctr-tag">{d}</span>) : <span className="ctr-muted">{copy.common.notProvided}</span>}</div>
          <h3>{copy.profile.specializations}</h3>
          <div className="ctr-chips">{profile.specializations.length ? profile.specializations.map((s) => <span key={s} className="ctr-tag">{s}</span>) : <span className="ctr-muted">{copy.common.notProvided}</span>}</div>
        </section>
        {completeness !== null ? (
          <section className="sp-surface ctr-panel" aria-label={copy.profile.completeness}>
            <h3>{copy.profile.completeness}</h3>
            <div className="ctr-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completeness} aria-label={copy.profile.completeness}><i style={{ width: `${completeness}%` }} /></div>
            <p className="ctr-small ctr-num">{completeness}%</p>
            {gaps.length ? <ul className="ctr-small">{gaps.map((g) => <li key={g}>{copy.profile.gaps[g as keyof typeof copy.profile.gaps] ?? g}</li>)}</ul> : <p className="ctr-small">{copy.profile.complete}</p>}
          </section>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- compliance */

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["contractors"] });
}

function CertBody({ contractorId, cert, copy, onClose }: { contractorId: string; cert?: CertificationItem; copy: Copy; onClose: () => void }) {
  const refresh = useRefresh();
  const rid = useId();
  const [v, setV] = useState({ name: cert?.name ?? "", issuer: cert?.issuer ?? "", referenceNumber: cert?.referenceNumber ?? "", issuedOn: dayInput(cert?.issuedOn ?? null), expiresOn: dayInput(cert?.expiresOn ?? null) });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = certificationRow.safeParse(v);
  const msg = (path: string) => { if (!touched || check.success) return null; const i = check.error.issues.find((x) => x.path[0] === path); return i ? copy.form.errors[i.message as keyof typeof copy.form.errors] ?? copy.form.errors.required : null; };
  const body = () => ({ name: v.name.trim(), ...(v.issuer.trim() ? { issuer: v.issuer.trim() } : {}), ...(v.referenceNumber.trim() ? { referenceNumber: v.referenceNumber.trim() } : {}), ...(v.issuedOn ? { issuedOn: v.issuedOn } : {}), ...(v.expiresOn ? { expiresOn: v.expiresOn } : {}) });
  const m = useMutation({
    mutationFn: () => (cert ? updateCertification(contractorId, cert.id, body()) : addCertification(contractorId, body())),
    onSuccess: () => { toast.success(copy.compliance.certSaved); void refresh(); onClose(); },
    onError: (e) => { const f = failureOf(e); setError(failureMessage(f.status, f.kind, copy)); },
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <>
      <DialogHeader><DialogTitle>{cert ? copy.compliance.editCert : copy.compliance.addCert}</DialogTitle><DialogDescription>{copy.form.certifications}</DialogDescription></DialogHeader>
      <form className="ctr-dialog" noValidate onSubmit={(e) => { e.preventDefault(); setTouched(true); setError(null); if (check.success) m.mutate(); }}>
        <Field id={`${rid}-n`} label={copy.form.certName} error={msg("name")}><input id={`${rid}-n`} className="ctr-input" maxLength={160} value={v.name} onChange={set("name")} /></Field>
        <div className="ctr-grid2">
          <Field id={`${rid}-i`} label={copy.form.issuer}><input id={`${rid}-i`} className="ctr-input" maxLength={160} value={v.issuer} onChange={set("issuer")} /></Field>
          <Field id={`${rid}-r`} label={copy.form.reference}><input id={`${rid}-r`} className="ctr-input" maxLength={80} value={v.referenceNumber} onChange={set("referenceNumber")} /></Field>
          <Field id={`${rid}-a`} label={copy.form.issuedOn}><input id={`${rid}-a`} type="date" className="ctr-input" value={v.issuedOn} onChange={set("issuedOn")} /></Field>
          <Field id={`${rid}-e`} label={copy.form.expiresOn} error={msg("expiresOn")}><input id={`${rid}-e`} type="date" className="ctr-input" value={v.expiresOn} onChange={set("expiresOn")} /></Field>
        </div>
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={onClose}>{copy.common.cancel}</button>
          <button type="submit" className="ctr-btn is-primary" disabled={m.isPending}>{copy.common.save}</button>
        </div>
      </form>
    </>
  );
}

function RevokeBody({ contractorId, cert, copy, onClose }: { contractorId: string; cert: CertificationItem; copy: Copy; onClose: () => void }) {
  const refresh = useRefresh();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ok = statusReasonSchema.safeParse(reason).success;
  const m = useMutation({
    mutationFn: () => revokeCertification(contractorId, cert.id, reason.trim()),
    onSuccess: () => { toast.success(copy.compliance.revoked); void refresh(); onClose(); },
    onError: (e) => { const f = failureOf(e); setError(failureMessage(f.status, f.kind, copy)); },
  });
  return (
    <>
      <DialogHeader><DialogTitle>{copy.compliance.revokeTitle}</DialogTitle><DialogDescription>{cert.name} — {copy.compliance.revokeBody}</DialogDescription></DialogHeader>
      <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); if (ok) m.mutate(); }}>
        <Field id="revoke-reason" label={copy.compliance.revokeReason} hint={copy.statusDialog.reasonHint} error={reason && !ok ? copy.form.errors.reasonShort : null}><textarea id="revoke-reason" className="ctr-input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={onClose}>{copy.common.cancel}</button>
          <button type="submit" className="ctr-btn is-danger" disabled={!ok || m.isPending}>{copy.compliance.revokeCert}</button>
        </div>
      </form>
    </>
  );
}

function DocBody({ contractorId, copy, onClose }: { contractorId: string; copy: Copy; onClose: () => void }) {
  const refresh = useRefresh();
  const rid = useId();
  const [v, setV] = useState({ type: "OTHER" as (typeof DOCUMENT_TYPES)[number], title: "", referenceNumber: "", notes: "" });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = documentRow.safeParse(v);
  const m = useMutation({
    mutationFn: () => addDocumentRef(contractorId, { type: v.type, title: v.title.trim(), ...(v.referenceNumber.trim() ? { referenceNumber: v.referenceNumber.trim() } : {}), ...(v.notes.trim() ? { notes: v.notes.trim() } : {}) }),
    onSuccess: () => { toast.success(copy.compliance.docSaved); void refresh(); onClose(); },
    onError: (e) => { const f = failureOf(e); setError(failureMessage(f.status, f.kind, copy)); },
  });
  return (
    <>
      <DialogHeader><DialogTitle>{copy.compliance.addDoc}</DialogTitle><DialogDescription>{copy.form.docHint}</DialogDescription></DialogHeader>
      <form className="ctr-dialog" noValidate onSubmit={(e) => { e.preventDefault(); setTouched(true); setError(null); if (check.success) m.mutate(); }}>
        <Field id={`${rid}-t`} label={copy.form.docType}><select id={`${rid}-t`} className="ctr-input" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as typeof v.type })}>{DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{copy.form.docTypes[t]}</option>)}</select></Field>
        <Field id={`${rid}-n`} label={copy.form.docTitle} error={touched && !check.success ? copy.form.errors.required : null}><input id={`${rid}-n`} className="ctr-input" maxLength={200} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
        <Field id={`${rid}-r`} label={copy.form.reference}><input id={`${rid}-r`} className="ctr-input" maxLength={80} value={v.referenceNumber} onChange={(e) => setV({ ...v, referenceNumber: e.target.value })} /></Field>
        <Field id={`${rid}-o`} label={copy.form.docNotes}><input id={`${rid}-o`} className="ctr-input" maxLength={500} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={onClose}>{copy.common.cancel}</button>
          <button type="submit" className="ctr-btn is-primary" disabled={m.isPending}>{copy.common.save}</button>
        </div>
      </form>
    </>
  );
}

function RemoveDocBody({ contractorId, doc, copy, onClose }: { contractorId: string; doc: DocumentRefItem; copy: Copy; onClose: () => void }) {
  const refresh = useRefresh();
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => removeDocumentRef(contractorId, doc.id),
    onSuccess: () => { toast.success(copy.compliance.docRemoved); void refresh(); onClose(); },
    onError: (e) => { const f = failureOf(e); setError(failureMessage(f.status, f.kind, copy)); },
  });
  return (
    <>
      <DialogHeader><DialogTitle>{copy.compliance.removeDocTitle}</DialogTitle><DialogDescription>{doc.title} — {copy.compliance.removeDocBody}</DialogDescription></DialogHeader>
      {error ? <p className="ctr-error" role="alert">{error}</p> : null}
      <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="ctr-btn" onClick={onClose}>{copy.common.cancel}</button>
        <button type="button" className="ctr-btn is-danger" disabled={m.isPending} onClick={() => m.mutate()}>{copy.compliance.removeDoc}</button>
      </div>
    </>
  );
}

type Modal = { kind: "cert"; cert?: CertificationItem } | { kind: "revoke"; cert: CertificationItem } | { kind: "doc" } | { kind: "removeDoc"; doc: DocumentRefItem } | null;

export function CompliancePanel({ profile, copy, locale, perf, onOpenCompliance }: { profile: ContractorProfile; copy: Copy; locale: AuthLocale; perf?: Performance; onOpenCompliance: () => void }) {
  const [modal, setModal] = useState<Modal>(null);
  const close = () => setModal(null);
  const manage = profile.tier === "manage";
  const certs = profile.certificationList ?? [];
  const docs = profile.documentRefs ?? [];
  const tone = (s: CertificationItem["status"]) => (s === "VALID" ? "success" : s === "EXPIRING" ? "pending" : s === "EXPIRED" || s === "REVOKED" ? "critical" : "neutral") as "success" | "pending" | "critical" | "neutral";
  return (
    <div className="ctr">
      <section className="sp-surface ctr-panel" aria-label={copy.compliance.certifications}>
        <div className="ctr-bar"><h2>{copy.compliance.certifications}</h2>{manage ? <button type="button" className="ctr-btn" onClick={() => setModal({ kind: "cert" })}><PlusIcon aria-hidden="true" />{copy.compliance.addCert}</button> : null}</div>
        {!manage ? (<><CertChip counts={profile.certifications} copy={copy} /><p className="ctr-small">{copy.compliance.managerOnly}</p></>) : certs.length === 0 ? <p className="ctr-small">{copy.form.noCerts}</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }} aria-label={copy.compliance.certifications}>
              <thead><tr>{[copy.form.certName, copy.form.issuer, copy.form.reference, copy.form.expiresOn, copy.cert.health, copy.common.actions].map((h) => <th key={h} scope="col" style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--infra-border)" }}>{h}</th>)}</tr></thead>
              <tbody>
                {certs.map((c) => {
                  const d = daysUntil(c.expiresOn);
                  return (
                    <tr key={c.id}>
                      <td style={{ padding: "0.5rem" }}>{c.name}{c.revokedReason ? <p className="ctr-small">{c.revokedReason}</p> : null}</td>
                      <td style={{ padding: "0.5rem" }}>{c.issuer ?? "—"}</td>
                      <td style={{ padding: "0.5rem" }}>{c.referenceNumber ?? "—"}</td>
                      <td style={{ padding: "0.5rem" }}>{c.expiresOn ? formatDate(c.expiresOn, locale) : copy.cert.noExpiry}{d !== null && c.status !== "REVOKED" ? <p className="ctr-small">{d >= 0 ? fill(copy.cert.expiresIn, { n: d }) : fill(copy.cert.expiredAgo, { n: -d })}</p> : null}</td>
                      <td style={{ padding: "0.5rem" }}><Badge tone={tone(c.status)}>{copy.cert[c.status]}</Badge></td>
                      <td style={{ padding: "0.5rem" }}>
                        {c.status !== "REVOKED" ? (
                          <div className="ctr-row">
                            <button type="button" className="ctr-btn is-ghost" onClick={() => setModal({ kind: "cert", cert: c })}><PencilIcon aria-hidden="true" />{copy.common.edit}</button>
                            <button type="button" className="ctr-btn is-ghost" onClick={() => setModal({ kind: "revoke", cert: c })}><ShieldOffIcon aria-hidden="true" />{copy.compliance.revokeCert}</button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {manage ? (
        <section className="sp-surface ctr-panel" aria-label={copy.compliance.documents}>
          <div className="ctr-bar"><h2>{copy.compliance.documents}</h2><button type="button" className="ctr-btn" onClick={() => setModal({ kind: "doc" })}><PlusIcon aria-hidden="true" />{copy.compliance.addDoc}</button></div>
          <p className="ctr-small">{copy.form.docHint}</p>
          {docs.length === 0 ? <p className="ctr-small">{copy.form.noDocs}</p> : docs.map((d) => (
            <div key={d.id} className="ctr-match">
              <span className="ctr-tag">{copy.form.docTypes[d.type as keyof typeof copy.form.docTypes] ?? d.type}</span>
              <strong className="ctr-wrap">{d.title}</strong>
              {d.referenceNumber ? <span className="ctr-code ctr-muted">{d.referenceNumber}</span> : null}
              {d.documentId ? <span className="ctr-small">{d.documentTitle ? `${copy.compliance.linkedDoc}: ${d.documentTitle}` : copy.compliance.linkedRestricted}</span> : null}
              {d.notes ? <span className="ctr-small">{d.notes}</span> : null}
              <button type="button" className="ctr-btn is-ghost" onClick={() => setModal({ kind: "removeDoc", doc: d })}><Trash2Icon aria-hidden="true" />{copy.compliance.removeDoc}</button>
            </div>
          ))}
        </section>
      ) : null}

      {profile.can.performance && perf ? <FlagsPanel flags={perf.flags} copy={copy} locale={locale} onOpenCompliance={onOpenCompliance} /> : null}

      <Dialog open={modal !== null} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="sm:max-w-lg ctr-dialog">
          {modal?.kind === "cert" ? <CertBody contractorId={profile.id} cert={modal.cert} copy={copy} onClose={close} /> : null}
          {modal?.kind === "revoke" ? <RevokeBody contractorId={profile.id} cert={modal.cert} copy={copy} onClose={close} /> : null}
          {modal?.kind === "doc" ? <DocBody contractorId={profile.id} copy={copy} onClose={close} /> : null}
          {modal?.kind === "removeDoc" ? <RemoveDocBody contractorId={profile.id} doc={modal.doc} copy={copy} onClose={close} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------------------------------------------------- activity */

function eventText(e: TimelineEvent, copy: Copy): string {
  const template = copy.activity.types[e.type as keyof typeof copy.activity.types];
  if (!template) return e.type;
  const p = e.params;
  const role = typeof p.role === "string" ? copy.roles[p.role as "PRIMARY"] ?? p.role : "";
  const outcome = typeof p.outcome === "string" ? copy.inspection[p.outcome as "VERIFIED"] ?? p.outcome : "";
  return fill(template, { ...p, role, outcome });
}

function eventDetail(e: TimelineEvent, copy: Copy): string | null {
  const p = e.params;
  if (e.type === "audit.status_changed") {
    const to = typeof p.status === "string" ? copy.statuses[p.status as keyof typeof copy.statuses] ?? p.status : "";
    const from = typeof p.from === "string" ? copy.statuses[p.from as keyof typeof copy.statuses] ?? p.from : "";
    return [from ? fill(copy.activity.statusChange, { from, to }) : to, typeof p.reason === "string" ? p.reason : ""].filter(Boolean).join(" — ");
  }
  if (e.type === "audit.updated" && typeof p.reason === "string") {
    const fields = p.reason.replace(/^changed:\s*/, "").split(",").map((f) => f.trim()).filter(Boolean).map((f) => copy.activity.fields[f as keyof typeof copy.activity.fields] ?? f);
    return fields.length ? fill(copy.activity.changed, { fields: fields.join(", ") }) : null;
  }
  if ((e.type === "assignment.ended" || e.type === "assignment.terminated" || e.type === "assignment.replaced") && typeof p.reason === "string") return p.reason;
  if (e.type.startsWith("audit.certification") && typeof p.reason === "string") return p.reason;
  if (e.type === "certification.expired" || e.type === "certification.expiring") return typeof p.name === "string" ? p.name : null;
  return null;
}

export function ActivityPanel({ id, copy, locale }: { id: string; copy: Copy; locale: AuthLocale }) {
  const keys = useContractorKeys();
  const q = useInfiniteQuery({
    queryKey: keys.key("timeline", id), queryFn: ({ pageParam }) => fetchTimeline(id, pageParam || undefined), initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined, retry: false,
  });
  const events = q.data?.pages.flatMap((p) => p.events) ?? [];
  return (
    <section className="sp-surface ctr-panel" aria-label={copy.activity.title}>
      <h2>{copy.activity.title}</h2>
      <p className="ctr-small">{copy.activity.scoped}</p>
      {q.isLoading ? <p className="ctr-small">{copy.common.loading}</p> : null}
      {q.error ? <div role="alert"><p className="ctr-error">{copy.common.unavailable}</p><button type="button" className="ctr-btn" onClick={() => void q.refetch()}>{copy.common.retry}</button></div> : null}
      {!q.isLoading && !q.error && events.length === 0 ? <p className="ctr-small">{copy.activity.empty}</p> : null}
      <ul className="ctr-act">
        {events.map((e) => {
          const detail = eventDetail(e, copy);
          return (
            <li key={e.key}>
              <strong className="ctr-wrap">{eventText(e, copy)}</strong>
              {detail ? <span className="ctr-small ctr-wrap">{detail}</span> : null}
              <span className="ctr-small"><time dateTime={e.at} title={formatDateTime(e.at, locale)}>{relativeTime(e.at, locale)} · {formatDateTime(e.at, locale)}</time>{e.actor ? ` · ${fill(copy.activity.by, { name: e.actor })}` : ""}</span>
            </li>
          );
        })}
      </ul>
      {q.hasNextPage ? <div><button type="button" className="ctr-btn" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{copy.activity.loadMore}</button></div> : null}
    </section>
  );
}

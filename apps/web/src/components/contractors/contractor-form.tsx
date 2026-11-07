"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SRI_LANKA_PROVINCES } from "@infraos/shared-types";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchAgencies } from "@/lib/admin-agencies/api";
import { failureOf, registerContractor, updateContractor } from "@/lib/contractors/api";
import { formatDate, fill } from "@/lib/contractors/format";
import { failureMessage, type Copy } from "@/lib/contractors/messages";
import { contractorFormSchema, EMPTY_FORM, STEP_FIELDS, toPatchBody, toRegisterBody, type ContractorFormValues } from "@/lib/contractors/schema";
import { useContractorKeys } from "@/lib/contractors/session";
import { CONTRACTOR_CATEGORIES, DOCUMENT_TYPES, type ContractorProfile } from "@/lib/contractors/types";
import type { AuthLocale } from "@/lib/auth/types";

import { DuplicateCheckPanel, type DuplicateVerdict } from "./duplicate-check-panel";

const isoDay = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

export function profileToForm(p: ContractorProfile): ContractorFormValues {
  return {
    ...EMPTY_FORM, name: p.name, registrationNumber: p.registrationNumber, category: p.category ?? "GENERAL", specializationsText: p.specializations.join(", "), operatingDistricts: p.operatingDistricts,
    contactPersonName: p.contact?.contactPersonName ?? "", email: p.contact?.email ?? "", phone: p.contact?.phone ?? "", address: p.contact?.address ?? "",
    legalName: p.business?.legalName ?? "", taxId: p.business?.taxId ?? "", registrationAuthority: p.business?.registrationAuthority ?? "", cidaGrade: p.business?.cidaGrade ?? "", registeredOn: isoDay(p.business?.registeredOn),
  };
}

/** Warns before the tab closes or an in-app link is followed while there are unsaved edits. Programmatic saves bypass it. */
function useUnsavedGuard(dirty: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== window.location.origin || a.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(a.pathname + a.search);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", onClick, true); };
  }, [dirty]);
  return { pending, stay: () => setPending(null), leave: () => { const to = pending; setPending(null); if (to) router.push(to); } };
}

function Field({ id, label, hint, error, required, children }: { id: string; label: string; hint?: string; error?: string | null; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="ctr-field">
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      {children}
      {hint ? <p className="ctr-small" id={`${id}-hint`}>{hint}</p> : null}
      {error ? <p className="ctr-error" role="alert" id={`${id}-err`}>{error}</p> : null}
    </div>
  );
}

export function ContractorForm({ mode, profile, copy, locale, roleKey }: { mode: "create" | "edit"; profile?: ContractorProfile; copy: Copy; locale: AuthLocale; roleKey: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const keys = useContractorKeys();
  const rid = useId();
  const stepIndexes = mode === "create" ? [0, 1, 2, 3] : [0, 1, 3];
  const [pos, setPos] = useState(0);
  const step = stepIndexes[pos]!;
  const [verdict, setVerdict] = useState<DuplicateVerdict>({ blocked: false, possible: 0 });
  const [agencyId, setAgencyId] = useState("");
  const [regReason, setRegReason] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [staleOpen, setStaleOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const form = useForm<ContractorFormValues>({ resolver: zodResolver(contractorFormSchema), defaultValues: profile ? profileToForm(profile) : EMPTY_FORM, mode: "onTouched" });
  const { register, control, handleSubmit, trigger, setValue, setError, formState: { errors, isDirty, isSubmitting } } = form;
  const certs = useFieldArray({ control, name: "certifications" });
  const docs = useFieldArray({ control, name: "documentRefs" });
  const values = useWatch({ control }) as ContractorFormValues;
  const guard = useUnsavedGuard(isDirty && !saved);

  const agencies = useQuery({ queryKey: keys.key("agencies"), queryFn: () => fetchAgencies({ page: 1 }), enabled: mode === "create", retry: false, staleTime: 60_000 });
  const err = (name: FieldPath<ContractorFormValues>) => {
    const parts = name.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = errors;
    for (const p of parts) node = node?.[p];
    const message = node?.message as string | undefined;
    return message ? copy.form.errors[message as keyof typeof copy.form.errors] ?? copy.form.errors.required : null;
  };
  const isPlatform = profile?.can.platform ?? roleKey === "SUPER_ADMIN";
  const registrationLocked = mode === "edit" && !isPlatform && (profile?.totalAssignments ?? 0) > 0;
  const registrationChanged = mode === "edit" && values.registrationNumber.trim().toUpperCase() !== profile?.registrationNumber;
  const regReasonOk = !registrationChanged || regReason.trim().length >= 12;
  const onVerdict = useCallback((v: DuplicateVerdict) => setVerdict(v), []);
  const needsAck = mode === "create" && verdict.possible > 0;
  const ackOk = !needsAck || (values.confirmNotDuplicate && values.duplicateAcknowledgement.trim().length >= 12);

  const mutation = useMutation({
    mutationFn: async (v: ContractorFormValues) => {
      if (mode === "create") return registerContractor(toRegisterBody(v, agencyId ? { agencyId } : undefined));
      return updateContractor(profile!.id, toPatchBody(v, profile!.updatedAt ?? "", registrationChanged ? regReason.trim() : undefined, profile!.registrationNumber));
    },
    onSuccess: (res) => {
      setSaved(true);
      toast.success(mode === "create" ? copy.form.created : copy.form.saved);
      void qc.invalidateQueries({ queryKey: ["contractors"] });
      router.push(`/contractors/${res.id}`);
    },
    onError: (e) => {
      const f = failureOf(e);
      if (f.status === 409 && f.kind === "stale") { setStaleOpen(true); return; }
      if (f.status === 409 && f.kind === "exact") {
        const field = String(f.details.field ?? "");
        if (field === "taxIdKey") { setError("taxId", { message: "taxClash" }); setPos(stepIndexes.indexOf(1)); }
        else { setError("registrationNumber", { message: "regClash" }); setPos(0); }
        setServerError(field === "taxIdKey" ? copy.form.taxClash : copy.form.registrationClash);
        void qc.invalidateQueries({ queryKey: keys.key("dup") });
        return;
      }
      if (f.status === 409 && f.kind === "possible") { void qc.invalidateQueries({ queryKey: keys.key("dup") }); setServerError(copy.form.ackRequired); return; }
      if (f.status === 403 && f.kind === "registration_locked") { setServerError(copy.form.registrationLocked); return; }
      setServerError(f.status === 403 ? copy.form.forbidden : failureMessage(f.status, f.kind, copy));
    },
  });

  async function next() {
    const ok = await trigger([...STEP_FIELDS[step]] as FieldPath<ContractorFormValues>[]);
    if (ok && (step !== 0 || (!verdict.blocked && regReasonOkForStep()))) setPos((p) => Math.min(p + 1, stepIndexes.length - 1));
  }
  const regReasonOkForStep = () => regReasonOk;
  const submit = handleSubmit((v) => { setServerError(null); if (verdict.blocked || !ackOk || !regReasonOk) return; mutation.mutate(v); });

  const districtSet = new Set(values.operatingDistricts);
  const toggleDistrict = (d: string) => setValue("operatingDistricts", districtSet.has(d) ? values.operatingDistricts.filter((x) => x !== d) : [...values.operatingDistricts, d], { shouldDirty: true, shouldValidate: true });
  const selectProvince = (province: keyof typeof SRI_LANKA_PROVINCES) => setValue("operatingDistricts", [...new Set([...values.operatingDistricts, ...SRI_LANKA_PROVINCES[province]])], { shouldDirty: true, shouldValidate: true });

  const dupInputs = { registrationNumber: values.registrationNumber, name: values.name, taxId: values.taxId, email: values.email };
  const panel = (showAck: boolean) => (
    <DuplicateCheckPanel copy={copy} inputs={dupInputs} excludeId={profile?.id} ack={values.confirmNotDuplicate} note={values.duplicateAcknowledgement} showAck={showAck && mode === "create"}
      onAck={(v) => setValue("confirmNotDuplicate", v, { shouldDirty: true })} onNote={(v) => setValue("duplicateAcknowledgement", v, { shouldDirty: true })} onVerdict={onVerdict} />
  );
  const cat = (c: string) => copy.categories[c as keyof Copy["categories"]] ?? c;

  return (
    <form className="ctr" onSubmit={submit} noValidate aria-label={mode === "create" ? copy.form.createTitle : copy.form.editTitle}>
      <ol className="ctr-steps" aria-label={fill(copy.form.stepOf, { n: pos + 1, total: stepIndexes.length })}>
        {stepIndexes.map((idx, i) => (
          <li key={idx} aria-current={i === pos ? "step" : undefined} className={i < pos ? "is-done" : undefined}><span className="n">{i + 1}</span>{copy.form.steps[idx]}</li>
        ))}
      </ol>

      {step === 0 ? (
        <section className="sp-surface ctr-panel" aria-label={copy.form.steps[0]}>
          <div className="ctr-grid2">
            <Field id={`${rid}-name`} label={copy.form.name} required error={err("name")}><input id={`${rid}-name`} className="ctr-input" maxLength={200} aria-invalid={Boolean(err("name"))} {...register("name")} /></Field>
            <Field id={`${rid}-reg`} label={copy.form.registrationNumber} required hint={registrationLocked ? copy.form.registrationLocked : copy.form.registrationHint} error={err("registrationNumber")}>
              <input id={`${rid}-reg`} className="ctr-input ctr-code" maxLength={80} autoCapitalize="characters" disabled={registrationLocked} aria-invalid={Boolean(err("registrationNumber"))} aria-describedby={`${rid}-reg-hint`}
                {...register("registrationNumber", { onChange: (e) => setValue("registrationNumber", String(e.target.value).toUpperCase(), { shouldDirty: true }) })} />
            </Field>
          </div>
          {registrationChanged ? (
            <Field id={`${rid}-rr`} label={copy.form.changeReason} hint={copy.statusDialog.reasonHint} error={!regReasonOk ? copy.form.errors.reasonShort : null}>
              <textarea id={`${rid}-rr`} className="ctr-input" maxLength={500} value={regReason} onChange={(e) => setRegReason(e.target.value)} />
            </Field>
          ) : null}
          <div className="ctr-grid2">
            <Field id={`${rid}-cat`} label={copy.form.category} required error={err("category")}>
              <select id={`${rid}-cat`} className="ctr-input" {...register("category")}>{CONTRACTOR_CATEGORIES.map((c) => <option key={c} value={c}>{cat(c)}</option>)}</select>
            </Field>
            <Field id={`${rid}-spec`} label={copy.form.specializations} hint={copy.form.specializationsHint} error={err("specializationsText")}>
              <input id={`${rid}-spec`} className="ctr-input" aria-describedby={`${rid}-spec-hint`} {...register("specializationsText")} />
            </Field>
          </div>
          {mode === "create" ? (
            <Field id={`${rid}-agency`} label={copy.form.agencyForPlatform}>
              <select id={`${rid}-agency`} className="ctr-input" value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
                <option value="">{copy.common.any}</option>
                {(agencies.data?.agencies ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          ) : null}
          <fieldset className="ctr-field" style={{ border: 0, padding: 0 }}>
            <legend className="ctr-label">{copy.form.districts}</legend>
            <p className="ctr-small">{copy.form.districtsHint} {fill(copy.form.districtsCount, { n: values.operatingDistricts.length })}</p>
            {(Object.keys(SRI_LANKA_PROVINCES) as (keyof typeof SRI_LANKA_PROVINCES)[]).map((province) => (
              <div key={province} className="ctr-row" role="group" aria-label={copy.provinces[province]}>
                <strong style={{ minWidth: "7rem" }}>{copy.provinces[province]}</strong>
                {SRI_LANKA_PROVINCES[province].map((d) => (
                  <button key={d} type="button" className="ctr-chip-btn" aria-pressed={districtSet.has(d)} onClick={() => toggleDistrict(d)}>{d}</button>
                ))}
                <button type="button" className="ctr-btn is-ghost" onClick={() => selectProvince(province)}>{fill(copy.form.selectProvince, { province: copy.provinces[province] })}</button>
              </div>
            ))}
            <div className="ctr-row"><button type="button" className="ctr-btn is-ghost" onClick={() => setValue("operatingDistricts", [], { shouldDirty: true })}>{copy.form.clearDistricts}</button></div>
            {err("operatingDistricts") ? <p className="ctr-error" role="alert">{err("operatingDistricts")}</p> : null}
          </fieldset>
          {panel(false)}
        </section>
      ) : null}

      {step === 1 ? (
        <section className="sp-surface ctr-panel" aria-label={copy.form.steps[1]}>
          <h3>{copy.profile.contact}</h3>
          <div className="ctr-grid2">
            <Field id={`${rid}-cp`} label={copy.form.contactPerson} error={err("contactPersonName")}><input id={`${rid}-cp`} className="ctr-input" {...register("contactPersonName")} /></Field>
            <Field id={`${rid}-em`} label={copy.form.email} error={err("email")}><input id={`${rid}-em`} type="email" className="ctr-input" aria-invalid={Boolean(err("email"))} {...register("email")} /></Field>
            <Field id={`${rid}-ph`} label={copy.form.phone} error={err("phone")}><input id={`${rid}-ph`} type="tel" className="ctr-input" {...register("phone")} /></Field>
            <Field id={`${rid}-ad`} label={copy.form.address} error={err("address")}><input id={`${rid}-ad`} className="ctr-input" {...register("address")} /></Field>
          </div>
          <h3>{copy.profile.business}</h3>
          <div className="ctr-grid2">
            <Field id={`${rid}-ln`} label={copy.form.legalName} error={err("legalName")}><input id={`${rid}-ln`} className="ctr-input" {...register("legalName")} /></Field>
            <Field id={`${rid}-tx`} label={copy.form.taxId} hint={copy.form.taxHint} error={err("taxId")}><input id={`${rid}-tx`} className="ctr-input" autoComplete="off" aria-describedby={`${rid}-tx-hint`} {...register("taxId")} /></Field>
            <Field id={`${rid}-au`} label={copy.form.authority} hint={copy.form.authorityHint} error={err("registrationAuthority")}><input id={`${rid}-au`} className="ctr-input" aria-describedby={`${rid}-au-hint`} {...register("registrationAuthority")} /></Field>
            <Field id={`${rid}-gr`} label={copy.form.grade} error={err("cidaGrade")}><input id={`${rid}-gr`} className="ctr-input" {...register("cidaGrade")} /></Field>
            <Field id={`${rid}-ro`} label={copy.form.registeredOn} error={err("registeredOn")}><input id={`${rid}-ro`} type="date" className="ctr-input" {...register("registeredOn")} /></Field>
          </div>
          {panel(false)}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="sp-surface ctr-panel" aria-label={copy.form.steps[2]}>
          <h3>{copy.form.certifications}</h3>
          {certs.fields.length === 0 ? <p className="ctr-small">{copy.form.noCerts}</p> : null}
          {certs.fields.map((f, i) => (
            <div key={f.id} className="ctr-repeat" role="group" aria-label={`${copy.form.certName} ${i + 1}`}>
              <div className="ctr-grid2">
                <Field id={`${rid}-c${i}n`} label={copy.form.certName} required error={err(`certifications.${i}.name`)}><input id={`${rid}-c${i}n`} className="ctr-input" {...register(`certifications.${i}.name`)} /></Field>
                <Field id={`${rid}-c${i}i`} label={copy.form.issuer} error={err(`certifications.${i}.issuer`)}><input id={`${rid}-c${i}i`} className="ctr-input" {...register(`certifications.${i}.issuer`)} /></Field>
                <Field id={`${rid}-c${i}r`} label={copy.form.reference} error={err(`certifications.${i}.referenceNumber`)}><input id={`${rid}-c${i}r`} className="ctr-input" {...register(`certifications.${i}.referenceNumber`)} /></Field>
                <div className="ctr-grid2">
                  <Field id={`${rid}-c${i}a`} label={copy.form.issuedOn} error={err(`certifications.${i}.issuedOn`)}><input id={`${rid}-c${i}a`} type="date" className="ctr-input" {...register(`certifications.${i}.issuedOn`)} /></Field>
                  <Field id={`${rid}-c${i}e`} label={copy.form.expiresOn} error={err(`certifications.${i}.expiresOn`)}><input id={`${rid}-c${i}e`} type="date" className="ctr-input" {...register(`certifications.${i}.expiresOn`)} /></Field>
                </div>
              </div>
              <div><button type="button" className="ctr-btn is-ghost" onClick={() => certs.remove(i)}><Trash2Icon aria-hidden="true" />{copy.common.remove}</button></div>
            </div>
          ))}
          <div><button type="button" className="ctr-btn" disabled={certs.fields.length >= 20} onClick={() => certs.append({ name: "", issuer: "", referenceNumber: "", issuedOn: "", expiresOn: "" })}><PlusIcon aria-hidden="true" />{copy.form.addCertification}</button></div>

          <h3>{copy.form.documents}</h3>
          <p className="ctr-small">{copy.form.docHint}</p>
          {docs.fields.length === 0 ? <p className="ctr-small">{copy.form.noDocs}</p> : null}
          {docs.fields.map((f, i) => (
            <div key={f.id} className="ctr-repeat" role="group" aria-label={`${copy.form.docTitle} ${i + 1}`}>
              <div className="ctr-grid2">
                <Field id={`${rid}-d${i}t`} label={copy.form.docType}><select id={`${rid}-d${i}t`} className="ctr-input" {...register(`documentRefs.${i}.type`)}>{DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{copy.form.docTypes[t]}</option>)}</select></Field>
                <Field id={`${rid}-d${i}n`} label={copy.form.docTitle} required error={err(`documentRefs.${i}.title`)}><input id={`${rid}-d${i}n`} className="ctr-input" {...register(`documentRefs.${i}.title`)} /></Field>
                <Field id={`${rid}-d${i}r`} label={copy.form.reference} error={err(`documentRefs.${i}.referenceNumber`)}><input id={`${rid}-d${i}r`} className="ctr-input" {...register(`documentRefs.${i}.referenceNumber`)} /></Field>
                <Field id={`${rid}-d${i}o`} label={copy.form.docNotes} error={err(`documentRefs.${i}.notes`)}><input id={`${rid}-d${i}o`} className="ctr-input" {...register(`documentRefs.${i}.notes`)} /></Field>
              </div>
              <div><button type="button" className="ctr-btn is-ghost" onClick={() => docs.remove(i)}><Trash2Icon aria-hidden="true" />{copy.common.remove}</button></div>
            </div>
          ))}
          <div><button type="button" className="ctr-btn" disabled={docs.fields.length >= 30} onClick={() => docs.append({ type: "OTHER", title: "", referenceNumber: "", notes: "" })}><PlusIcon aria-hidden="true" />{copy.form.addDocument}</button></div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="sp-surface ctr-panel" aria-label={copy.form.review}>
          <h3>{copy.form.review}</h3>
          <p className="ctr-small">{copy.form.reviewHint}</p>
          <dl className="ctr-summary">
            <dt>{copy.form.name}</dt><dd>{values.name || "—"}</dd>
            <dt>{copy.form.registrationNumber}</dt><dd className="ctr-code">{values.registrationNumber || "—"}</dd>
            <dt>{copy.form.category}</dt><dd>{cat(values.category)}</dd>
            <dt>{copy.form.specializations}</dt><dd>{values.specializationsText || "—"}</dd>
            <dt>{copy.form.districts}</dt><dd>{values.operatingDistricts.join(", ") || "—"}</dd>
            <dt>{copy.form.contactPerson}</dt><dd>{values.contactPersonName || "—"}</dd>
            <dt>{copy.form.email}</dt><dd>{values.email || "—"}</dd>
            <dt>{copy.form.phone}</dt><dd>{values.phone || "—"}</dd>
            <dt>{copy.form.taxId}</dt><dd>{values.taxId ? "•••• " + values.taxId.slice(-3) : "—"}</dd>
            <dt>{copy.form.authority}</dt><dd>{values.registrationAuthority || "—"} {values.cidaGrade ? `(${values.cidaGrade})` : ""}</dd>
            <dt>{copy.form.registeredOn}</dt><dd>{values.registeredOn ? formatDate(values.registeredOn, locale) : "—"}</dd>
            {mode === "create" ? <><dt>{copy.form.certifications}</dt><dd>{values.certifications.map((c) => c.name).filter(Boolean).join(", ") || "—"}</dd>
            <dt>{copy.form.documents}</dt><dd>{values.documentRefs.map((d) => d.title).filter(Boolean).join(", ") || "—"}</dd></> : null}
          </dl>
          {panel(true)}
        </section>
      ) : null}

      {serverError ? <p className="ctr-error" role="alert">{serverError}</p> : null}
      {Object.keys(errors).length > 0 && step === 3 ? <p className="ctr-error" role="alert">{copy.form.errors.required}</p> : null}

      <div className="ctr-bar">
        <button type="button" className="ctr-btn" disabled={pos === 0} onClick={() => setPos((p) => Math.max(0, p - 1))}>{copy.common.back}</button>
        {pos < stepIndexes.length - 1 ? (
          <button type="button" className="ctr-btn is-primary" onClick={next} disabled={step === 0 && verdict.blocked}>{copy.common.next}</button>
        ) : (
          <button type="submit" className="ctr-btn is-primary" disabled={isSubmitting || mutation.isPending || verdict.blocked || !ackOk || !regReasonOk}>
            {mutation.isPending ? copy.form.submitting : mode === "create" ? copy.form.submitCreate : copy.form.submitEdit}
          </button>
        )}
      </div>

      <Dialog open={staleOpen} onOpenChange={setStaleOpen}>
        <DialogContent className="sm:max-w-md ctr-dialog">
          <DialogHeader><DialogTitle>{copy.form.stale.title}</DialogTitle><DialogDescription>{copy.form.stale.body}</DialogDescription></DialogHeader>
          <DialogFooter><button type="button" className="ctr-btn is-primary" onClick={() => { setSaved(true); window.location.reload(); }}>{copy.form.stale.action}</button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={guard.pending !== null} onOpenChange={(o) => { if (!o) guard.stay(); }}>
        <DialogContent className="sm:max-w-md ctr-dialog">
          <DialogHeader><DialogTitle>{copy.form.unsaved}</DialogTitle><DialogDescription>{copy.form.unsaved}</DialogDescription></DialogHeader>
          <DialogFooter>
            <button type="button" className="ctr-btn" onClick={guard.stay}>{copy.form.stay}</button>
            <button type="button" className="ctr-btn is-danger" onClick={guard.leave}>{copy.form.leave}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, CheckCircle2Icon, LoaderIcon, OctagonAlertIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { checkDuplicates } from "@/lib/contractors/api";
import type { Copy } from "@/lib/contractors/messages";
import { useContractorKeys } from "@/lib/contractors/session";
import type { DuplicateMatch, DuplicateResult } from "@/lib/contractors/types";

import { StatusBadge } from "./contractor-badges";

export type DuplicateInputs = { registrationNumber: string; name: string; taxId: string; email: string };
export type DuplicateVerdict = { blocked: boolean; possible: number };

const REG = /^[A-Z0-9][A-Z0-9/-]*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only fields that would pass the server's own validation are sent, so typing never causes a 400. */
export function sendableInputs(v: DuplicateInputs): { registrationNumber?: string; name?: string; taxId?: string; email?: string } {
  const reg = v.registrationNumber.trim().toUpperCase();
  return {
    ...(reg && REG.test(reg) && reg.length <= 80 ? { registrationNumber: reg } : {}),
    ...(v.name.trim().length >= 2 ? { name: v.name.trim().slice(0, 200) } : {}),
    ...(v.taxId.trim() ? { taxId: v.taxId.trim().slice(0, 40) } : {}),
    ...(EMAIL.test(v.email.trim()) ? { email: v.email.trim() } : {}),
  };
}

function Match({ m, copy }: { m: DuplicateMatch; copy: Copy }) {
  return (
    <div className="ctr-match">
      <strong className="ctr-wrap">{m.name}</strong>
      <span className="ctr-code ctr-muted">{m.registrationNumber}</span>
      <StatusBadge status={m.status} copy={copy} />
      <span className="ctr-small">{m.reasons.map((r) => copy.duplicate.reasons[r as keyof typeof copy.duplicate.reasons] ?? r).join(" · ")}</span>
      <Link className="ctr-btn is-ghost" href={`/contractors/${m.id}`} target="_blank" rel="noreferrer">{copy.duplicate.openExisting}</Link>
    </div>
  );
}

/**
 * Live duplicate panel. Exact matches (registration number or tax ID) block registration; possible matches (same name or email) need the
 * "different companies" tick and a written reason. An exact clash outside the viewer's access is reported as a bare statement.
 */
export function DuplicateCheckPanel({ copy, inputs, excludeId, ack, note, onAck, onNote, onVerdict, showAck = true }: {
  copy: Copy; inputs: DuplicateInputs; excludeId?: string; ack: boolean; note: string; onAck: (v: boolean) => void; onNote: (v: string) => void; onVerdict: (v: DuplicateVerdict) => void; showAck?: boolean;
}) {
  const keys = useContractorKeys();
  const send = sendableInputs(inputs);
  const signature = JSON.stringify(send);
  const [debounced, setDebounced] = useState(signature);
  useEffect(() => { const t = setTimeout(() => setDebounced(signature), 400); return () => clearTimeout(t); }, [signature]);
  const params = JSON.parse(debounced) as ReturnType<typeof sendableInputs>;
  const enabled = Object.keys(params).length > 0;
  const q = useQuery<DuplicateResult>({
    queryKey: keys.key("dup", debounced, excludeId ?? ""),
    queryFn: ({ signal }) => checkDuplicates({ ...params, ...(excludeId ? { excludeId } : {}) }, signal),
    enabled, retry: false, staleTime: 5_000,
  });
  const id = useId();
  const data = enabled ? q.data : undefined;
  const exact = data?.exact ?? [];
  const possible = data?.possible ?? [];
  const outside = Boolean(data?.existsOutsideScope);
  const blocked = exact.length > 0 || outside;

  useEffect(() => { onVerdict({ blocked, possible: possible.length }); }, [blocked, possible.length, onVerdict]);

  const state = !enabled ? "idle" : q.isFetching && !data ? "checking" : q.isError ? "failed" : blocked ? "exact" : possible.length ? "possible" : "clear";
  const Icon = state === "exact" ? OctagonAlertIcon : state === "possible" ? AlertTriangleIcon : state === "clear" ? CheckCircle2Icon : state === "checking" ? LoaderIcon : SearchIcon;
  return (
    <section className="ctr-dup" data-state={state} aria-labelledby={`${id}-t`} aria-live="polite">
      <h3 id={`${id}-t`} className="ctr-row"><Icon aria-hidden="true" width={18} height={18} />{copy.duplicate.title}</h3>
      {state === "idle" ? <p className="ctr-small">{copy.duplicate.idle}</p> : null}
      {state === "checking" ? <p className="ctr-small">{copy.duplicate.checking}</p> : null}
      {state === "failed" ? <p className="ctr-small">{copy.duplicate.failed}</p> : null}
      {state === "clear" ? <p className="ctr-small">{copy.duplicate.clear}</p> : null}
      {blocked ? (
        <div role="alert" className="ctr-dup" style={{ padding: 0, boxShadow: "none", background: "transparent" }}>
          <p className="ctr-error">{copy.duplicate.exact}: {copy.duplicate.exactBody}</p>
          {exact.map((m) => <Match key={m.id} m={m} copy={copy} />)}
          {outside ? <p className="ctr-error">{copy.duplicate.outside}</p> : null}
        </div>
      ) : null}
      {possible.length ? (
        <>
          <p className="ctr-small"><strong>{copy.duplicate.possible}.</strong> {copy.duplicate.possibleBody}</p>
          {possible.map((m) => <Match key={m.id} m={m} copy={copy} />)}
          {showAck && !blocked ? (
            <>
              <label className="ctr-check"><input type="checkbox" checked={ack} onChange={(e) => onAck(e.target.checked)} />{copy.form.ack}</label>
              {ack ? (
                <div className="ctr-field">
                  <label htmlFor={`${id}-n`}>{copy.form.ackNote}</label>
                  <textarea id={`${id}-n`} className="ctr-input" maxLength={500} value={note} onChange={(e) => onNote(e.target.value)} aria-invalid={note.trim().length < 12} />
                  {note.trim().length < 12 ? <p className="ctr-error" role="alert">{copy.form.errors.reasonShort}</p> : null}
                </div>
              ) : <p className="ctr-small">{copy.form.ackRequired}</p>}
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

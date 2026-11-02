"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Dialog } from "radix-ui";

/** One confirmation dialog for submit, cancel and delete. A reason box appears only when `reason` is set. */
export function ConfirmDialog({ title, body, confirmLabel, keepLabel, tone = "primary", pending, reason, onConfirm, onClose }: {
  title: string; body: string; confirmLabel: string; keepLabel: string; tone?: "primary" | "danger"; pending: boolean;
  reason?: { label: string; help: string; min: number }; onConfirm: (reason: string) => void; onClose: () => void;
}) {
  const [text, setText] = useState("");
  const blocked = pending || Boolean(reason && text.trim().length < reason.min);
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="rs-overlay" />
        <Dialog.Content className="rs-dialog">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{body}</Dialog.Description>
          {reason ? (
            <div className="rs-field">
              <label className="rs-label" htmlFor="rs-dialog-reason">{reason.label}</label>
              <textarea id="rs-dialog-reason" className="rs-input" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} aria-describedby="rs-dialog-reason-help" />
              <p id="rs-dialog-reason-help" className="rs-help">{reason.help} ({text.trim().length}/{reason.min})</p>
            </div>
          ) : null}
          <div className="rs-dialog-actions">
            <button type="button" className="rs-btn" onClick={onClose} disabled={pending}>{keepLabel}</button>
            <button type="button" className={`rs-btn ${tone === "danger" ? "is-danger" : "is-primary"}`} disabled={blocked} aria-busy={pending} onClick={() => onConfirm(text.trim())}>
              {pending ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : null}
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

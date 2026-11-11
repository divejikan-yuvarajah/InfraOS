"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchAboutAi } from "@/lib/ai-admin/api";
import type { InspectionAiMessages } from "@/lib/inspections/ai/messages";

import { fill } from "@/lib/inspections/view";
import "@/styles/contractors.css";
import "@/styles/inspections.css";

function ProviderNoticeBody({
  photoCount,
  copy,
  busy,
  onCancel,
  onConfirm,
}: {
  photoCount: number;
  copy: InspectionAiMessages;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  const aboutQuery = useQuery({
    queryKey: ["ai", "about"],
    queryFn: ({ signal }) => fetchAboutAi(signal),
    staleTime: 60_000,
    retry: false,
  });

  const policyText = aboutQuery.data
    ? `${aboutQuery.data.provider.name} — ${aboutQuery.data.provider.dataHandlingPolicy}`
    : copy.noticeDialog.providerFallback;

  return (
    <>
      <div style={{ display: "grid", gap: "0.75rem", fontSize: "0.88rem" }}>
        <section className="ins-panel">
          <h4 className="ins-h" style={{ fontSize: "0.9rem", marginBottom: "0.35rem" }}>
            {copy.noticeDialog.sentHeading}
          </h4>
          <ul style={{ margin: 0, paddingInlineStart: "1.2rem", display: "grid", gap: "0.2rem" }}>
            <li>{fill(copy.noticeDialog.sentItems.photos, { n: photoCount })}</li>
            <li>{copy.noticeDialog.sentItems.projectType}</li>
            <li>{copy.noticeDialog.sentItems.milestones}</li>
            <li>{copy.noticeDialog.sentItems.claimed}</li>
          </ul>
        </section>

        <section className="ins-panel">
          <h4 className="ins-h" style={{ fontSize: "0.9rem", marginBottom: "0.35rem" }}>
            {copy.noticeDialog.notSentHeading}
          </h4>
          <ul style={{ margin: 0, paddingInlineStart: "1.2rem", display: "grid", gap: "0.2rem" }}>
            <li>{copy.noticeDialog.notSentItems.names}</li>
            <li>{copy.noticeDialog.notSentItems.gps}</li>
            <li>{copy.noticeDialog.notSentItems.filenames}</li>
            <li>{copy.noticeDialog.notSentItems.unselected}</li>
          </ul>
        </section>

        <section className="ins-panel">
          <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{copy.noticeDialog.providerLabel}</div>
          <p className="ins-muted" style={{ margin: "0 0 0.35rem" }}>{policyText}</p>
          <Link
            href="/ai/about"
            className="ctr-link ctr-row"
            style={{ gap: "0.3rem", fontSize: "0.84rem", width: "fit-content" }}
          >
            <span>{copy.noticeDialog.aboutLink}</span>
            <ExternalLinkIcon aria-hidden="true" style={{ width: "0.85rem", height: "0.85rem" }} />
          </Link>
        </section>

        <label
          className="ctr-row"
          style={{
            gap: "0.55rem",
            alignItems: "flex-start",
            padding: "0.6rem 0.7rem",
            borderRadius: "8px",
            border: "1px solid var(--border, #d4d4d8)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={busy}
            style={{ marginTop: "0.18rem" }}
          />
          <span>{copy.noticeDialog.checkboxLabel}</span>
        </label>
      </div>

      <DialogFooter className="ctr-row" style={{ gap: "0.5rem", marginTop: "0.5rem" }}>
        <button type="button" className="ctr-btn is-ghost" onClick={onCancel} disabled={busy}>
          {copy.noticeDialog.cancel}
        </button>
        <button
          type="button"
          className="ctr-btn is-primary"
          disabled={!acknowledged || busy}
          onClick={onConfirm}
        >
          {copy.noticeDialog.confirmRun}
        </button>
      </DialogFooter>
    </>
  );
}

export function ProviderNoticeDialog({
  open,
  photoCount,
  copy,
  busy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  photoCount: number;
  copy: InspectionAiMessages;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-xl ctr-dialog max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="ctr-row" style={{ gap: "0.45rem" }}>
            <ShieldCheckIcon aria-hidden="true" style={{ width: "1.1rem", height: "1.1rem" }} />
            <span>{copy.noticeDialog.title}</span>
          </DialogTitle>
          <DialogDescription>{copy.noticeDialog.subtitle}</DialogDescription>
        </DialogHeader>
        {open ? (
          <ProviderNoticeBody
            photoCount={photoCount}
            copy={copy}
            busy={busy}
            onCancel={() => onOpenChange(false)}
            onConfirm={onConfirm}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

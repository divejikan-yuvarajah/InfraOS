"use client";

import {
  BadgeCheckIcon, CameraIcon, CircleDashedIcon, CircleDotIcon, ClipboardCheckIcon, ClipboardListIcon, ArchiveIcon, FileIcon, FileSignatureIcon, FileSpreadsheetIcon, FileTextIcon, GavelIcon, HandshakeIcon, ImageIcon,
  LightbulbIcon, ListOrderedIcon, MailIcon, PencilRulerIcon, ReceiptIcon, ShieldAlertIcon, StampIcon, TrendingUpIcon, WalletIcon, WrenchIcon, type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { categoryDef } from "@infraos/shared-types";

import { Chip, EmptyState, Field, Skeletons } from "@/components/inspections/inspection-ui";
import { AiChip } from "./ai/ai-ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAiCopy } from "@/lib/documents/ai/messages";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { failureOf } from "@/lib/documents/api";
import type { Copy } from "@/lib/documents/messages";
import type { DocItem, DocStatus, Segment } from "@/lib/documents/types";
import { familyOfMime, type FileFamily } from "@/lib/documents/view";

import "@/styles/contractors.css";
import "@/styles/inspections.css";
import "@/styles/doctrace.css";

export { Chip, EmptyState, Field, Skeletons };

const ICONS: Record<string, LucideIcon> = {
  Lightbulb: LightbulbIcon, ClipboardList: ClipboardListIcon, Ruler: PencilRulerIcon, FileSignature: FileSignatureIcon, Gavel: GavelIcon, ListOrdered: ListOrderedIcon, Wallet: WalletIcon, Receipt: ReceiptIcon,
  ClipboardCheck: ClipboardCheckIcon, Camera: CameraIcon, Mail: MailIcon, Stamp: StampIcon, TrendingUp: TrendingUpIcon, BadgeCheck: BadgeCheckIcon, Handshake: HandshakeIcon, Wrench: WrenchIcon, File: FileIcon,
};

/** Category = registry icon + localised label, tinted by its group. Never colour alone. */
export function CategoryChip({ category, copy }: { category: string; copy: Copy }) {
  const def = categoryDef(category);
  const Icon = ICONS[def?.icon ?? "File"] ?? FileIcon;
  return <span className="dt-cat" data-g={def?.group}><Icon aria-hidden="true" />{(copy.category as Record<string, string>)[category] ?? category}</span>;
}

const STATUS_VIEW: Record<DocStatus, { tone: "success" | "pending" | "neutral" | "active"; Icon: LucideIcon }> = {
  ACTIVE: { tone: "success", Icon: CircleDotIcon }, DRAFT: { tone: "pending", Icon: CircleDashedIcon }, SUPERSEDED: { tone: "neutral", Icon: FileTextIcon }, ARCHIVED: { tone: "neutral", Icon: ArchiveIcon },
};
export function StatusChip({ status, copy }: { status: DocStatus; copy: Copy }) {
  const { tone, Icon } = STATUS_VIEW[status];
  return <Chip tone={tone} icon={<Icon aria-hidden="true" />}>{copy.status[status]}</Chip>;
}
export function ConfidentialityChip({ value, copy }: { value: "STANDARD" | "SENSITIVE"; copy: Copy }) {
  if (value !== "SENSITIVE") return null;
  return <Chip tone="critical" icon={<ShieldAlertIcon aria-hidden="true" />} title={copy.confidentiality.sensitiveHint}>{copy.confidentiality.SENSITIVE}</Chip>;
}
/** Real AI status from the server (Batch 09). Icon + text for every state; links to the AI tab when `docId` is given. */
export function AiStatusChip({ ai, docId }: { ai: DocItem["ai"]; copy?: Copy; docId?: string }) {
  const [locale] = useWorkspaceLocale();
  return <AiChip ai={ai} aiCopy={getAiCopy(locale)} locale={locale} {...(docId ? { docId } : {})} />;
}
export const VersionBadge = ({ n }: { n: number | null }) => <span className="dt-ver">v{n ?? 1}</span>;

const FAMILY_ICON: Record<FileFamily, LucideIcon> = { pdf: FileTextIcon, docx: FileTextIcon, xlsx: FileSpreadsheetIcon, csv: FileSpreadsheetIcon, txt: FileTextIcon, image: ImageIcon, other: FileIcon };
export function FileTypeIcon({ mime, name, large }: { mime: string | null; name?: string; large?: boolean }) {
  const f = familyOfMime(mime) === "other" && name ? (name.split(".").pop()?.toLowerCase() === "docx" ? "docx" : "other") : familyOfMime(mime);
  const Icon = FAMILY_ICON[f];
  return large ? <span className="dt-tile" data-f={f}><span className="dt-icon" data-f={f} style={{ width: "3.2rem", height: "3.2rem" }}><Icon aria-hidden="true" style={{ width: "1.6rem", height: "1.6rem" }} /></span></span> : <span className="dt-icon" data-f={f}><Icon aria-hidden="true" /></span>;
}

/** Highlight segments from the server are rendered as <mark> elements. No HTML string is ever injected. */
export function Highlighted({ segments, fallback }: { segments?: Segment[] | null; fallback: string }) {
  if (!segments?.length) return <>{fallback}</>;
  return <>{segments.map((s, i) => (s.match ? <mark key={i} className="dt-mark">{s.text}</mark> : <span key={i}>{s.text}</span>))}</>;
}

export const ErrorState = ({ error, copy, onRetry }: { error: unknown; copy: Copy; onRetry?: () => void }) => {
  const f = failureOf(error);
  if (f.status === 403) return <EmptyState title={copy.common.forbiddenTitle} body={copy.common.forbiddenBody} />;
  if (f.status === 404) return <EmptyState title={copy.common.notFound} />;
  if (f.status === 0 && typeof navigator !== "undefined" && !navigator.onLine) return <EmptyState title={copy.common.offline} action={onRetry ? <button type="button" className="ctr-btn" onClick={onRetry}>{copy.common.retry}</button> : undefined} />;
  return <EmptyState title={copy.common.errorTitle} body={copy.common.errorBody} action={onRetry ? <button type="button" className="ctr-btn" onClick={onRetry}>{copy.common.retry}</button> : undefined} />;
};

/** User-facing text for a failed request: file code, then known reason, then the status. Never echoes server internals. */
export function errorText(error: unknown, copy: Copy): string {
  const f = failureOf(error);
  const errs = copy.errors as Record<string, string>;
  if (f.fileError && errs[f.fileError]) return errs[f.fileError]!;
  if (f.reason && errs[f.reason]) return errs[f.reason]!;
  if (f.status === 401) return errs.session!;
  if (f.status === 403) return errs.forbidden!;
  if (f.status === 404) return errs.notFound!;
  if (f.status === 409) return errs.conflict!;
  if (f.status === 413) return errs.FILE_TOO_LARGE!;
  if (f.status === 429) return errs.rateLimited!;
  if (f.status === 400 || f.status === 422) return errs.validation!;
  if (f.status === 0) return errs.network!;
  return errs.generic!;
}

export function Shell({ open, onOpenChange, title, description, wide, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; wide?: boolean; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} ctr-dialog max-h-[90vh] overflow-y-auto`}>
        <DialogHeader><DialogTitle>{title}</DialogTitle>{description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}</DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export const reasonOk = (s: string): boolean => s.trim().length >= 12;

"use client";

import { useQuery } from "@tanstack/react-query";

import type { AuthLocale } from "@/lib/auth/types";
import { fetchDocumentAi } from "@/lib/documents/ai/api";
import { getAiCopy } from "@/lib/documents/ai/messages";
import { pollInterval } from "@/lib/documents/ai/view";
import { useDocKeys } from "@/lib/documents/session";
import { fill, familyOfMime } from "@/lib/documents/view";
import { getDocCopy } from "@/lib/documents/messages";
import { AiChip } from "./ai-ui";

const PROCESSED = new Set(["pdf", "docx", "txt", "csv"]);

/** Upload wizard note (before upload): what will happen to this file, derived from its type and confidentiality. The server decides for real. */
export function UploadAiNote({ mime, name, sensitive, locale }: { mime: string | null; name: string; sensitive: boolean; locale: AuthLocale }) {
  const a = getAiCopy(locale);
  const copy = getDocCopy(locale);
  const family = familyOfMime(mime) === "other" ? (name.toLowerCase().endsWith(".docx") ? "docx" : "other") : familyOfMime(mime);
  const text = sensitive ? a.upload.sensitive : PROCESSED.has(family) ? fill(a.upload.willProcess, { type: (copy.fileType as Record<string, string>)[family] ?? "" }) : a.upload.notType;
  return <span className="ins-muted" role="note">{text}</span>;
}

/** Live, non-blocking AI status for a freshly uploaded document. Polls only while a job is active and the tab is visible; failures are silent. */
export function UploadAiLine({ docId, locale }: { docId: string; locale: AuthLocale }) {
  const a = getAiCopy(locale);
  const { key } = useDocKeys();
  const q = useQuery({
    queryKey: key("ai-upload", docId), queryFn: ({ signal }) => fetchDocumentAi(docId, signal), retry: false,
    refetchInterval: (query) => pollInterval(query.state.data?.currentJob ?? (query.state.data && ["QUEUED", "PROCESSING"].includes(query.state.data.extractedTextStatus) ? { status: "QUEUED" } : null), query.state.dataUpdateCount, typeof document !== "undefined" && document.hidden),
  });
  if (!q.data) return null;
  const d = q.data;
  const ai = {
    extractedTextStatus: d.extractedTextStatus, allowed: d.reasonCode !== "EXCLUDED" && d.reasonCode !== "SENSITIVE", eligibleType: d.reasonCode !== "NOT_ELIGIBLE_TYPE",
    errorCode: d.aiIndex?.errorCode ?? null, warningCount: d.aiIndex?.warnings.length ?? 0, truncated: Boolean(d.aiIndex?.truncated), indexedAt: d.aiIndex?.indexedAt ?? null,
  };
  return <span className="ctr-row" style={{ gap: "0.4rem" }}><span className="ins-muted">{fill(a.upload.liveLine, { status: "" }).replace(/\s*$/, "")}</span><AiChip ai={ai} aiCopy={a} locale={locale} docId={docId} stage={d.currentJob?.stage} /></span>;
}

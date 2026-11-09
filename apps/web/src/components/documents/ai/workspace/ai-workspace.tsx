"use client";

import { useQuery } from "@tanstack/react-query";
import { HistoryIcon, PlusIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { fetchThread, fetchScopePreview } from "@/lib/documents/ai/rag-api";
import { getRagCopy } from "@/lib/documents/ai/rag-messages";
import type { Citation, Scope } from "@/lib/documents/ai/rag-types";
import { getDocCopy } from "@/lib/documents/messages";
import { useDocKeys } from "@/lib/documents/session";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { EmptyState } from "../../doc-ui";
import { ExtractionPanel } from "../extraction/extraction-panel";
import { SummaryPanel } from "../summary/summary-panel";
import { Conversation, type ConversationState } from "./conversation";
import { HistoryDrawer } from "./history-drawer";
import { ScopePanel } from "./scope-panel";
import { SourceViewer } from "./source-viewer";

import "@/styles/doctrace-ai.css";
import "@/styles/doctrace-ai-rag.css";

type Mode = "ask" | "summarize" | "extract";
const askHint = (r: string) => ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER", "INSPECTOR"].includes(r);

/** AI Document Workspace. Scope and coverage are shown before anything is asked; the server builds the real allow-list and re-checks every source. */
export function AiWorkspace() {
  const [locale] = useWorkspaceLocale();
  const copy = getRagCopy(locale);
  const docCopy = getDocCopy(locale);
  const { key, roleKey } = useDocKeys();
  const params = useSearchParams();
  const initial: Scope = params.get("doc") ? { mode: "DOCUMENT", documentIds: [params.get("doc")!] } : params.get("project") ? { mode: "PROJECT", projectId: params.get("project")! } : { mode: "ALL" };
  const [mode, setMode] = useState<Mode>("ask");
  const [scope, setScope] = useState<Scope>(initial);
  const [convo, setConvo] = useState<ConversationState>({ threadId: null, items: [] });
  const [selected, setSelected] = useState<Citation | null>(null);
  const [history, setHistory] = useState(false);
  const [tab, setTab] = useState<"chat" | "sources">("chat");
  const [aiDown, setAiDown] = useState(false);

  const single = mode !== "ask";
  const effective: Scope = single && scope.mode !== "DOCUMENT" ? { mode: "DOCUMENT" } : scope;
  const valid = effective.mode === "ALL" || (effective.mode === "PROJECT" && Boolean(effective.projectId)) || ((effective.mode === "DOCUMENT" || effective.mode === "DOCUMENTS") && Boolean(effective.documentIds?.length));
  const preview = useQuery({ queryKey: key("ai-scope", effective.mode, (effective.documentIds ?? []).join(","), effective.projectId ?? ""), enabled: valid && askHint(roleKey), retry: false, staleTime: 10_000, queryFn: ({ signal }) => fetchScopePreview(effective, signal) });
  const categories = useMemo(() => [...new Set(preview.data?.searchable.map((s) => s.category) ?? [])], [preview.data]);
  const singleDoc = effective.mode === "DOCUMENT" && effective.documentIds?.[0] && preview.data?.searchable.some((s) => s.id === effective.documentIds![0]) ? effective.documentIds[0] : null;
  const scopeProblem = !valid ? "none" : preview.data && preview.data.documentsSearched === 0 ? "empty" : null;

  const openThread = async (threadId: string) => {
    try { const t = await fetchThread(threadId); setConvo({ threadId, items: t.items }); setSelected(null); setMode("ask"); } catch { toast.error(copy.common.error); }
  };
  const cite = (c: Citation) => { setSelected(c); setTab("sources"); };
  const allCitations = convo.items.flatMap((i) => i.citations).filter((c, i, a) => a.findIndex((x) => x.chunkId === c.chunkId && x.n === c.n) === i);

  return (
    <StaffWorkspaceShell title={copy.workspace.title} description={copy.workspace.subtitle} wide context={<ContextBar crumbs={[{ label: docCopy.nav.title, href: "/documents" }, { label: copy.workspace.title }]} scope={docCopy.dashboard.scope} asOf={null} />}>
      <div className="ins dt ai-ws">
        {!askHint(roleKey) ? <EmptyState title={copy.workspace.forbidden} /> : (
          <>
            <div className="ctr-row ai-ws-bar" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <div role="tablist" aria-label={copy.workspace.title} className="ctr-tabs">
                {([["ask", copy.workspace.modeAsk], ["summarize", copy.workspace.modeSummarize], ["extract", copy.workspace.modeExtract]] as const).map(([m, label]) => (
                  <button key={m} type="button" role="tab" aria-selected={mode === m} className="ctr-tab" onClick={() => setMode(m)}>{label}</button>
                ))}
              </div>
              <span className="ctr-row" style={{ gap: "0.4rem" }}>
                <button type="button" className="ctr-btn" onClick={() => { setConvo({ threadId: null, items: [] }); setSelected(null); }}><PlusIcon aria-hidden="true" />{copy.workspace.newConversation}</button>
                <button type="button" className="ctr-btn" onClick={() => setHistory(true)}><HistoryIcon aria-hidden="true" />{copy.workspace.history}</button>
              </span>
            </div>
            {aiDown ? <p className="ai-note" role="status">{copy.workspace.unavailable}</p> : null}
            <div className="ai-mtabs" role="tablist" aria-label={copy.workspace.title}>
              <button type="button" role="tab" aria-selected={tab === "chat"} className="ctr-tab" onClick={() => setTab("chat")}>{copy.workspace.chat}</button>
              <button type="button" role="tab" aria-selected={tab === "sources"} className="ctr-tab" onClick={() => setTab("sources")}>{copy.workspace.sources}</button>
            </div>
            <div className="ai-grid" data-tab={tab}>
              <div className="ai-col ai-col-scope" data-show={tab === "sources"}>
                <ScopePanel locale={locale} scope={effective} onScope={setScope} singleOnly={single} preview={preview.data} previewPending={valid && preview.isPending} previewError={preview.isError} />
              </div>
              <div className="ai-col ai-col-main" data-show={tab === "chat"}>
                {mode === "ask" ? (
                  <Conversation locale={locale} scope={valid ? effective : null} scopeProblem={scopeProblem} categories={categories} state={convo} onState={setConvo} selected={selected} onCite={cite} aiDown={aiDown} onAiDown={setAiDown} />
                ) : !singleDoc ? <EmptyState title={copy.workspace.needOne} /> : mode === "summarize" ? <SummaryPanel key={singleDoc} docId={singleDoc} locale={locale} /> : <ExtractionPanel key={singleDoc} docId={singleDoc} locale={locale} />}
              </div>
              {mode === "ask" ? <div className="ai-col ai-col-viewer" data-show={tab === "sources"}><SourceViewer citation={selected} citations={allCitations} locale={locale} onSelect={setSelected} /></div> : null}
            </div>
            <HistoryDrawer open={history} onOpenChange={setHistory} locale={locale} activeThread={convo.threadId} onOpenThread={(t) => void openThread(t)}
              onDeleted={(t) => { if (t === "ALL" || t === convo.threadId) { setConvo({ threadId: null, items: [] }); setSelected(null); } }} />
          </>
        )}
      </div>
    </StaffWorkspaceShell>
  );
}

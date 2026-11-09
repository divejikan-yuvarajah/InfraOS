"use client";

import { useState } from "react";

import type { AuthLocale } from "@/lib/auth/types";
import type { Citation } from "@/lib/documents/ai/rag-types";
import type { DocDetail } from "@/lib/documents/types";

import { Conversation, type ConversationState } from "./conversation";
import { SourceViewer } from "./source-viewer";

import "@/styles/doctrace-ai-rag.css";

/** "Ask AI" tab on a document: the scope is fixed to this document, so there is no scope panel; the server still builds and checks the allow-list. */
export function DocAskTab({ doc, locale }: { doc: DocDetail; locale: AuthLocale }) {
  const [state, setState] = useState<ConversationState>({ threadId: null, items: [] });
  const [selected, setSelected] = useState<Citation | null>(null);
  const [down, setDown] = useState(false);
  const citations = state.items.flatMap((i) => i.citations);
  const ready = doc.ai.extractedTextStatus === "COMPLETED" && doc.ai.allowed && doc.ai.eligibleType;
  return (
    <div className="ai-split" style={{ gridTemplateColumns: selected ? undefined : "minmax(0, 1fr)" }}>
      <Conversation locale={locale} scope={{ mode: "DOCUMENT", documentIds: [doc.id] }} scopeProblem={ready ? null : "empty"} categories={[doc.category]} state={state} onState={setState}
        selected={selected} onCite={setSelected} aiDown={down} onAiDown={setDown} />
      {selected ? <SourceViewer citation={selected} citations={citations} locale={locale} onSelect={setSelected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

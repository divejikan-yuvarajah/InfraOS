"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Conversation, type ConversationState } from "@/components/documents/ai/workspace/conversation";
import type { AuthLocale } from "@/lib/auth/types";
import type { Citation } from "@/lib/documents/ai/rag-types";

import "@/styles/doctrace-ai-rag.css";

/** "Ask about a document" mode inside the unified Copilot panel. Reuses the DocTrace Q&A conversation (server-side scope, permissions and citations); a citation opens the real document. */
export function DocumentQaTab({ locale, onNavigate }: { locale: AuthLocale; onNavigate: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<ConversationState>({ threadId: null, items: [] });
  const [down, setDown] = useState(false);
  const open = (c: Citation) => {
    onNavigate();
    router.push(`/documents/${c.documentId}`);
  };
  return (
    <div className="ai-ws" style={{ padding: "0.5rem" }}>
      <Conversation
        locale={locale}
        scope={{ mode: "ALL" }}
        scopeProblem={null}
        categories={[]}
        state={state}
        onState={setState}
        selected={null}
        onCite={open}
        aiDown={down}
        onAiDown={setDown}
      />
    </div>
  );
}
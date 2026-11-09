"use client";

import { SendIcon, SquareIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AI_LANGUAGES, suggestedQuestionKeys, type AiLanguage } from "@infraos/shared-types";

import { ApiError } from "@/lib/api/errors";
import type { AuthLocale } from "@/lib/auth/types";
import { askQuestion } from "@/lib/documents/ai/rag-api";
import { getRagCopy } from "@/lib/documents/ai/rag-messages";
import type { Citation, Interaction, Scope } from "@/lib/documents/ai/rag-types";
import { fill } from "@/lib/documents/view";

import { AnswerCard } from "./answer-card";

export type ConversationState = { threadId: string | null; items: Interaction[] };
type Props = {
  locale: AuthLocale; scope: Scope | null; scopeProblem: "none" | "empty" | null; categories: string[]; state: ConversationState; onState: (s: ConversationState) => void;
  selected: Citation | null; onCite: (c: Citation) => void; aiDown: boolean; onAiDown: (down: boolean) => void;
};

/** Error code from the envelope -> UI state. Never shows server text. */
function describe(error: unknown): { code: string; retryAfter?: number } {
  if (error instanceof ApiError) {
    if (error.status === 429 && error.code === "AI_RATE_LIMITED") return { code: "AI_RATE_LIMITED", retryAfter: 30 };
    return { code: error.code ?? (error.status === 404 ? "FORBIDDEN_SCOPE" : error.status === 503 ? "AI_UNAVAILABLE" : "generic") };
  }
  return { code: "generic" };
}

export function Conversation({ locale, scope, scopeProblem, categories, state, onState, selected, onCite, aiDown, onAiDown }: Props) {
  const copy = getRagCopy(locale);
  const [text, setText] = useState("");
  const [lang, setLang] = useState<"auto" | AiLanguage>("auto");
  const [pending, setPending] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [budget, setBudget] = useState(false);
  const [wait, setWait] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { if (!pending) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [pending]);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
  useEffect(() => () => abort.current?.abort(), []); // leaving the page cancels the upstream request
  useEffect(() => { bottomRef.current?.scrollIntoView?.({ block: "end", behavior: "auto" }); }, [state.items.length, pending]);

  const send = useCallback(async (question: string, regenerate = false) => {
    if (!scope || pending) return;
    const ac = new AbortController();
    abort.current = ac;
    const t0 = Date.now();
    setStartedAt(t0);
    setNow(t0);
    setPending(true);
    try {
      const r = await askQuestion({ question, scope, ...(stateRef.current.threadId ? { threadId: stateRef.current.threadId } : {}), ...(lang !== "auto" ? { language: lang } : {}), ...(regenerate ? { regenerate: true } : {}) }, ac.signal);
      onState({ threadId: r.threadId, items: [...stateRef.current.items, r] });
      onAiDown(false);
      setText("");
    } catch (error) {
      if (ac.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return; // the user pressed Stop
      const d = describe(error);
      if (d.code === "AI_BUDGET_EXCEEDED") setBudget(true);
      if (d.code === "AI_UNAVAILABLE") onAiDown(true);
      if (d.retryAfter) setWait(d.retryAfter);
      toast.error((copy.answer.errors as Record<string, string>)[d.code] ?? copy.answer.errors.generic);
    } finally { setPending(false); abort.current = null; }
  }, [scope, pending, lang, onState, onAiDown, copy]);

  const disabledReason = !scope || scopeProblem === "none" ? copy.composer.disabledNoScope : aiDown ? copy.composer.disabledUnavailable : budget ? copy.composer.disabledBudget : wait > 0 ? fill(copy.composer.disabledRate, { s: wait }) : null;
  const valid = text.trim().length >= 3 && text.length <= 600;
  const submit = () => { if (valid && !disabledReason && !pending) void send(text.trim()); };
  const suggestions = suggestedQuestionKeys(categories);

  return (
    <section className="ai-convo" aria-label={copy.workspace.conversation}>
      <div className="ai-feed" role="log" aria-live="polite" aria-relevant="additions">
        {state.items.length === 0 && !pending ? (
          <div className="ai-empty">
            <strong>{copy.workspace.emptyTitle}</strong><p className="ins-muted">{copy.workspace.emptyBody}</p>
            <div className="ai-suggest" role="group" aria-label={copy.suggested.title}>
              <span className="ins-muted">{copy.suggested.title}</span>
              {suggestions.map((k) => <button key={k} type="button" className="ctr-chip-btn" disabled={Boolean(disabledReason)} onClick={() => { setText((copy.suggested as Record<string, string>)[k] ?? ""); inputRef.current?.focus(); }}>{(copy.suggested as Record<string, string>)[k]}</button>)}
            </div>
          </div>
        ) : null}
        {state.items.map((it) => (
          <AnswerCard key={it.id} item={it} locale={locale} selected={selected?.n ?? null} onCite={onCite} busy={pending}
            onFollowUp={() => { setText(""); inputRef.current?.focus(); }} onRegenerate={() => void send(it.question, true)} onRetry={() => void send(it.question, true)} />
        ))}
        {pending ? <div className="ai-pending" role="status"><span>{copy.composer.searching}</span><span className="dt-tabnum">{fill(copy.composer.elapsed, { s: Math.max(0, Math.floor((now - startedAt) / 1000)) })}</span></div> : null}
        <div ref={bottomRef} />
      </div>

      <form className="ai-composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="sr-only" htmlFor="ai-question">{copy.composer.label}</label>
        <textarea id="ai-question" ref={inputRef} rows={2} maxLength={600} value={text} placeholder={copy.composer.placeholder} disabled={Boolean(disabledReason) || pending} aria-describedby="ai-composer-hint"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
        <div className="ai-composer-row">
          <span id="ai-composer-hint" className="ins-muted">{disabledReason ?? copy.composer.hint}</span>
          <span className="ctr-row" style={{ gap: "0.5rem" }}>
            <span className="ins-muted dt-tabnum" aria-label={copy.composer.counter.replace("{n}", String(text.length))}>{fill(copy.composer.counter, { n: text.length })}</span>
            <label className="sr-only" htmlFor="ai-lang">{copy.composer.language}</label>
            <select id="ai-lang" className="ctr-input" style={{ width: "auto" }} value={lang} onChange={(e) => setLang(e.target.value as "auto" | AiLanguage)}>
              <option value="auto">{copy.composer.language}: {copy.composer.auto}</option>
              {AI_LANGUAGES.map((l) => <option key={l} value={l}>{{ en: "English", si: "සිංහල", ta: "தமிழ்" }[l]}</option>)}
            </select>
            {pending ? <button type="button" className="ctr-btn" onClick={() => abort.current?.abort()}><SquareIcon aria-hidden="true" />{copy.composer.stop}</button>
              : <button type="submit" className="ctr-btn is-primary" disabled={!valid || Boolean(disabledReason)}><SendIcon aria-hidden="true" />{copy.composer.send}</button>}
          </span>
        </div>
      </form>
    </section>
  );
}

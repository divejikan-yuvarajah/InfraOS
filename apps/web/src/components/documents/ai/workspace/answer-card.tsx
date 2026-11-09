"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertTriangleIcon, BadgeCheckIcon, CheckIcon, ClipboardCopyIcon, FileSearchIcon, RefreshCwIcon, ShieldAlertIcon, ShieldCheckIcon, ShieldHalfIcon, ThumbsDownIcon, ThumbsUpIcon, XCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AiEvidenceLevel } from "@infraos/shared-types";

import { Chip } from "@/components/inspections/inspection-ui";
import type { AuthLocale } from "@/lib/auth/types";
import { sendFeedback } from "@/lib/documents/ai/rag-api";
import { getRagCopy } from "@/lib/documents/ai/rag-messages";
import type { Citation, Interaction } from "@/lib/documents/ai/rag-types";
import { answerAsText, pageLabel, splitAnswer, statusTone } from "@/lib/documents/ai/citations";
import { fill, fmtDateTime } from "@/lib/documents/view";

import { Shell } from "../../doc-ui";

type Props = { item: Interaction; locale: AuthLocale; selected: number | null; onCite: (c: Citation) => void; onFollowUp: () => void; onRegenerate: () => void; onRetry: () => void; busy: boolean };

const EVIDENCE_ICON: Record<AiEvidenceLevel, typeof ShieldCheckIcon> = { VERIFIED: ShieldCheckIcon, PARTIAL: ShieldHalfIcon, NONE: ShieldAlertIcon };

/** Citation marker: a button (never a link) that opens the source viewer. Shows the document and pages on hover/focus via its accessible name. */
function CiteChip({ n, citation, copy, active, onCite }: { n: number; citation: Citation | undefined; copy: ReturnType<typeof getRagCopy>; active: boolean; onCite: (c: Citation) => void }) {
  if (!citation) return <span className="ai-cite" aria-hidden="true">[{n}]</span>;
  const p = pageLabel(citation);
  const label = `${fill(copy.answer.cite, { n })}${citation.title ? `: ${citation.title}` : ""}${p.kind === "one" ? `, ${fill(copy.answer.page, { n: p.n })}` : p.kind === "range" ? `, ${fill(copy.answer.pages, { a: p.a, b: p.b })}` : ""}`;
  return <button type="button" className="ai-cite" aria-pressed={active} aria-label={label} title={label} onClick={() => onCite(citation)}>{n}</button>;
}

export function PageText({ c, copy }: { c: Pick<Citation, "pageStart" | "pageEnd">; copy: ReturnType<typeof getRagCopy> }) {
  const p = pageLabel(c);
  return <>{p.kind === "none" ? copy.answer.noPage : p.kind === "one" ? fill(copy.answer.page, { n: p.n }) : fill(copy.answer.pages, { a: p.a, b: p.b })}</>;
}

function Sources({ item, copy, selected, onCite }: { item: Interaction; copy: ReturnType<typeof getRagCopy>; selected: number | null; onCite: (c: Citation) => void }) {
  if (!item.citations.length) return null;
  return (
    <section aria-label={copy.answer.sources} style={{ display: "grid", gap: "0.5rem" }}>
      <h4 style={{ margin: 0 }}>{copy.answer.sources}</h4>
      <ol className="ai-sources">
        {item.citations.map((c) => {
          const gone = c.sourceStatus === "NO_LONGER_ACCESSIBLE";
          return (
            <li key={c.n} className="ai-source" data-active={selected === c.n} data-status={c.sourceStatus}>
              <header>
                <button type="button" className="ai-cite" aria-pressed={selected === c.n} aria-label={fill(copy.answer.openSource, { n: c.n })} onClick={() => onCite(c)}>{c.n}</button>
                {gone ? <strong>{copy.answer.sourceStatus.NO_LONGER_ACCESSIBLE}</strong> : <strong>{c.docNo ?? ""} {c.title ?? ""}</strong>}
                {!gone ? <span className="ctr-badge" data-tone="neutral">{fill(copy.answer.version, { n: c.versionNo })}</span> : null}
                {c.sourceStatus === "UPDATED" || c.sourceStatus === "ARCHIVED" ? <span className="ctr-badge" data-tone="pending"><AlertTriangleIcon aria-hidden="true" />{copy.answer.sourceStatus[c.sourceStatus]}</span> : null}
                {c.wasNeighbor ? <span className="ins-muted">{copy.answer.neighbor}</span> : null}
              </header>
              {!gone ? <span className="ins-muted"><PageText c={c} copy={copy} />{c.section ? ` · ${copy.answer.section}: ${c.section}` : ""}</span> : null}
              {!gone && c.quote && c.quoteVerified ? <blockquote className="ai-quote"><BadgeCheckIcon aria-hidden="true" /><span>{c.quote}</span></blockquote> : null}
              {!gone && !c.quoteVerified && item.status !== "PASSAGES_ONLY" ? <span className="ins-muted">{copy.answer.quoteUnverified}</span> : null}
              {!gone && item.status === "PASSAGES_ONLY" && c.excerpt ? <blockquote className="ai-quote"><span>{c.excerpt}</span></blockquote> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EvidencePanel({ item, copy }: { item: Interaction; copy: ReturnType<typeof getRagCopy> }) {
  const [open, setOpen] = useState(item.evidence?.level === "PARTIAL");
  const e = item.evidence;
  if (!e) return null;
  const Icon = EVIDENCE_ICON[e.level];
  const r = item.retrieval;
  const cov = item.coverage;
  return (
    <section className="ai-evidence" data-level={e.level} aria-label={copy.answer.evidence.title}>
      <button type="button" className="ai-evidence-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon aria-hidden="true" /><strong>{copy.answer.evidence.title}: {copy.answer.evidence[e.level]}</strong><span className="ins-muted">{open ? copy.answer.collapse : copy.answer.expand}</span>
      </button>
      {open ? (
        <ul>
          <li>{fill(copy.answer.evidence.quotes, { v: e.quotesVerified, t: e.quotesTotal })}</li>
          {e.unverifiedFigures.length ? <li>{fill(copy.answer.evidence.figures, { list: e.unverifiedFigures.join(", ") })}</li> : null}
          {e.droppedClaims > 0 ? <li>{fill(copy.answer.evidence.removed, { n: e.droppedClaims })}</li> : null}
          {cov ? <li>{fill(copy.answer.evidence.coverage, { s: cov.documentsSearched, t: cov.documentsInScope })}</li> : null}
          {r && r.flaggedSuspicious > 0 ? <li>{fill(copy.answer.evidence.flagged, { n: r.flaggedSuspicious })}</li> : null}
          {r && r.redactions > 0 ? <li>{fill(copy.answer.evidence.redactions, { n: r.redactions })} {copy.answer.evidence.redactedNote}</li> : null}
          {item.answer?.missingInfo.length ? <li>{copy.answer.evidence.missing}: {item.answer.missingInfo.join("; ")}</li> : null}
        </ul>
      ) : null}
    </section>
  );
}

function FeedbackBar({ item, copy }: { item: Interaction; copy: ReturnType<typeof getRagCopy> }) {
  const [rating, setRating] = useState<string | null>(item.feedback?.rating ?? null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const send = useMutation({ mutationFn: (b: { rating: "HELPFUL" | "NOT_HELPFUL"; reason?: string }) => sendFeedback(item.id, b), onSuccess: (_d, v) => { setRating(v.rating); setReasonOpen(false); toast.success(copy.answer.feedbackThanks); }, onError: () => toast.error(copy.answer.errors.generic) });
  return (
    <div className="ctr-row" style={{ gap: "0.4rem", flexWrap: "wrap" }} role="group" aria-label={copy.answer.helpful}>
      <button type="button" className="ctr-btn is-ghost" aria-pressed={rating === "HELPFUL"} disabled={send.isPending} onClick={() => send.mutate({ rating: "HELPFUL" })}><ThumbsUpIcon aria-hidden="true" />{copy.answer.helpful}</button>
      <button type="button" className="ctr-btn is-ghost" aria-pressed={rating === "NOT_HELPFUL"} aria-expanded={reasonOpen} disabled={send.isPending} onClick={() => setReasonOpen(!reasonOpen)}><ThumbsDownIcon aria-hidden="true" />{copy.answer.notHelpful}</button>
      {reasonOpen ? (
        <div className="ai-reasons" role="group" aria-label={copy.answer.feedbackReason}>
          {(Object.keys(copy.answer.reasons) as (keyof typeof copy.answer.reasons)[]).map((k) => <button key={k} type="button" className="ctr-chip-btn" onClick={() => send.mutate({ rating: "NOT_HELPFUL", reason: k })}>{copy.answer.reasons[k]}</button>)}
        </div>
      ) : null}
    </div>
  );
}

export function AnswerCard({ item, locale, selected, onCite, onFollowUp, onRegenerate, onRetry, busy }: Props) {
  const copy = getRagCopy(locale);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const byN = new Map(item.citations.map((c) => [c.n, c]));
  const ok = item.status === "ANSWERED" || item.status === "PARTIAL";
  const tone = statusTone(item.status);
  const Icon = item.status === "FAILED" ? XCircleIcon : item.status === "PASSAGES_ONLY" ? FileSearchIcon : item.evidence ? EVIDENCE_ICON[item.evidence.level] : ShieldAlertIcon;
  const errCode = item.errorCode ? (copy.answer.errors as Record<string, string>)[item.errorCode] ?? copy.answer.errors.generic : null;
  const doCopy = async () => { try { await navigator.clipboard.writeText(answerAsText(item.answer?.text ?? "", item.citations)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { toast.error(copy.answer.errors.generic); } };

  return (
    <article className="ai-answer" data-status={item.status} aria-label={copy.answer.ai}>
      <div className="ai-q"><span className="ins-muted">{copy.answer.you}</span><p>{item.question}</p></div>
      <div className="ai-rail" data-level={item.evidence?.level ?? "NONE"} aria-hidden="true" />
      <div className="ai-body">
        <header className="ctr-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
          <Chip tone={tone} icon={<Icon aria-hidden="true" />}>{copy.answer.status[item.status]}</Chip>
          <span className="ctr-badge" data-tone="neutral">{copy.answer.aiLabel}</span>
          <span className="ins-muted dt-tabnum">{fmtDateTime(item.createdAt, locale)}</span>
        </header>

        {item.sourcesChanged ? <p className="ai-note" role="status"><AlertTriangleIcon aria-hidden="true" />{copy.answer.sourceUpdated}</p> : null}

        {ok && item.answer ? (
          <div className="ai-text" aria-live="polite">
            {item.answer.text.split("\n").map((line, i) => (
              <p key={i}>{splitAnswer(line).map((part, j) => part.type === "text" ? <span key={j}>{part.text}</span> : <span key={j} className="ai-cites">{part.ns.map((n) => <CiteChip key={n} n={n} citation={byN.get(n)} copy={copy} active={selected === n} onCite={onCite} />)}</span>)}</p>
            ))}
          </div>
        ) : null}

        {item.status === "INSUFFICIENT_EVIDENCE" ? (
          <div className="ai-note" role="status">
            <ShieldAlertIcon aria-hidden="true" />
            <div><strong>{copy.answer.insufficientTitle}</strong><p style={{ margin: "0.2rem 0" }}>{copy.answer.insufficientBody} {item.coverage ? fill(copy.answer.searchedDocs, { s: item.coverage.documentsSearched, t: item.coverage.documentsInScope }) : ""}</p>
              {item.answer?.missingInfo.length ? <p style={{ margin: "0.2rem 0" }}>{copy.answer.evidence.missing}: {item.answer.missingInfo.join("; ")}</p> : null}
              <p className="ins-muted" style={{ margin: 0 }}>{copy.answer.broaden}</p></div>
          </div>
        ) : null}

        {item.status === "INSUFFICIENT_EVIDENCE" && item.related?.length ? (
          <section aria-label={copy.answer.related}>
            <h4 style={{ margin: "0 0 0.3rem" }}>{copy.answer.related}</h4><p className="ins-muted" style={{ margin: "0 0 0.4rem" }}>{copy.answer.relatedHelp}</p>
            {item.related.map((r, i) => <blockquote key={i} className="ai-quote"><span><strong>{r.docNo ?? ""} {r.title}</strong> — {r.excerpt}</span></blockquote>)}
          </section>
        ) : null}

        {item.status === "PASSAGES_ONLY" ? (
          <div className="ai-note" role="status"><FileSearchIcon aria-hidden="true" /><div><strong>{copy.answer.passagesLabel}</strong><p style={{ margin: "0.2rem 0 0" }}>{copy.answer.passagesHelp}</p></div></div>
        ) : null}

        {item.status === "FAILED" || (item.status === "PASSAGES_ONLY" && errCode) ? <p className="ins-muted" role="status">{errCode}</p> : null}

        <Sources item={item} copy={copy} selected={selected} onCite={onCite} />
        {item.evidence && (item.status === "ANSWERED" || item.status === "PARTIAL") ? <EvidencePanel item={item} copy={copy} /> : null}

        <p className="ai-disclaimer">{copy.answer.disclaimer}</p>

        <div className="ctr-row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
          {ok ? <button type="button" className="ctr-btn is-ghost" onClick={() => void doCopy()}>{copied ? <CheckIcon aria-hidden="true" /> : <ClipboardCopyIcon aria-hidden="true" />}{copied ? copy.answer.copied : copy.answer.copy}</button> : null}
          {item.status === "FAILED" || item.status === "PASSAGES_ONLY" ? <button type="button" className="ctr-btn" disabled={busy} onClick={onRetry}><RefreshCwIcon aria-hidden="true" />{copy.answer.retry}</button> : null}
          {ok || item.status === "INSUFFICIENT_EVIDENCE" ? <button type="button" className="ctr-btn is-ghost" disabled={busy} onClick={() => setConfirm(true)}><RefreshCwIcon aria-hidden="true" />{copy.answer.regenerate}</button> : null}
          <button type="button" className="ctr-btn is-ghost" onClick={onFollowUp}>{copy.answer.followUp}</button>
          {ok ? <FeedbackBar item={item} copy={copy} /> : null}
        </div>

        <details className="ai-about"><summary>{copy.answer.about.title}</summary>
          <dl><dt>{copy.answer.about.model}</dt><dd>{item.model ?? copy.common.none}</dd><dt>{copy.answer.about.prompt}</dt><dd>{item.promptVersion ?? copy.common.none}</dd>
            <dt>{copy.answer.about.latency}</dt><dd className="dt-tabnum">{item.latencyMs !== null ? `${(item.latencyMs / 1000).toFixed(1)} s` : copy.common.none}</dd><dt>{copy.answer.about.tokens}</dt><dd className="dt-tabnum">{item.usage.inputTokens + item.usage.outputTokens}</dd></dl>
        </details>
      </div>
      <Shell open={confirm} onOpenChange={setConfirm} title={copy.answer.regenerateTitle} description={copy.answer.regenerateBody}>
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={() => setConfirm(false)}>{copy.common.cancel}</button>
          <button type="button" className="ctr-btn is-primary" onClick={() => { setConfirm(false); onRegenerate(); }}>{copy.answer.regenerate}</button>
        </div>
      </Shell>
    </article>
  );
}

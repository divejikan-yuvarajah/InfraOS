"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { AuthLocale } from "@/lib/auth/types";
import { deleteAllThreads, deleteThread, fetchThreads } from "@/lib/documents/ai/rag-api";
import { getRagCopy } from "@/lib/documents/ai/rag-messages";
import { useDocKeys } from "@/lib/documents/session";
import { fill, fmtDateTime } from "@/lib/documents/view";

import { EmptyState, Shell, Skeletons } from "../../doc-ui";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; locale: AuthLocale; onOpenThread: (threadId: string) => void; activeThread: string | null; onDeleted: (threadId: string | "ALL") => void };

/** The caller's own conversations only (the API keys every query by the signed-in user). Delete one or all; retention is stated. */
export function HistoryDrawer({ open, onOpenChange, locale, onOpenThread, activeThread, onDeleted }: Props) {
  const copy = getRagCopy(locale);
  const { key } = useDocKeys();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<string | "ALL" | null>(null);
  const list = useInfiniteQuery({
    queryKey: key("ai-threads"), enabled: open, retry: false, initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => fetchThreads({ cursor: pageParam, limit: 20 }, signal), getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const del = useMutation({
    mutationFn: (t: string | "ALL") => (t === "ALL" ? deleteAllThreads() : deleteThread(t)),
    onSuccess: (_r, t) => { toast.success(copy.history.deleted); setConfirm(null); onDeleted(t); void qc.invalidateQueries({ queryKey: ["documents"] }); },
    onError: () => toast.error(copy.common.error),
  });
  const items = (list.data?.pages.flatMap((p) => p.items) ?? []).filter((t) => !q || t.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <Shell open={open} onOpenChange={onOpenChange} title={copy.history.title} description={copy.history.retention}>
      <div style={{ display: "grid", gap: "0.6rem" }}>
        <label className="sr-only" htmlFor="ai-history-search">{copy.common.search}</label>
        <input id="ai-history-search" className="ctr-input" placeholder={copy.common.search} value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} />
        {list.isPending ? <Skeletons n={3} /> : list.isError ? <EmptyState title={copy.common.error} /> : items.length === 0 ? <EmptyState title={copy.history.empty} /> : (
          <ul className="ai-threads">
            {items.map((t) => (
              <li key={t.threadId} data-active={t.threadId === activeThread}>
                <button type="button" onClick={() => { onOpenThread(t.threadId); onOpenChange(false); }}>
                  <strong>{t.title}</strong><span className="ins-muted dt-tabnum">{fmtDateTime(t.lastAt, locale)} · {fill(copy.history.count, { n: t.count })}</span>
                </button>
                <button type="button" className="ctr-btn is-ghost" aria-label={`${copy.history.delete}: ${t.title}`} onClick={() => setConfirm(t.threadId)}><Trash2Icon aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
        {list.hasNextPage ? <button type="button" className="ctr-btn" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>{copy.history.more}</button> : null}
        {items.length ? <button type="button" className="ctr-btn is-ghost" onClick={() => setConfirm("ALL")}>{copy.history.deleteAll}</button> : null}
      </div>
      <Shell open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }} title={confirm === "ALL" ? copy.history.deleteAllConfirm : copy.history.deleteConfirm}>
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={() => setConfirm(null)}>{copy.common.cancel}</button>
          <button type="button" className="ctr-btn is-primary" disabled={del.isPending} onClick={() => confirm && del.mutate(confirm)}>{del.isPending ? copy.common.working : copy.history.delete}</button>
        </div>
      </Shell>
    </Shell>
  );
}

"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { fetchNotices, setNoticeRead } from "@/lib/projects/notice-api";
import { getNoticeCopy, noticeTitle } from "@/lib/projects/notice-messages";
import { classifyEditError } from "@/lib/projects/edit-outcome";
import { formatActivityWhen } from "@/lib/projects/activity-view";
import {
  noticeHref,
  noticePageState,
  noticePagesForScope,
  noticeQueryKey,
  noticeScope,
  rememberNoticePage,
  visibleNotices,
  type NoticePageState,
} from "@/lib/projects/notice-view";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

export function ProjectNotices() {
  const [locale, setLocale] = useState<AuthLocale>("en");
  const [state, setState] = useState<"all" | "read" | "unread">("all");
  const [pages, setPages] = useState<NoticePageState>(() => noticePageState(""));
  const copy = getNoticeCopy(locale);
  const queryClient = useQueryClient();
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const signedIn = useAuthPart(() => (getMemoryAccessToken() ? "yes" : "no")) === "yes";
  const scope = noticeScope(epoch, userId, roleKey);
  const scopedPages = noticePagesForScope(pages, scope);
  const query = useQuery({
    queryKey: noticeQueryKey(epoch, userId, roleKey, state, scopedPages.cursor ?? ""),
    enabled: signedIn,
    queryFn: () => fetchNotices(state, scopedPages.cursor),
  });
  const items = visibleNotices(scopedPages, scope, signedIn, query.data?.notices ?? []);
  const failure = query.error ? classifyEditError(query.error) : null;
  const notice = !signedIn ? null : failure === "denied" ? copy.forbidden : failure === "expired" || failure === "stale" ? copy.expired : failure ? copy.unavailable : null;

  async function mark(id: string, isRead: boolean) {
    await setNoticeRead(id, isRead);
    await queryClient.invalidateQueries({ queryKey: ["notifications", epoch, userId, roleKey] });
    await queryClient.invalidateQueries({ queryKey: ["notifications-count", epoch, userId, roleKey] });
  }

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.description} wide>
      <section className="project-notices" aria-label={copy.title}>
        <p className="auth-access-status" role="status">{copy.nativeReview}</p>
        <p aria-live="polite">{copy.unreadCount}: {signedIn && query.data ? query.data.unreadCount : 0}</p>
        <div className="project-dashboard-languages" role="group" aria-label={copy.language}>
          {(["en", "si", "ta"] as const).map((item) => (
            <button key={item} type="button" className="auth-access-button" aria-pressed={locale === item} onClick={() => setLocale(item)}>
              {item === "en" ? copy.english : item === "si" ? copy.sinhala : copy.tamil}
            </button>
          ))}
        </div>
        <div className="project-dashboard-languages" role="group" aria-label={copy.all}>
          {(["all", "unread", "read"] as const).map((item) => (
            <button key={item} type="button" className="auth-access-button" aria-pressed={state === item} onClick={() => { setState(item); setPages(noticePageState(scope)); }}>
              {copy[item]}
            </button>
          ))}
        </div>
        {query.isPending && signedIn ? <p role="status">{copy.loading}</p> : null}
        {notice ? (
          <div className="auth-access-banner error" role="alert">
            <p>{notice}</p>
            {failure !== "denied" && failure !== "expired" ? <button type="button" className="auth-access-button" onClick={() => void query.refetch()}>{copy.retry}</button> : null}
          </div>
        ) : null}
        {signedIn && !notice && items.length === 0 && !query.isPending ? <p role="status">{copy.empty}</p> : null}
        <ul className="project-notices-list">
          {items.map((item) => {
            const href = noticeHref(item);
            return (
              <li key={item.id} className={item.isRead ? "project-notice is-read" : "project-notice is-unread"}>
                <span className="mc-notice-dot" aria-hidden="true" />
                <div className="mc-notice-main">
                  <p className="mc-notice-title">
                    {item.isRead ? null : <span className="mc-sr">{copy.unread}: </span>}
                    {noticeTitle(copy, item.titleKey)}
                  </p>
                  {href && item.project ? <Link href={href}>{copy.openProject}: {item.project.projectCode} {item.project.title}</Link> : <p>{copy.restricted}</p>}
                  <time dateTime={item.createdAt}>{formatActivityWhen(item.createdAt, locale)}</time>
                </div>
                <button type="button" className="auth-access-button mc-notice-action" onClick={() => void mark(item.id, !item.isRead)}>
                  {item.isRead ? copy.markUnread : copy.markRead}
                </button>
              </li>
            );
          })}
        </ul>
        {query.data?.nextCursor ? (
          <button type="button" className="auth-access-button" onClick={() => setPages(rememberNoticePage(scopedPages, scope, items, query.data?.nextCursor ?? null))}>
            {copy.loadMore}
          </button>
        ) : null}
      </section>
    </StaffWorkspaceShell>
  );
}

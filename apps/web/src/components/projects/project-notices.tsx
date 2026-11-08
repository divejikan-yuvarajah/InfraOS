"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ROLE_LABELS } from "@/components/auth/workspace-nav";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { classifyEditError } from "@/lib/projects/edit-outcome";
import {
  fetchNotices,
  fetchUnreadCount,
  setNoticeRead,
} from "@/lib/projects/notice-api";
import { getNoticeCopy, noticeTitle } from "@/lib/projects/notice-messages";
import { noticeHref, type NoticeItem } from "@/lib/projects/notice-view";

type ReadTab = "all" | "unread" | "read";
type TypeFilter = "ALL" | "CONFLICTS" | "APPROVALS" | "MILESTONES";

function formatWhen(iso: string, locale: AuthLocale): string {
  try {
    return new Intl.DateTimeFormat(
      locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK",
      {
        dateStyle: "medium",
        timeStyle: "short",
      },
    ).format(new Date(iso));
  } catch {
    return iso;
  }
}

function classifyNoticeCategory(item: NoticeItem): {
  category: TypeFilter;
  stripeClass: string;
  iconBgClass: string;
  materialIcon: string;
  badgeClass: string;
  badgeGlyph: "◆" | "●" | "✓" | "○";
  badgeLabel: string;
} {
  if (item.type === "CONFLICT") {
    return {
      category: "CONFLICTS",
      stripeClass: "bg-error",
      iconBgClass: "bg-error-container text-on-error-container border border-error/20",
      materialIcon: "warning",
      badgeClass: "bg-error text-white",
      badgeGlyph: "◆",
      badgeLabel: "Spatial Conflict",
    };
  }
  if (item.type === "MILESTONE") {
    return {
      category: "MILESTONES",
      stripeClass: "bg-emerald-700",
      iconBgClass: "bg-emerald-50 text-emerald-800 border border-emerald-200",
      materialIcon: "verified",
      badgeClass: "bg-emerald-50 text-emerald-800 border border-emerald-300",
      badgeGlyph: "✓",
      badgeLabel: "Milestone",
    };
  }
  if (item.type === "APPROVAL" || item.type === "COORDINATION") {
    return {
      category: "APPROVALS",
      stripeClass: "bg-secondary-container",
      iconBgClass: "bg-secondary-fixed text-on-secondary-fixed border border-secondary/20",
      materialIcon: item.type === "COORDINATION" ? "handshake" : "approval_delegation",
      badgeClass: "bg-secondary-fixed text-on-secondary-fixed",
      badgeGlyph: "●",
      badgeLabel: item.type === "COORDINATION" ? "Coordination" : "Approval / Review",
    };
  }
  return {
    category: "MILESTONES",
    stripeClass: "bg-surface-tint",
    iconBgClass: "bg-surface-container-high text-on-surface-variant border border-outline-variant/40",
    materialIcon: "dns",
    badgeClass: "bg-surface-container-high text-on-surface-variant",
    badgeGlyph: "○",
    badgeLabel: "System Telemetry",
  };
}

export function ProjectNotices() {
  const [locale] = useWorkspaceLocale();
  const copy = getNoticeCopy(locale);
  const qc = useQueryClient();
  const [readTab, setReadTab] = useState<ReadTab>("all");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [markingAll, setMarkingAll] = useState(false);

  const epoch = useSyncExternalStore(subscribeAuth, getAuthEpoch, () => 0);
  const hasToken = useSyncExternalStore(
    subscribeAuth,
    () => Boolean(getMemoryAccessToken()),
    () => false,
  );
  const role = useSyncExternalStore(
    subscribeAuth,
    () => getMemorySession()?.user?.roleKey ?? "",
    () => "",
  );
  const agency = useSyncExternalStore(
    subscribeAuth,
    () => getMemorySession()?.user?.agencyId ?? "",
    () => "",
  );

  const query = useQuery({
    queryKey: ["notifications", "list", epoch, readTab, cursor ?? ""],
    queryFn: () => fetchNotices(readTab, cursor),
    enabled: hasToken,
    retry: false,
  });

  const unreadCountQuery = useQuery({
    queryKey: ["notifications", "unread-count", epoch],
    queryFn: fetchUnreadCount,
    enabled: hasToken,
    staleTime: 15_000,
  });

  const toggle = useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) =>
      setNoticeRead(id, isRead),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const allItems = useMemo(
    () => query.data?.notices ?? [],
    [query.data?.notices],
  );
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (typeFilter !== "ALL") {
        const meta = classifyNoticeCategory(item);
        if (meta.category !== typeFilter) return false;
      }
      return true;
    });
  }, [allItems, typeFilter]);

  const unreadTotal =
    unreadCountQuery.data ?? query.data?.unreadCount ?? allItems.filter((i) => !i.isRead).length;

  const handleMarkAllRead = async () => {
    const unreadItems = allItems.filter((i) => !i.isRead);
    if (unreadItems.length === 0) return;
    setMarkingAll(true);
    try {
      await Promise.all(unreadItems.map((i) => setNoticeRead(i.id, true)));
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <StaffWorkspaceShell
      title={copy.title}
      subtitle={copy.description}
      section="Personal Workspace"
      breadcrumbs={[{ label: copy.title }]}
      scopeLabel={agency || undefined}
      hidePageHeader
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-gutter-desktop py-6 space-y-6 pb-12">
        {/* PAGE HEADER & EDITORIAL TITLE */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-outline-variant/30">
          <div>
            <div className="flex items-center gap-2 text-label-sm font-label-sm uppercase text-secondary mb-2 flex-wrap">
              <span className="material-symbols-outlined text-[14px]">route</span>
              <span>Personal Workspace</span>
              <span>/</span>
              <span>Notifications</span>
              <span>/</span>
              <span className="px-1.5 py-0.5 bg-secondary-fixed text-on-secondary-fixed rounded-xs font-mono">
                [ REAL-TIME DISPATCH ]
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              {copy.title}
            </h1>
            <p className="text-body-md text-on-surface-variant mt-1 max-w-2xl">
              {copy.description}
            </p>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              disabled={markingAll || unreadTotal === 0}
              onClick={() => void handleMarkAllRead()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-xs font-semibold hover:bg-surface-container-low transition-colors shadow-2xs disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">
                done_all
              </span>
              <span>{markingAll ? "Marking…" : "Mark all as read"}</span>
            </button>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-xs font-semibold hover:bg-surface-container-low transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                tune
              </span>
              <span>Notification Settings</span>
            </Link>
          </div>
        </div>

        {/* FILTER & SEGMENTED CONTROL BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-3 rounded border border-outline-variant/30 shadow-2xs">
          {/* Left Segmented Tabs: All vs Unread vs Read */}
          <div
            className="flex items-center gap-1 bg-surface-container-low p-1 rounded border border-outline-variant/30 self-start"
            role="tablist"
            aria-label={copy.title}
          >
            <button
              type="button"
              role="tab"
              aria-selected={readTab === "all"}
              onClick={() => {
                setReadTab("all");
                setCursor(undefined);
              }}
              className={
                readTab === "all"
                  ? "px-3 py-1.5 rounded-xs text-xs font-bold bg-surface-container-lowest text-on-surface shadow-2xs flex items-center gap-2"
                  : "px-3 py-1.5 rounded-xs text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-2"
              }
            >
              <span>{copy.all}</span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono bg-surface-container text-on-surface rounded-xs tabular-nums">
                {allItems.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={readTab === "unread"}
              onClick={() => {
                setReadTab("unread");
                setCursor(undefined);
              }}
              className={
                readTab === "unread"
                  ? "px-3 py-1.5 rounded-xs text-xs font-bold bg-surface-container-lowest text-on-surface shadow-2xs flex items-center gap-2"
                  : "px-3 py-1.5 rounded-xs text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-2"
              }
            >
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" />
              <span>{copy.unread}</span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-secondary-container text-white rounded-xs tabular-nums">
                {unreadTotal}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={readTab === "read"}
              onClick={() => {
                setReadTab("read");
                setCursor(undefined);
              }}
              className={
                readTab === "read"
                  ? "px-3 py-1.5 rounded-xs text-xs font-bold bg-surface-container-lowest text-on-surface shadow-2xs"
                  : "px-3 py-1.5 rounded-xs text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors"
              }
            >
              {copy.read}
            </button>
          </div>

          {/* Right Quick Tag Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-low border border-outline-variant/30 text-[11px] text-on-surface-variant font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>Live Status: Listening</span>
            </div>
            <div className="h-4 w-[1px] bg-outline-variant/30 hidden sm:block" />

            {(
              [
                { id: "ALL", label: "All Types", tone: "neutral" },
                { id: "CONFLICTS", label: "◆ Conflicts", tone: "critical" },
                { id: "APPROVALS", label: "● Approvals & Coord", tone: "active" },
                { id: "MILESTONES", label: "✓ Milestones", tone: "success" },
              ] as const
            ).map((f) => {
              const active = typeFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTypeFilter(f.id)}
                  className={
                    active
                      ? "px-2.5 py-1 rounded text-xs font-bold bg-primary-container text-white transition-colors"
                      : f.tone === "critical"
                        ? "px-2.5 py-1 rounded text-xs font-semibold bg-error-container/50 text-on-error-container border border-error/20 hover:bg-error-container transition-colors"
                        : "px-2.5 py-1 rounded text-xs font-medium bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-colors"
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* MAIN 12-COLUMN NOTIFICATIONS LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 8 COLUMNS: Active Notification Stream */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-label-sm font-label-sm uppercase text-on-surface-variant tracking-wider">
                Operational Dispatch Stream ({filteredItems.length})
              </span>
              <span className="text-xs text-on-surface-variant font-mono">
                Sorted by Priority &amp; Timestamp
              </span>
            </div>

            {!hasToken || query.isPending ? (
              <div
                className="bg-surface-container-lowest p-8 rounded border border-outline-variant/30 shadow-2xs flex items-center gap-3"
                role="status"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-secondary-container animate-ping" />
                <span className="font-title-md text-title-md text-on-surface">
                  {copy.loading}
                </span>
              </div>
            ) : query.isError ? (
              <div
                className="bg-error-container/25 border border-error/30 rounded p-6 flex items-center justify-between gap-4"
                role="alert"
              >
                <span className="font-semibold text-on-error-container">
                  {classifyEditError(query.error) === "denied"
                    ? copy.forbidden
                    : copy.unavailable}
                </span>
                <button
                  type="button"
                  onClick={() => void query.refetch()}
                  className="px-3.5 py-1.5 rounded bg-secondary text-white text-xs font-semibold"
                >
                  {copy.retry}
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="bg-surface-container-lowest rounded border border-outline-variant/30 shadow-2xs p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-[24px]">
                    task_alt
                  </span>
                </div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  You&apos;re all caught up
                </h2>
                <p className="text-body-md text-on-surface-variant mt-1 max-w-md mx-auto">
                  {copy.empty}
                </p>
                {readTab !== "all" || typeFilter !== "ALL" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setReadTab("all");
                      setTypeFilter("ALL");
                      setCursor(undefined);
                    }}
                    className="mt-4 px-3.5 py-1.5 rounded bg-surface-container-low border border-outline-variant/50 text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors"
                  >
                    Show All Notifications
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((n) => {
                  const meta = classifyNoticeCategory(n);
                  const unread = !n.isRead;
                  const targetHref = noticeHref(n);

                  return (
                    <article
                      key={n.id}
                      className={`bg-surface-container-lowest rounded border shadow-2xs relative overflow-hidden transition-all ${
                        unread
                          ? "border-outline-variant/50 hover:border-secondary/40"
                          : "border-outline-variant/25 opacity-90 hover:opacity-100"
                      }`}
                    >
                      {/* Unread Left Status Bar */}
                      <div
                        className={`absolute top-0 bottom-0 left-0 w-1 ${
                          unread ? meta.stripeClass : "bg-outline-variant/50"
                        }`}
                      />

                      <div className="p-5 pl-6 flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          <div
                            className={`w-10 h-10 rounded flex items-center justify-center shrink-0 mt-0.5 ${meta.iconBgClass}`}
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              {meta.materialIcon}
                            </span>
                          </div>

                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${meta.badgeClass}`}
                              >
                                <span>{meta.badgeGlyph}</span> {meta.badgeLabel}
                              </span>
                              {n.project && (
                                <span className="text-xs font-mono font-semibold text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded tabular-nums">
                                  {n.project.projectCode}
                                </span>
                              )}
                              {unread && (
                                <span
                                  className="w-2 h-2 rounded-full bg-secondary-container"
                                  title={copy.unread}
                                />
                              )}
                              <span className="text-xs text-outline font-mono tabular-nums ml-auto sm:ml-0">
                                {formatWhen(n.createdAt, locale)}
                              </span>
                            </div>

                            <h3 className="font-title-md text-title-md text-on-surface">
                              {noticeTitle(copy, n.titleKey)}
                            </h3>

                            {n.project && (
                              <p className="text-body-md text-on-surface-variant leading-relaxed">
                                Corridor Project:{" "}
                                <strong className="text-on-surface font-semibold">
                                  {n.project.title}
                                </strong>{" "}
                                ({n.project.projectCode})
                              </p>
                            )}

                            {/* Action Bar inside Notification */}
                            <div className="pt-2 flex flex-wrap items-center gap-2.5">
                              {targetHref && (
                                <Link
                                  href={targetHref}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary-container text-white text-xs font-semibold hover:bg-primary transition-colors shadow-2xs"
                                >
                                  <span className="material-symbols-outlined text-[15px]">
                                    open_in_new
                                  </span>
                                  <span>
                                    {n.project
                                      ? `${copy.openProject}: ${n.project.projectCode}`
                                      : "Open Record"}
                                  </span>
                                </Link>
                              )}
                              <button
                                type="button"
                                disabled={toggle.isPending}
                                onClick={() =>
                                  toggle.mutate({ id: n.id, isRead: !n.isRead })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-low border border-outline-variant/50 text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-[15px]">
                                  {n.isRead ? "mark_email_unread" : "check"}
                                </span>
                                <span>
                                  {n.isRead ? copy.markUnread : copy.markRead}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Cursor Pagination Footer */}
            {query.data?.nextCursor && (
              <div className="bg-surface-container-lowest p-4 rounded border border-outline-variant/30 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setCursor(query.data?.nextCursor ?? undefined)}
                  className="px-4 py-2 rounded bg-surface-container-low border border-outline-variant/50 text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors"
                >
                  {copy.loadMore}
                </button>
              </div>
            )}
          </div>

          {/* RIGHT 4 COLUMNS: Context & Empty-State Preview Strip */}
          <div className="lg:col-span-4 space-y-6">
            {/* 1. Active Corridor Visual Card */}
            <div className="bg-surface-container-lowest rounded border border-outline-variant/30 shadow-2xs overflow-hidden">
              <div className="relative h-44 w-full bg-primary-container overflow-hidden cad-grid-dark">
                <svg
                  className="absolute inset-0 w-full h-full opacity-80"
                  viewBox="0 0 400 180"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M-10 145 C 90 130, 170 65, 275 60 C 330 55, 370 30, 415 15"
                    stroke="#3b4856"
                    strokeWidth="6"
                  />
                  <path
                    d="M-10 145 C 90 130, 170 65, 275 60 C 330 55, 370 30, 415 15"
                    stroke="#fd5a00"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                  />
                  <circle cx="155" cy="92" r="6" fill="#fd5a00" stroke="#fff" strokeWidth="2" />
                  <circle cx="275" cy="60" r="6" fill="#10b981" stroke="#fff" strokeWidth="2" />
                </svg>
                <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-transparent" />
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs border border-white/15 text-[10px] font-mono text-primary-fixed">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" />
                  <span>INFRASTRUCTURE THREAD: ONLINE</span>
                </div>
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-primary-fixed-dim">
                    National Corridor Telemetry
                  </div>
                  <div className="font-title-md text-sm font-semibold leading-snug mt-0.5">
                    Colombo Metropolitan &amp; Arterial Network
                  </div>
                </div>
              </div>
              <div className="p-4 bg-surface-container-lowest space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant font-medium">
                    Corridor Dispatch Sync
                  </span>
                  <span className="font-mono font-semibold text-emerald-700 flex items-center gap-1">
                    <span>●</span> Active (0.4s latency)
                  </span>
                </div>
                <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[11px] text-on-surface-variant">
                  <span>Assigned Scope: {agency || "National"}</span>
                  <Link
                    href="/inframap"
                    className="font-semibold text-secondary hover:underline"
                  >
                    Open InfraMap →
                  </Link>
                </div>
              </div>
            </div>

            {/* 2. Zero-State / Inbox Zero Card ("You're all caught up" / "No new notifications.") */}
            <div className="bg-surface-container-lowest rounded border border-outline-variant/30 shadow-2xs p-6 text-center relative overflow-hidden cad-grid-pattern">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono uppercase tracking-wider text-outline font-bold">
                  Queue Status Indicator
                </span>
                <span className="px-1.5 py-0.5 rounded-xs border border-dashed border-outline-variant text-on-surface-variant text-[10px] font-bold uppercase">
                  {unreadTotal === 0 ? "[ INBOX ZERO ]" : `[ ${unreadTotal} UNREAD ]`}
                </span>
              </div>

              {/* Custom Vector Illustration: The Infrastructure Thread at Rest */}
              <div className="my-5 mx-auto w-28 h-20 flex items-center justify-center relative">
                <svg
                  className="w-full h-full"
                  viewBox="0 0 120 80"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M10 60 C 35 60, 45 20, 70 20 C 95 20, 95 45, 110 45"
                    stroke="#c4c6cc"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                  <path
                    d="M10 60 C 35 60, 45 20, 70 20"
                    stroke="#14202d"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="10" cy="60" r="4" fill="#14202d" />
                  <circle
                    cx="70"
                    cy="20"
                    r="6"
                    fill="#fd5a00"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <circle
                    cx="110"
                    cy="45"
                    r="5"
                    fill="#059669"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>

              <h3 className="font-headline-md text-headline-md text-on-surface">
                You&apos;re all caught up
              </h3>
              <p className="text-body-md text-on-surface-variant font-semibold mt-1">
                No new notifications.
              </p>
              <p className="text-xs text-outline mt-2 max-w-xs mx-auto leading-relaxed">
                All spatial overlaps, statutory clearances, and corridor dispatches in your queue have been synchronized.
              </p>

              <div className="mt-5 pt-4 border-t border-outline-variant/25 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void query.refetch()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-low border border-outline-variant/50 text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    refresh
                  </span>
                  <span>Refresh Stream</span>
                </button>
              </div>
            </div>

            {/* 3. Governance & Audit Trail Notice */}
            <div className="bg-surface-container-low p-4 rounded border border-outline-variant/30 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-on-surface">
                <span className="material-symbols-outlined text-[16px] text-secondary">
                  policy
                </span>
                <span>Institutional Audit Trail</span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Notifications are cryptographically logged to your{" "}
                <strong className="text-on-surface">
                  {ROLE_LABELS[role] ?? (role || "Staff")}
                </strong>{" "}
                role ledger. Acknowledging a conflict or clearance records a timestamped receipt in RoadSync History.
              </p>
            </div>
          </div>
        </div>
      </div>
    </StaffWorkspaceShell>
  );
}

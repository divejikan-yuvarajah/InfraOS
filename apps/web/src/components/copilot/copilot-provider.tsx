"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { useAiStatus } from "@/components/ai-admin/ai-status-provider";
import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import { canUseCopilot, mapAiFailure } from "@/lib/ai-admin/view";
import { isPrivatePath } from "@/lib/auth/route-access";
import {
  getAuthEpoch,
  getAuthSnapshot,
  getMemorySession,
  getServerAuthSnapshot,
  subscribeAuth,
} from "@/lib/auth/state";
import {
  cancelCopilotTurn,
  createCopilotTurn,
  deleteCopilotThread,
  fetchCopilotThread,
  fetchCopilotThreads,
  fetchCopilotTurn,
  fetchCopilotSuggestions,
} from "@/lib/copilot/api";
import { deriveCopilotContext } from "@/lib/copilot/context";
import { getCopilotCopy } from "@/lib/copilot/messages";
import { isTerminalCopilotStatus, pollDelayMs } from "@/lib/copilot/poll";
import type { CopilotPageContext, CopilotTurnDto } from "@/lib/copilot/types";
import { loadCopilotUiPrefs, saveCopilotUiPrefs } from "@/lib/copilot/view";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { CopilotLauncher } from "./copilot-launcher";
import { CopilotPanel, type CopilotTab } from "./copilot-panel";

export type CopilotContextValue = {
  open: boolean;
  openCopilot: () => void;
  closeCopilot: () => void;
  toggleCopilot: () => void;
  openQuickFacts: () => void;
  pageContext: CopilotPageContext;
};

const DEFAULT_CONTEXT: CopilotContextValue = {
  open: false,
  openCopilot: () => undefined,
  closeCopilot: () => undefined,
  toggleCopilot: () => undefined,
  openQuickFacts: () => undefined,
  pageContext: { type: "OTHER", route: "/" },
};

const CopilotContext = createContext<CopilotContextValue>(DEFAULT_CONTEXT);

function useAuthString(select: () => string): string {
  return useSyncExternalStore(subscribeAuth, select, () => "");
}

function useAuthEpoch(): number {
  return useSyncExternalStore(subscribeAuth, getAuthEpoch, () => 0);
}

function CopilotWorkspace({
  epoch,
  userId,
  pageContext,
  children,
}: {
  epoch: number;
  userId: string;
  pageContext: CopilotPageContext;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const [locale] = useWorkspaceLocale();
  const copy = getCopilotCopy(locale);
  const aiCopy = getAiAdminCopy(locale);
  const { getFeatureStatus, loading: statusLoading } = useAiStatus();
  const featureStatus = statusLoading ? "available" : getFeatureStatus("copilot");

  const [prefs] = useState(() => loadCopilotUiPrefs());
  const [open, setOpen] = useState(prefs.open);
  const [wide, setWide] = useState(prefs.wide);
  const [tab, setTab] = useState<CopilotTab>("chat");
  const [includeContext, setIncludeContext] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>(prefs.lastThreadId);
  const [activeTurnId, setActiveTurnId] = useState<string | undefined>(undefined);
  const [liveTurn, setLiveTurn] = useState<CopilotTurnDto | null>(null);
  const [startedAtMs, setStartedAtMs] = useState<number>(() => Date.now());
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState("");
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [rateLimitUntilMs, setRateLimitUntilMs] = useState<number | null>(null);
  const [budgetResetAt, setBudgetResetAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [isVisible, setIsVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState !== "hidden",
  );

  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const isOpenRef = useRef(open);
  const completedTurnIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    isOpenRef.current = open;
    saveCopilotUiPrefs({ open, wide, lastThreadId: activeThreadId });
  }, [open, wide, activeThreadId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => {
      const visible = document.visibilityState !== "hidden";
      setIsVisible(visible);
      if (visible && activeTurnId) {
        void qc.invalidateQueries({ queryKey: ["copilot", "turn", epoch, userId, activeTurnId] });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [activeTurnId, epoch, qc, userId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "/" || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setOpen((prev) => {
        const next = !prev;
        if (next) setUnreadCount(0);
        return next;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const threadsQuery = useQuery({
    queryKey: ["copilot", "threads", epoch, userId],
    queryFn: ({ signal }) => fetchCopilotThreads(signal),
    enabled: open,
    staleTime: 20_000,
  });

  const threadQuery = useQuery({
    queryKey: ["copilot", "thread", epoch, userId, activeThreadId],
    queryFn: ({ signal }) => fetchCopilotThread(activeThreadId!, signal),
    enabled: Boolean(activeThreadId),
    retry: false,
  });

  const suggestionsQuery = useQuery({
    queryKey: [
      "copilot",
      "suggestions",
      epoch,
      userId,
      includeContext ? pageContext.type : "GENERAL",
      includeContext ? pageContext.recordId ?? "" : "",
    ],
    queryFn: ({ signal }) =>
      fetchCopilotSuggestions(
        includeContext ? pageContext.type : undefined,
        includeContext ? pageContext.recordId : undefined,
        signal,
      ),
    enabled: open && tab === "chat" && !activeThreadId,
    staleTime: 60_000,
  });

  useQuery({
    queryKey: ["copilot", "turn", epoch, userId, activeTurnId],
    queryFn: async ({ signal }) => {
      const turn = await fetchCopilotTurn(activeTurnId!, signal);
      setLiveTurn(turn);

      if (isTerminalCopilotStatus(turn.status)) {
        setActiveTurnId(undefined);
        setCancelling(false);
        setPollTimedOut(false);

        if (!completedTurnIdsRef.current.has(turn.id)) {
          completedTurnIdsRef.current.add(turn.id);
          const statusLabel = copy.status[turn.status] ?? turn.status;
          setLiveAnnouncement(`${copy.header.title}: ${statusLabel}`);
          if (!isOpenRef.current) {
            setUnreadCount((c) => c + 1);
          }
          void qc.invalidateQueries({
            queryKey: ["copilot", "thread", epoch, userId, turn.threadId],
          });
          void qc.invalidateQueries({
            queryKey: ["copilot", "threads", epoch, userId],
          });
        }
      }
      return turn;
    },
    enabled: Boolean(activeTurnId),
    refetchInterval: (query) => {
      if (!activeTurnId) return false;
      const status = query.state.data?.status;
      if (isTerminalCopilotStatus(status)) return false;
      const next = pollDelayMs(Date.now() - startedAtMs, isVisible);
      if (next === false) {
        window.setTimeout(() => setPollTimedOut(true), 0);
      }
      return next;
    },
    retry: false,
  });

  const turns = useMemo<CopilotTurnDto[]>(() => {
    const serverTurns = threadQuery.data?.turns ?? [];
    if (!liveTurn) return serverTurns;
    if (activeThreadId && liveTurn.threadId !== activeThreadId) return serverTurns;
    const idx = serverTurns.findIndex((t) => t.id === liveTurn.id);
    if (idx === -1) return [...serverTurns, liveTurn];
    const merged = [...serverTurns];
    const existing = merged[idx]!;
    merged[idx] = isTerminalCopilotStatus(existing.status) ? existing : liveTurn;
    return merged;
  }, [activeThreadId, liveTurn, threadQuery.data?.turns]);

  const busy = submitting || Boolean(activeTurnId);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) setUnreadCount(0);
  }, []);

  const handleSend = useCallback(
    async (promptOverride?: string) => {
      const text = (promptOverride ?? draft).trim();
      if (!text || busy) return;
      if (featureStatus === "disabled" || featureStatus === "unavailable") return;

      setSubmitting(true);
      setErrorMessage(null);
      setPollTimedOut(false);
      setBudgetResetAt(null);
      if (!promptOverride) setDraft("");

      try {
        const res = await createCopilotTurn({
          message: text,
          ...(activeThreadId ? { threadId: activeThreadId } : {}),
          ...(includeContext
            ? {
                pageContext: {
                  type: pageContext.type,
                  ...(pageContext.recordId ? { recordId: pageContext.recordId } : {}),
                  route: pageContext.route,
                },
              }
            : {}),
        });

        setActiveThreadId(res.threadId);
        setStartedAtMs(Date.now());
        setLiveTurn({
          id: res.turnId,
          threadId: res.threadId,
          message: text,
          status: res.status,
          steps: [],
          sources: [],
          toolsUsed: [],
          createdAt: new Date().toISOString(),
        });
        setActiveTurnId(res.turnId);
        void qc.invalidateQueries({ queryKey: ["copilot", "threads", epoch, userId] });
      } catch (err) {
        if (!promptOverride) setDraft(text);
        const mapped = mapAiFailure(err, aiCopy, locale);
        if (mapped.code === "AI_RATE_LIMITED") {
          setRateLimitUntilMs(Date.now() + (mapped.retryAfterSeconds ?? 60) * 1000);
        } else if (mapped.code === "AI_BUDGET_EXCEEDED") {
          setBudgetResetAt(mapped.resetsAt ?? "00:00");
        } else {
          setErrorMessage(mapped.message);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [
      activeThreadId,
      aiCopy,
      busy,
      draft,
      epoch,
      featureStatus,
      includeContext,
      locale,
      pageContext,
      qc,
      userId,
    ],
  );

  const handleCancel = useCallback(async () => {
    if (!activeTurnId) return;
    setCancelling(true);
    try {
      await cancelCopilotTurn(activeTurnId);
      void qc.invalidateQueries({ queryKey: ["copilot", "turn", epoch, userId, activeTurnId] });
    } catch {
      setCancelling(false);
    }
  }, [activeTurnId, epoch, qc, userId]);

  const handleNewChat = useCallback(() => {
    setActiveThreadId(undefined);
    setActiveTurnId(undefined);
    setLiveTurn(null);
    setErrorMessage(null);
    setTab("chat");
    setFocusTrigger((n) => n + 1);
  }, []);

  const handleSelectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
    setActiveTurnId(undefined);
    setLiveTurn(null);
    setErrorMessage(null);
    setTab("chat");
  }, []);

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      try {
        await deleteCopilotThread(threadId);
        if (activeThreadId === threadId) {
          setActiveThreadId(undefined);
          setActiveTurnId(undefined);
          setLiveTurn(null);
        }
        void qc.invalidateQueries({ queryKey: ["copilot", "threads", epoch, userId] });
      } catch {
        // leave thread state unchanged on failure
      }
    },
    [activeThreadId, epoch, qc, userId],
  );

  const handleNavigate = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 40rem)").matches) {
      setOpen(false);
    }
  }, []);

  const contextValue = useMemo<CopilotContextValue>(
    () => ({
      open,
      openCopilot: () => handleOpenChange(true),
      closeCopilot: () => handleOpenChange(false),
      toggleCopilot: () => handleOpenChange(!open),
      openQuickFacts: () => {
        setTab("quickFacts");
        handleOpenChange(true);
      },
      pageContext,
    }),
    [handleOpenChange, open, pageContext],
  );

  return (
    <CopilotContext.Provider value={contextValue}>
      {children}
      <CopilotLauncher
        buttonRef={launcherRef}
        open={open}
        featureStatus={featureStatus}
        unreadCount={unreadCount}
        copy={copy}
        onClick={() => handleOpenChange(!open)}
      />
      <CopilotPanel
        open={open}
        wide={wide}
        tab={tab}
        includeContext={includeContext}
        pageContext={pageContext}
        turns={turns}
        suggestions={suggestionsQuery.data?.suggestions ?? []}
        suggestionsLoading={suggestionsQuery.isPending}
        threads={threadsQuery.data?.threads ?? []}
        activeThreadId={activeThreadId}
        threadsLoading={threadsQuery.isPending}
        featureStatus={featureStatus}
        busy={busy}
        cancelling={cancelling}
        pollTimedOut={pollTimedOut}
        startedAtMs={startedAtMs}
        draft={draft}
        maxLength={800}
        focusTrigger={focusTrigger}
        rateLimitUntilMs={rateLimitUntilMs}
        budgetResetAt={budgetResetAt}
        errorMessage={errorMessage}
        liveAnnouncement={liveAnnouncement}
        epoch={epoch}
        userId={userId}
        copy={copy}
        locale={locale}
        launcherRef={launcherRef}
        onOpenChange={handleOpenChange}
        onToggleWide={() => setWide((v) => !v)}
        onTabChange={setTab}
        onToggleContext={() => setIncludeContext((v) => !v)}
        onOpenThreadMenu={() => void qc.invalidateQueries({ queryKey: ["copilot", "threads", epoch, userId] })}
        onNewChat={handleNewChat}
        onSelectThread={handleSelectThread}
        onDeleteThread={(id) => void handleDeleteThread(id)}
        onDraftChange={setDraft}
        onSend={(p) => void handleSend(p)}
        onCancel={() => void handleCancel()}
        onRefreshTurn={() => {
          setPollTimedOut(false);
          setStartedAtMs(Date.now());
          if (activeTurnId) {
            void qc.invalidateQueries({ queryKey: ["copilot", "turn", epoch, userId, activeTurnId] });
          }
        }}
        onRetry={(turn) => void handleSend(turn.message)}
        onFollowUp={(prefix) => {
          setDraft(prefix);
          setTab("chat");
          setFocusTrigger((n) => n + 1);
        }}
        onNavigate={handleNavigate}
      />
    </CopilotContext.Provider>
  );
}

export function CopilotProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const snapshot = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getServerAuthSnapshot);
  const epoch = useAuthEpoch();
  const userId = useAuthString(() => getMemorySession()?.user.id ?? "");
  const roleKey = useAuthString(() => getMemorySession()?.user.roleKey ?? "");

  const eligible = Boolean(
    snapshot.authenticated &&
      snapshot.identityConfirmed &&
      isPrivatePath(pathname) &&
      canUseCopilot(roleKey) &&
      userId,
  );

  const pageContext = useMemo(() => deriveCopilotContext(pathname), [pathname]);

  if (!eligible) {
    return (
      <CopilotContext.Provider value={DEFAULT_CONTEXT}>
        {children}
      </CopilotContext.Provider>
    );
  }

  return (
    <CopilotWorkspace
      key={`${epoch}:${userId}`}
      epoch={epoch}
      userId={userId}
      pageContext={pageContext}
    >
      {children}
    </CopilotWorkspace>
  );
}

export function useCopilot(): CopilotContextValue {
  return useContext(CopilotContext);
}

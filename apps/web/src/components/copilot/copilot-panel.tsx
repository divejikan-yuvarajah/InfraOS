"use client";

import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { RefObject } from "react";

import type { LiteFeatureStatus } from "@/lib/ai-admin/types";
import type { AuthLocale } from "@/lib/auth/types";
import type { CopilotMessages } from "@/lib/copilot/messages";
import type {
  CopilotPageContext,
  CopilotSuggestionDto,
  CopilotThreadSummaryDto,
  CopilotTurnDto,
} from "@/lib/copilot/types";

import { CopilotComposer } from "./copilot-composer";
import { CopilotHeader } from "./copilot-header";
import { LimitBanner } from "./limit-banner";
import { MessageList } from "./message-list";
import { QuickFactsTab } from "./quick-facts-tab";
import { UnavailableState } from "./unavailable-state";

export type CopilotTab = "chat" | "quickFacts";

export function CopilotPanel({
  open,
  wide,
  tab,
  includeContext,
  pageContext,
  turns,
  suggestions,
  suggestionsLoading,
  threads,
  activeThreadId,
  threadsLoading,
  featureStatus,
  busy,
  cancelling,
  pollTimedOut,
  startedAtMs,
  draft,
  maxLength,
  focusTrigger,
  rateLimitUntilMs,
  budgetResetAt,
  errorMessage,
  liveAnnouncement,
  epoch,
  userId,
  copy,
  locale,
  launcherRef,
  onOpenChange,
  onToggleWide,
  onTabChange,
  onToggleContext,
  onOpenThreadMenu,
  onNewChat,
  onSelectThread,
  onDeleteThread,
  onDraftChange,
  onSend,
  onCancel,
  onRefreshTurn,
  onRetry,
  onFollowUp,
  onNavigate,
}: {
  open: boolean;
  wide: boolean;
  tab: CopilotTab;
  includeContext: boolean;
  pageContext: CopilotPageContext;
  turns: readonly CopilotTurnDto[];
  suggestions: readonly CopilotSuggestionDto[];
  suggestionsLoading: boolean;
  threads: readonly CopilotThreadSummaryDto[];
  activeThreadId?: string;
  threadsLoading: boolean;
  featureStatus: LiteFeatureStatus;
  busy: boolean;
  cancelling: boolean;
  pollTimedOut: boolean;
  startedAtMs: number;
  draft: string;
  maxLength: number;
  focusTrigger: number;
  rateLimitUntilMs: number | null;
  budgetResetAt: string | null;
  errorMessage: string | null;
  liveAnnouncement: string;
  epoch: number;
  userId: string;
  copy: CopilotMessages;
  locale: AuthLocale;
  launcherRef: RefObject<HTMLButtonElement | null>;
  onOpenChange: (next: boolean) => void;
  onToggleWide: () => void;
  onTabChange: (tab: CopilotTab) => void;
  onToggleContext: () => void;
  onOpenThreadMenu: () => void;
  onNewChat: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onDraftChange: (text: string) => void;
  onSend: (prompt?: string) => void;
  onCancel: () => void;
  onRefreshTurn: () => void;
  onRetry: (turn: CopilotTurnDto) => void;
  onFollowUp: (prefix: string) => void;
  onNavigate: () => void;
}) {
  const aiUnavailable = featureStatus === "disabled" || featureStatus === "unavailable";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="cop-backdrop" />
        <DialogPrimitive.Content
          className="cop-panel"
          data-wide={wide ? "true" : "false"}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            launcherRef.current?.focus();
          }}
        >
          <CopilotHeader
            wide={wide}
            includeContext={includeContext}
            pageContext={pageContext}
            threads={threads}
            activeThreadId={activeThreadId}
            threadsLoading={threadsLoading}
            copy={copy}
            locale={locale}
            onToggleWide={onToggleWide}
            onToggleContext={onToggleContext}
            onOpenThreadMenu={onOpenThreadMenu}
            onNewChat={onNewChat}
            onSelectThread={onSelectThread}
            onDeleteThread={onDeleteThread}
          />

          <div className="cop-tabs" role="tablist" aria-label={copy.header.title}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "chat"}
              className="cop-tab"
              onClick={() => onTabChange("chat")}
            >
              {copy.tabs.chat}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "quickFacts"}
              className="cop-tab"
              onClick={() => onTabChange("quickFacts")}
            >
              {copy.tabs.quickFacts}
            </button>
          </div>

          <div className="cop-scroll">
            <div className="ctr-sr" aria-live="polite">
              {liveAnnouncement}
            </div>

            {tab === "chat" ? (
              <>
                {errorMessage && !rateLimitUntilMs && !budgetResetAt ? (
                  <LimitBanner
                    kind="unavailable"
                    locale={locale}
                    messageOverride={errorMessage}
                    action={
                      <button
                        type="button"
                        className="ctr-btn"
                        style={{ minHeight: "2rem", padding: "0.2rem 0.6rem" }}
                        onClick={() => onTabChange("quickFacts")}
                      >
                        {copy.composer.switchToQuickFacts}
                      </button>
                    }
                  />
                ) : null}

                {turns.length === 0 && aiUnavailable ? (
                  <UnavailableState
                    mode={featureStatus}
                    copy={copy}
                    onOpenQuickFacts={() => onTabChange("quickFacts")}
                  />
                ) : null}

                <MessageList
                  turns={turns}
                  suggestions={suggestions}
                  suggestionsLoading={suggestionsLoading}
                  disabled={aiUnavailable || busy || Boolean(rateLimitUntilMs) || Boolean(budgetResetAt)}
                  busy={busy}
                  startedAtMs={startedAtMs}
                  cancelling={cancelling}
                  pollTimedOut={pollTimedOut}
                  copy={copy}
                  locale={locale}
                  onSelectPrompt={(prompt) => onSend(prompt)}
                  onCancel={onCancel}
                  onRefreshTurn={onRefreshTurn}
                  onRetry={onRetry}
                  onFollowUp={onFollowUp}
                  onNavigate={onNavigate}
                />
              </>
            ) : (
              <QuickFactsTab
                epoch={epoch}
                userId={userId}
                pageContext={pageContext}
                includeContext={includeContext}
                aiDownOrDisabled={aiUnavailable}
                copy={copy}
                locale={locale}
                onNavigate={onNavigate}
              />
            )}
          </div>

          {tab === "chat" ? (
            <CopilotComposer
              value={draft}
              maxLength={maxLength}
              featureStatus={featureStatus}
              busy={busy}
              rateLimitUntilMs={rateLimitUntilMs}
              budgetResetAt={budgetResetAt}
              copy={copy}
              locale={locale}
              onChange={onDraftChange}
              onSend={() => onSend()}
              onCancel={onCancel}
              onOpenQuickFacts={() => onTabChange("quickFacts")}
              focusTrigger={focusTrigger}
            />
          ) : (
            <div className="cop-foot">
              <div className="cop-foot-meta">
                <span>{copy.quickFacts.subtitle}</span>
                <Link href="/ai/about" className="underline hover:text-foreground" onClick={onNavigate}>
                  {copy.header.aboutLink}
                </Link>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

"use client";

import { useEffect, useRef } from "react";

import type { AuthLocale } from "@/lib/auth/types";
import type { CopilotMessages } from "@/lib/copilot/messages";
import { isTerminalCopilotStatus } from "@/lib/copilot/poll";
import type { CopilotSuggestionDto, CopilotTurnDto } from "@/lib/copilot/types";

import { AssistantMessage } from "./assistant-message";
import { LiveSteps } from "./live-steps";
import { SuggestedQuestions } from "./suggested-questions";
import { UserMessage } from "./user-message";

export function MessageList({
  turns,
  suggestions,
  suggestionsLoading,
  disabled,
  busy,
  startedAtMs,
  cancelling,
  pollTimedOut,
  copy,
  locale,
  onSelectPrompt,
  onCancel,
  onRefreshTurn,
  onRetry,
  onFollowUp,
  onNavigate,
}: {
  turns: readonly CopilotTurnDto[];
  suggestions: readonly CopilotSuggestionDto[];
  suggestionsLoading: boolean;
  disabled: boolean;
  busy: boolean;
  startedAtMs: number;
  cancelling: boolean;
  pollTimedOut: boolean;
  copy: CopilotMessages;
  locale: AuthLocale;
  onSelectPrompt: (prompt: string) => void;
  onCancel: () => void;
  onRefreshTurn: () => void;
  onRetry: (turn: CopilotTurnDto) => void;
  onFollowUp: (prompt: string) => void;
  onNavigate?: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTurn = turns[turns.length - 1];
  const lastStatus = lastTurn?.status;
  const lastStepsCount = lastTurn?.steps.length ?? 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [turns.length, lastStatus, lastStepsCount]);

  if (turns.length === 0) {
    return (
      <div style={{ display: "grid", gap: "0.9rem" }}>
        <div className="ai-empty">
          <strong>{copy.empty.title}</strong>
          <p className="ctr-small">{copy.empty.body}</p>
        </div>
        <SuggestedQuestions
          suggestions={suggestions}
          loading={suggestionsLoading}
          disabled={disabled}
          onSelect={onSelectPrompt}
          copy={copy}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      {turns.map((turn) => {
        const terminal = isTerminalCopilotStatus(turn.status);
        return (
          <div key={turn.id} style={{ display: "grid", gap: "0.55rem" }}>
            <UserMessage text={turn.message} />
            {terminal ? (
              <AssistantMessage
                turn={turn}
                copy={copy}
                locale={locale}
                busy={busy}
                onRetry={onRetry}
                onFollowUp={onFollowUp}
                onNavigate={onNavigate}
              />
            ) : (
              <LiveSteps
                steps={turn.steps}
                startedAtMs={startedAtMs}
                cancelling={cancelling}
                timedOut={pollTimedOut}
                onCancel={onCancel}
                onRefresh={onRefreshTurn}
                copy={copy}
              />
            )}
          </div>
        );
      })}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}

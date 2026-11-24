"use client";

import { Maximize2Icon, Minimize2Icon, SparklesIcon, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import type { LiteFeatureStatus } from "@/lib/ai-admin/types";
import type { AuthLocale } from "@/lib/auth/types";
import type { CopilotMessages } from "@/lib/copilot/messages";
import type { CopilotPageContext, CopilotThreadSummaryDto } from "@/lib/copilot/types";

import { ContextChip } from "./context-chip";
import { ThreadMenu } from "./thread-menu";

export function CopilotHeader({
  featureStatus,
  warming,
  wide,
  includeContext,
  pageContext,
  threads,
  activeThreadId,
  threadsLoading,
  copy,
  locale,
  onToggleWide,
  onToggleContext,
  onOpenThreadMenu,
  onNewChat,
  onSelectThread,
  onDeleteThread,
}: {
  featureStatus: LiteFeatureStatus;
  warming: boolean;
  wide: boolean;
  includeContext: boolean;
  pageContext: CopilotPageContext;
  threads: readonly CopilotThreadSummaryDto[];
  activeThreadId?: string;
  threadsLoading: boolean;
  copy: CopilotMessages;
  locale: AuthLocale;
  onToggleWide: () => void;
  onToggleContext: () => void;
  onOpenThreadMenu: () => void;
  onNewChat: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
}) {
  return (
    <header className="cop-head">
      <div className="cop-head-top">
        <div style={{ minWidth: 0 }}>
          <DialogPrimitive.Title className="cop-head-title">
            <SparklesIcon aria-hidden="true" style={{ width: "1rem", height: "1rem", color: "var(--infra-orange)" }} />
            <span>{copy.header.title}</span>
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="ctr-small">
            {copy.header.subtitle}
          </DialogPrimitive.Description>
        </div>

        <div className="cop-head-actions">
          <span className="ctr-small" role="status" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
            <span aria-hidden="true" style={{ width: "0.55rem", height: "0.55rem", borderRadius: "999px", background: warming ? "var(--status-warning, #d97706)" : featureStatus === "available" ? "var(--status-success, #16a34a)" : featureStatus === "degraded" ? "var(--status-warning, #d97706)" : "var(--status-danger, #dc2626)" }} />
            {warming ? copy.header.status.warming : featureStatus === "available" ? copy.header.status.live : featureStatus === "degraded" ? copy.header.status.limited : copy.header.status.offline}
          </span>
          <ThreadMenu
            threads={threads}
            activeThreadId={activeThreadId}
            loading={threadsLoading}
            copy={copy}
            locale={locale}
            onOpenMenu={onOpenThreadMenu}
            onNewChat={onNewChat}
            onSelectThread={onSelectThread}
            onDeleteThread={onDeleteThread}
          />
          <button
            type="button"
            className="cop-icon-btn"
            aria-label={wide ? copy.header.narrowWidth : copy.header.expandWidth}
            title={wide ? copy.header.narrowWidth : copy.header.expandWidth}
            aria-pressed={wide}
            onClick={onToggleWide}
          >
            {wide ? (
              <Minimize2Icon aria-hidden="true" style={{ width: "0.95rem", height: "0.95rem" }} />
            ) : (
              <Maximize2Icon aria-hidden="true" style={{ width: "0.95rem", height: "0.95rem" }} />
            )}
          </button>
          <DialogPrimitive.Close asChild>
            <button
              type="button"
              className="cop-icon-btn"
              aria-label={copy.header.close}
              title={copy.header.close}
            >
              <XIcon aria-hidden="true" style={{ width: "1rem", height: "1rem" }} />
            </button>
          </DialogPrimitive.Close>
        </div>
      </div>

      <ContextChip
        pageContext={pageContext}
        included={includeContext}
        onToggle={onToggleContext}
        copy={copy}
      />
    </header>
  );
}

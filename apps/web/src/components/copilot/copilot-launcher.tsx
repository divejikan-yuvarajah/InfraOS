"use client";

import { MessageSquareTextIcon } from "lucide-react";
import type { RefObject } from "react";

import type { LiteFeatureStatus } from "@/lib/ai-admin/types";
import type { CopilotMessages } from "@/lib/copilot/messages";

export function CopilotLauncher({
  buttonRef,
  open,
  featureStatus,
  unreadCount,
  copy,
  onClick,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  featureStatus: LiteFeatureStatus;
  unreadCount: number;
  copy: CopilotMessages;
  onClick: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="cop-launcher"
      data-state={featureStatus}
      aria-label={copy.launcher.ariaLabel}
      title={copy.launcher.tooltip}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={onClick}
    >
      <span className="cop-launcher-dot" aria-hidden="true" />
      <MessageSquareTextIcon aria-hidden="true" style={{ width: "1rem", height: "1rem" }} />
      <span>{copy.launcher.label}</span>
      {unreadCount > 0 ? (
        <span
          className="cop-launcher-unread"
          aria-label={copy.launcher.unreadBadge.replace("{n}", String(unreadCount))}
        >
          {unreadCount}
        </span>
      ) : null}
    </button>
  );
}

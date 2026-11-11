"use client";

import { SendIcon, SquareIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import type { LiteFeatureStatus } from "@/lib/ai-admin/types";
import { fillTemplate, formatCountdownSeconds, formatDateTime } from "@/lib/ai-admin/view";
import type { AuthLocale } from "@/lib/auth/types";
import type { CopilotMessages } from "@/lib/copilot/messages";

export function CopilotComposer({
  value,
  maxLength,
  featureStatus,
  busy,
  rateLimitUntilMs,
  budgetResetAt,
  copy,
  locale,
  onChange,
  onSend,
  onCancel,
  onOpenQuickFacts,
  focusTrigger,
}: {
  value: string;
  maxLength: number;
  featureStatus: LiteFeatureStatus;
  busy: boolean;
  rateLimitUntilMs: number | null;
  budgetResetAt: string | null;
  copy: CopilotMessages;
  locale: AuthLocale;
  onChange: (next: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onOpenQuickFacts: () => void;
  focusTrigger: number;
}) {
  const aiCopy = getAiAdminCopy(locale);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (focusTrigger > 0) {
      textareaRef.current?.focus();
    }
  }, [focusTrigger]);

  useEffect(() => {
    if (!rateLimitUntilMs) return;
    const t0 = window.setTimeout(() => setNowMs(Date.now()), 0);
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(id);
    };
  }, [rateLimitUntilMs]);

  const rateLimitedSeconds =
    rateLimitUntilMs && rateLimitUntilMs > nowMs
      ? Math.ceil((rateLimitUntilMs - nowMs) / 1000)
      : 0;

  const disabledReason =
    featureStatus === "disabled"
      ? copy.composer.disabledByAdmin
      : featureStatus === "unavailable"
        ? copy.composer.disabledUnavailable
        : rateLimitedSeconds > 0
          ? fillTemplate(copy.composer.disabledRateLimited, {
              countdown: formatCountdownSeconds(rateLimitedSeconds, aiCopy),
            })
          : budgetResetAt
            ? fillTemplate(copy.composer.disabledBudgetExceeded, {
                reset: formatDateTime(budgetResetAt, locale),
              })
            : null;

  const canSend = !busy && !disabledReason && value.trim().length > 0 && value.length <= maxLength;

  return (
    <div className="cop-foot">
      {disabledReason ? (
        <div className="ai-limit-banner" data-tone="critical" role="status">
          <span>{disabledReason}</span>
          <button
            type="button"
            className="ctr-btn"
            style={{ minHeight: "2rem", padding: "0.2rem 0.6rem" }}
            onClick={onOpenQuickFacts}
          >
            {copy.composer.switchToQuickFacts}
          </button>
        </div>
      ) : null}

      <div className="ai-composer">
        <label htmlFor="copilot-composer-input" className="ctr-sr">
          {copy.composer.label}
        </label>
        <textarea
          ref={textareaRef}
          id="copilot-composer-input"
          rows={2}
          maxLength={maxLength}
          disabled={Boolean(disabledReason) && !busy}
          value={value}
          placeholder={copy.composer.placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
        />
        <div className="ai-composer-row">
          <span className="ctr-small ctr-num">
            {copy.composer.chars
              .replace("{n}", String(value.length))
              .replace("{max}", String(maxLength))}
          </span>
          <div className="ctr-row" style={{ gap: "0.4rem" }}>
            {busy ? (
              <button type="button" className="ctr-btn" onClick={onCancel}>
                <SquareIcon aria-hidden="true" />
                <span>{copy.composer.stop}</span>
              </button>
            ) : (
              <button
                type="button"
                className="ctr-btn is-primary"
                disabled={!canSend}
                onClick={onSend}
              >
                <SendIcon aria-hidden="true" />
                <span>{copy.composer.send}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="cop-foot-meta">
        <span>{copy.composer.enterHint}</span>
        <Link href="/ai/about" className="underline hover:text-foreground">
          {copy.header.aboutLink}
        </Link>
      </div>
    </div>
  );
}

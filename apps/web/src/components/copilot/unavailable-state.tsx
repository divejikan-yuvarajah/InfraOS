"use client";

import { BanIcon, CloudOffIcon, LockIcon } from "lucide-react";

import type { CopilotMessages } from "@/lib/copilot/messages";

import "@/styles/contractors.css";

export function UnavailableState({
  mode,
  copy,
  onOpenQuickFacts,
}: {
  mode: "disabled" | "unavailable" | "forbidden";
  copy: CopilotMessages;
  onOpenQuickFacts?: () => void;
}) {
  const Icon = mode === "disabled" ? BanIcon : mode === "forbidden" ? LockIcon : CloudOffIcon;
  const title =
    mode === "disabled"
      ? copy.unavailable.disabledTitle
      : mode === "forbidden"
        ? copy.unavailable.forbiddenTitle
        : copy.unavailable.unavailableTitle;
  const body =
    mode === "disabled"
      ? copy.unavailable.disabledBody
      : mode === "forbidden"
        ? copy.unavailable.forbiddenBody
        : copy.unavailable.unavailableBody;

  return (
    <section className="ai-empty" role="status" aria-live="polite">
      <div className="ctr-row" style={{ gap: "0.5rem" }}>
        <Icon aria-hidden="true" style={{ width: "1.1rem", height: "1.1rem", flex: "none" }} />
        <strong>{title}</strong>
      </div>
      <p className="ctr-small">{body}</p>
      {onOpenQuickFacts && mode !== "forbidden" ? (
        <div>
          <button type="button" className="ctr-btn is-primary" onClick={onOpenQuickFacts}>
            {copy.composer.switchToQuickFacts}
          </button>
        </div>
      ) : null}
    </section>
  );
}

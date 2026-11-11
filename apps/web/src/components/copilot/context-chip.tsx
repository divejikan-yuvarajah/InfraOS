"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";

import type { CopilotMessages } from "@/lib/copilot/messages";
import type { CopilotPageContext } from "@/lib/copilot/types";
import { formatContextSummary } from "@/lib/copilot/view";

export function ContextChip({
  pageContext,
  included,
  onToggle,
  copy,
}: {
  pageContext: CopilotPageContext;
  included: boolean;
  onToggle: () => void;
  copy: CopilotMessages;
}) {
  const summary = formatContextSummary(pageContext, copy);
  return (
    <div className="cop-ctx-chip" data-included={included ? "true" : "false"}>
      <span className="truncate">
        <strong>{copy.context.thisPage}:</strong> {summary}
      </span>
      <button
        type="button"
        className="ctr-chip-btn"
        aria-pressed={included}
        aria-label={included ? copy.context.toggleExclude : copy.context.toggleInclude}
        onClick={onToggle}
      >
        {included ? <EyeIcon aria-hidden="true" /> : <EyeOffIcon aria-hidden="true" />}
        <span>{included ? copy.context.include : copy.context.exclude}</span>
      </button>
    </div>
  );
}

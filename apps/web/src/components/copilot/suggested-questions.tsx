"use client";

import type { CopilotMessages } from "@/lib/copilot/messages";
import type { CopilotSuggestionDto } from "@/lib/copilot/types";
import { suggestionTitle } from "@/lib/copilot/view";

export function SuggestedQuestions({
  suggestions,
  loading,
  disabled,
  onSelect,
  copy,
}: {
  suggestions: readonly CopilotSuggestionDto[];
  loading: boolean;
  disabled: boolean;
  onSelect: (prompt: string) => void;
  copy: CopilotMessages;
}) {
  if (loading) {
    return <p className="ctr-small">{copy.empty.loadingSuggestions}</p>;
  }
  if (suggestions.length === 0) return null;

  return (
    <section aria-label={copy.empty.suggestionsLabel} style={{ display: "grid", gap: "0.45rem" }}>
      <span className="ctr-label">{copy.empty.suggestionsLabel}</span>
      <div className="ctr-chips">
        {suggestions.map((item) => (
          <button
            key={item.id}
            type="button"
            className="ctr-chip-btn"
            disabled={disabled}
            onClick={() => onSelect(item.prompt)}
          >
            {suggestionTitle(item, copy)}
          </button>
        ))}
      </div>
    </section>
  );
}

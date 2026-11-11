"use client";

import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import { formatDateTime } from "@/lib/ai-admin/view";
import type { AuthLocale } from "@/lib/auth/types";
import type { CopilotMessages } from "@/lib/copilot/messages";
import type { CopilotSourceDto } from "@/lib/copilot/types";
import { isSafeInternalLink } from "@/lib/copilot/view";

export function AnswerSources({
  sources,
  selectedRef,
  onSelectRef,
  onNavigate,
  copy,
  locale,
}: {
  sources: readonly CopilotSourceDto[];
  selectedRef: number | null;
  onSelectRef: (n: number) => void;
  onNavigate?: () => void;
  copy: CopilotMessages;
  locale: AuthLocale;
}) {
  if (sources.length === 0) return null;

  return (
    <section aria-label={copy.answer.sourcesHeading} style={{ display: "grid", gap: "0.45rem" }}>
      <h4 style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700 }}>{copy.answer.sourcesHeading}</h4>
      <ol className="ai-sources">
        {sources.map((src) => {
          const safeHref = isSafeInternalLink(src.link) ? src.link : null;
          return (
            <li
              key={src.n}
              className="ai-source"
              data-active={selectedRef === src.n ? "true" : "false"}
            >
              <header>
                <button
                  type="button"
                  className="ai-cite"
                  aria-pressed={selectedRef === src.n}
                  onClick={() => onSelectRef(src.n)}
                >
                  {src.n}
                </button>
                <span className="ctr-badge" data-tone="neutral">{src.type}</span>
                <strong style={{ fontSize: "0.82rem" }}>{src.label}</strong>
              </header>
              <div className="ctr-row" style={{ justifyContent: "space-between", fontSize: "0.75rem" }}>
                <span className="ctr-muted">
                  {src.asOf ? formatDateTime(src.asOf, locale) : src.tool}
                </span>
                {safeHref ? (
                  <Link
                    href={safeHref}
                    className="cop-nav-link"
                    onClick={() => onNavigate?.()}
                  >
                    <span>{copy.answer.openRecord.replace("{label}", src.type)}</span>
                    <ExternalLinkIcon aria-hidden="true" style={{ width: "0.75rem", height: "0.75rem" }} />
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

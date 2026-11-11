"use client";

import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";

import type { CopilotMessages } from "@/lib/copilot/messages";
import type { CopilotSourceDto } from "@/lib/copilot/types";
import { isSafeInternalLink } from "@/lib/copilot/view";

export function NavigationLinks({
  sources,
  copy,
  onNavigate,
}: {
  sources: readonly CopilotSourceDto[];
  copy: CopilotMessages;
  onNavigate?: () => void;
}) {
  const uniqueLinks = new Map<string, string>();
  for (const src of sources) {
    if (isSafeInternalLink(src.link) && !uniqueLinks.has(src.link)) {
      uniqueLinks.set(src.link, src.label);
    }
  }
  if (uniqueLinks.size === 0) return null;

  return (
    <nav className="cop-nav-row" aria-label={copy.answer.sourcesHeading}>
      {Array.from(uniqueLinks.entries()).map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className="cop-nav-link"
          onClick={() => onNavigate?.()}
        >
          <span>{copy.answer.openRecord.replace("{label}", label)}</span>
          <ArrowUpRightIcon aria-hidden="true" style={{ width: "0.85rem", height: "0.85rem" }} />
        </Link>
      ))}
    </nav>
  );
}

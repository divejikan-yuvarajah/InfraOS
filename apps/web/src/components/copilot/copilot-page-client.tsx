"use client";

import Link from "next/link";
import { useEffect } from "react";

import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { getCopilotCopy } from "@/lib/copilot/messages";

import { useCopilot } from "./copilot-provider";
import "@/styles/ai-copilot.css";
import "@/styles/contractors.css";

/**
 * Full-page entry for the SAME Copilot panel and state used by the floating launcher: this page only explains what
 * to ask and opens the shared panel, so there is no second chat implementation to keep in sync.
 */
export function CopilotPageClient() {
  const [locale] = useWorkspaceLocale();
  const copy = getCopilotCopy(locale);
  const { open, openCopilot, openQuickFacts } = useCopilot();

  useEffect(() => {
    openCopilot();
    // Open once on arrival; the user can close it and reopen from the buttons below.
  }, [openCopilot]);

  return (
    <main style={{ maxWidth: "56rem", margin: "0 auto", padding: "1.5rem 1rem 3rem", display: "grid", gap: "1rem" }}>
      <header className="ctr-panel" style={{ display: "grid", gap: "0.6rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>{copy.page.title}</h1>
        <p className="ctr-small" style={{ margin: 0 }}>{copy.page.subtitle}</p>
        <div className="ctr-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="ctr-btn is-primary" onClick={openCopilot} aria-pressed={open}>
            {copy.page.openButton}
          </button>
          <button type="button" className="ctr-btn" onClick={openQuickFacts}>
            {copy.page.quickFactsButton}
          </button>
          <Link href="/ai/about" className="ctr-btn is-ghost">
            {copy.header.aboutLink}
          </Link>
        </div>
      </header>

      <section className="ctr-panel" aria-labelledby="cop-page-ask" style={{ display: "grid", gap: "0.5rem" }}>
        <h2 id="cop-page-ask" style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>{copy.page.whatCanIAskTitle}</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
          {[copy.page.example1, copy.page.example2, copy.page.example3, copy.page.example4].map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
        <p className="ctr-small" style={{ margin: 0 }}>{copy.page.scopeNote}</p>
      </section>
    </main>
  );
}

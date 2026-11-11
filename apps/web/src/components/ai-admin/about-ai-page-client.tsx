"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import { getAuthSnapshot, getServerAuthSnapshot, subscribeAuth } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { AboutAi } from "./about-ai";
import "@/styles/ai-copilot.css";
import "@/styles/contractors.css";

export function AboutAiPageClient() {
  const [locale] = useWorkspaceLocale();
  const copy = getAiAdminCopy(locale);
  const auth = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getServerAuthSnapshot);

  return (
    <main
      style={{
        maxWidth: "72rem",
        margin: "0 auto",
        padding: "1.5rem 1rem 3rem",
        display: "grid",
        gap: "1rem",
      }}
    >
      <header className="ctr-panel" style={{ display: "grid", gap: "0.45rem" }}>
        <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <Link
            href={auth.authenticated ? "/settings/ai" : "/"}
            className="ctr-btn is-ghost"
          >
            <ArrowLeftIcon aria-hidden="true" />
            <span>{copy.about.backToWorkspace}</span>
          </Link>
        </div>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>{copy.about.title}</h1>
        <p className="ctr-small" style={{ margin: 0 }}>{copy.about.subtitle}</p>
      </header>

      <AboutAi locale={locale} />
    </main>
  );
}


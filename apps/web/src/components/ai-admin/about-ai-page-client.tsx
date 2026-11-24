"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { CommandHeader } from "@/components/common/civic-atlas-primitives";
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
      <CommandHeader
        eyebrow="INFRAOS · AI Governance"
        title={copy.about.title}
        subtitle={copy.about.subtitle}
        sourceKind="recorded"
        sourceLabel="Policy & Architecture"
        secondaryActions={
          <Link
            href={auth.authenticated ? "/settings/ai" : "/"}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/25 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/10"
          >
            <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
            <span>{copy.about.backToWorkspace}</span>
          </Link>
        }
      />

      <AboutAi locale={locale} />
    </main>
  );
}


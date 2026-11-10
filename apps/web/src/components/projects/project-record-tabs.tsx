"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getFinanceCopy } from "@/lib/finance/messages";
import { canHintFinance } from "@/lib/finance/session";
import { getRiskCopy } from "@/lib/risk/messages";
import { canHintRisk } from "@/lib/risk/session";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { getInspectionCopy } from "@/lib/inspections/messages";
import { hintInspections } from "@/components/inspections/inspection-integrations";
import { canLinkTimeline } from "@/lib/projects/timeline-view";
import type { getProjectCopy } from "@/lib/projects/messages";

import "@/styles/site-plan-projects.css";

type Copy = ReturnType<typeof getProjectCopy>;

/**
 * Section navigation for one project record. These are the same routes the old button rows linked to;
 * Timeline and Activity keep their existing role gate (`canLinkTimeline`).
 */
export function ProjectRecordTabs({ id, roleKey, copy }: { id: string; roleKey: string; copy: Copy }) {
  const pathname = usePathname() ?? "";
  const [locale] = useWorkspaceLocale();
  const tabs = [
    { slug: "overview", label: copy.overview, icon: "dashboard_customize" },
    { slug: "milestones", label: copy.milestones, icon: "flag" },
    { slug: "progress", label: copy.physicalProgress, icon: "trending_up" },
    ...(canLinkTimeline(roleKey)
      ? [
          { slug: "timeline", label: copy.timeline, icon: "conversion_path" },
          { slug: "activity", label: copy.activity, icon: "history" },
        ]
      : []),
    // Shown to roles that can hold inspection.read; the page itself is permission-checked on the server.
    ...(hintInspections(roleKey)
      ? [{ slug: "inspections", label: getInspectionCopy(locale).project.tab, icon: "fact_check" }]
      : []),
    // Shown to roles that can read project finance; the finance page itself is permission-checked on the server.
    ...(canHintFinance(roleKey)
      ? [{ slug: "finance", label: getFinanceCopy(locale).nav, icon: "account_balance_wallet" }]
      : []),
    // Shown to roles that can read project risk; the risk page itself is permission-checked on the server.
    ...(canHintRisk(roleKey)
      ? [{ slug: "risk", label: getRiskCopy(locale).tab, icon: "warning_amber" }]
      : []),
  ];
  return (
    <nav
      aria-label="Project sections"
      className="spp-tabs bg-surface-container-lowest border border-outline-variant/30 rounded shadow-2xs px-3 mb-5 sticky top-0 z-20"
    >
      <ul className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const href = `/projects/${id}/${tab.slug}`;
          const current =
            pathname === href ||
            (tab.slug === "overview" && pathname === `/projects/${id}`);
          return (
            <li key={tab.slug}>
              <Link
                href={href}
                className={
                  current
                    ? "spp-tab is-current inline-flex items-center gap-2 px-3.5 py-3 border-b-[3px] border-secondary text-xs font-bold text-on-surface bg-surface-container-low/40 whitespace-nowrap transition-colors"
                    : "spp-tab inline-flex items-center gap-2 px-3.5 py-3 border-b-[3px] border-transparent text-xs font-medium text-on-surface-variant hover:text-on-surface hover:border-outline-variant/60 whitespace-nowrap transition-colors"
                }
                aria-current={current ? "page" : undefined}
              >
                <span
                  className={`material-symbols-outlined text-[16px] ${
                    current ? "text-secondary" : "text-outline"
                  }`}
                >
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

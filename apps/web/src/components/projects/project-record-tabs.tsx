"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const tabs = [
    { slug: "overview", label: copy.overview },
    { slug: "milestones", label: copy.milestones },
    { slug: "progress", label: copy.physicalProgress },
    ...(canLinkTimeline(roleKey)
      ? [
          { slug: "timeline", label: copy.timeline },
          { slug: "activity", label: copy.activity },
        ]
      : []),
  ];
  return (
    <nav aria-label="Project sections" className="spp-tabs">
      <ul>
        {tabs.map((tab) => {
          const href = `/projects/${id}/${tab.slug}`;
          const current = pathname === href;
          return (
            <li key={tab.slug}>
              <Link href={href} className={current ? "spp-tab is-current" : "spp-tab"} aria-current={current ? "page" : undefined}>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

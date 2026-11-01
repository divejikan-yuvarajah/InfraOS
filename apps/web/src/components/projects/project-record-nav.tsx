"use client";

import { useSyncExternalStore } from "react";

import { ContextBar } from "@/components/site-plan/site-plan";
import { getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { getProjectCopy } from "@/lib/projects/messages";

import { ProjectRecordTabs } from "./project-record-tabs";

function useRole(): string {
  return useSyncExternalStore(subscribeAuth, () => getMemorySession()?.user.roleKey ?? "", () => "");
}

/** Section tabs for a project's sub-pages; role and copy come from the session and workspace language. */
export function ProjectRecordNav({ id, locale }: { id: string; locale: AuthLocale }) {
  return <ProjectRecordTabs id={id} roleKey={useRole()} copy={getProjectCopy(locale)} />;
}

/** Breadcrumb for top-level staff pages: Workspace / (Projects /) current page. */
export function WorkspaceContext({ locale, current, projects = false }: { locale: AuthLocale; current: string; projects?: boolean }) {
  const copy = getProjectCopy(locale);
  return (
    <ContextBar
      crumbs={[
        { label: copy.breadcrumbWorkspace, href: "/dashboard" },
        ...(projects ? [{ label: copy.breadcrumbProjects, href: "/projects" }] : []),
        { label: current },
      ]}
    />
  );
}

/** Breadcrumb for a project sub-page: Projects / Project / current page. */
export function RecordContext({ id, locale, current }: { id: string; locale: AuthLocale; current: string }) {
  const copy = getProjectCopy(locale);
  return (
    <ContextBar
      crumbs={[
        { label: copy.breadcrumbProjects, href: "/projects" },
        { label: copy.overview, href: `/projects/${id}/overview` },
        { label: current },
      ]}
    />
  );
}

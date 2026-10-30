"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ProjectDashboard } from "@/components/projects/project-dashboard";
import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { logoutWithAuthClient } from "@/lib/auth/client";
import type { AuthLocale } from "@/lib/auth/types";
import { getDashboardCopy } from "@/lib/projects/dashboard-messages";

export function WorkspaceHome() {
  const [locale, setLocale] = useState<AuthLocale>("en");
  const copy = getDashboardCopy(locale);
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function signOut() {
    setLeaving(true);
    await logoutWithAuthClient();
    router.replace("/");
  }

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.description} wide>
      <ProjectDashboard locale={locale} onLocale={setLocale} />
      <div className="auth-access-actions">
        <Link className="auth-access-link" href="/profile">
          {copy.profile}
        </Link>
        <Link className="auth-access-link" href="/settings">
          {copy.settings}
        </Link>
        <Link className="auth-access-link" href="/admin/users">
          {copy.staff}
        </Link>
        <Link className="auth-access-link" href="/admin/agencies">
          {copy.agencies}
        </Link>
        <Link className="auth-access-link" href="/admin/roles">
          {copy.roles}
        </Link>
        <button type="button" className="auth-access-button" disabled={leaving} onClick={() => void signOut()}>
          {copy.signOut}
        </button>
        <Link className="auth-access-link" href="/">
          {copy.publicSite}
        </Link>
      </div>
    </StaffWorkspaceShell>
  );
}

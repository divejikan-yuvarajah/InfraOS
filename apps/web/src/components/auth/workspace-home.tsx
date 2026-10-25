"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { logoutWithAuthClient } from "@/lib/auth/client";
import { getAuthAccessCopy } from "@/lib/auth/messages";

export function WorkspaceHome() {
  const copy = getAuthAccessCopy();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function signOut() {
    setLeaving(true);
    await logoutWithAuthClient();
    router.replace("/");
  }

  return (
    <StaffWorkspaceShell title={copy.workspaceTitle} description={copy.workspaceBody}>
      <section className="auth-access-card" aria-labelledby="workspace-status">
        <p id="workspace-status" className="auth-access-status" role="status">
          {copy.nativeReview}
        </p>
      </section>
      <div className="auth-access-actions">
        <Link className="auth-access-link" href="/profile">
          Profile
        </Link>
        <Link className="auth-access-link" href="/settings">
          Settings
        </Link>
        <Link className="auth-access-link" href="/admin/users">
          Staff directory
        </Link>
        <Link className="auth-access-link" href="/admin/agencies">
          Agencies
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

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <div data-infra-app className="auth-access-root">
      <main className="auth-access-main">
        <p className="auth-access-kicker">INFRAOS</p>
        <h1 className="auth-access-title">{copy.workspaceTitle}</h1>
        <p className="auth-access-copy">{copy.workspaceBody}</p>
        <section className="auth-access-card" aria-labelledby="workspace-status">
          <p id="workspace-status" className="auth-access-status" role="status">
            {copy.nativeReview}
          </p>
        </section>
        <div className="auth-access-actions">
          <button type="button" className="auth-access-button" disabled={leaving} onClick={() => void signOut()}>
            {copy.signOut}
          </button>
          <Link className="auth-access-link" href="/">
            {copy.publicSite}
          </Link>
        </div>
      </main>
    </div>
  );
}

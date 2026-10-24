"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

import { getAuthAvailability } from "@/lib/auth/availability";
import { confirmSessionWithMe } from "@/lib/auth/confirm-identity";
import { getAuthAccessCopy } from "@/lib/auth/messages";
import { refreshAuthSessionSingleFlight } from "@/lib/auth/refresh-flight";
import { loginHrefForPrivatePath, sanitizeNextParam } from "@/lib/auth/redirect";
import {
  DASHBOARD_PATH,
  classifyAppPath,
  isLoginPath,
  privateAccessDecision,
} from "@/lib/auth/route-access";
import {
  getAuthSnapshot,
  getMemoryAccessToken,
  getServerAuthSnapshot,
  subscribeAuth,
} from "@/lib/auth/state";

import "@/styles/auth-access.css";

function AccessStatus({
  title,
  body,
  action,
  alert = false,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  alert?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [title]);

  return (
    <div data-infra-app className="auth-access-root">
      <main className="auth-access-main">
        <p className="auth-access-kicker">INFRAOS</p>
        <h1 ref={headingRef} className="auth-access-title" tabIndex={-1}>
          {title}
        </h1>
        <p className="auth-access-copy" role={alert ? "alert" : "status"} aria-live={alert ? "assertive" : "polite"}>
          {body}
        </p>
        {action ? <div className="auth-access-actions">{action}</div> : null}
      </main>
    </div>
  );
}

export function RouteAccessGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const copy = getAuthAccessCopy();
  const snapshot = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getServerAuthSnapshot);
  const pathClass = classifyAppPath(pathname);
  const decision =
    pathClass === "private"
      ? privateAccessDecision({ availability: getAuthAvailability(), snapshot })
      : null;

  useEffect(() => {
    if (!isLoginPath(pathname) || !snapshot.authenticated || !snapshot.bootSettled) return;
    const raw = new URLSearchParams(window.location.search).get("next");
    const safe = sanitizeNextParam(raw);
    router.replace(safe ?? DASHBOARD_PATH);
  }, [pathname, router, snapshot.authenticated, snapshot.bootSettled]);

  useEffect(() => {
    if (decision !== "login") return;
    const href = loginHrefForPrivatePath(pathname, window.location.search);
    router.replace(href);
  }, [decision, pathname, router]);

  useEffect(() => {
    if (decision !== "confirm") return;
    void confirmSessionWithMe();
  }, [decision]);

  if (pathClass !== "private" || decision === "content" || decision === null) {
    return children;
  }

  if (decision === "loading" || decision === "confirm") {
    return (
      <AccessStatus title={copy.checking} body={copy.nativeReview} />
    );
  }

  if (decision === "preview") {
    return <AccessStatus title={copy.previewTitle} body={copy.previewBody} />;
  }

  if (decision === "retry") {
    return (
      <AccessStatus
        title={copy.retryTitle}
        body={copy.retryBody}
        alert
        action={
          <button
            type="button"
            className="auth-access-button"
            onClick={() => {
              if (getMemoryAccessToken()) {
                void confirmSessionWithMe();
                return;
              }
              void refreshAuthSessionSingleFlight();
            }}
          >
            {copy.retry}
          </button>
        }
      />
    );
  }

  return <AccessStatus title={copy.checking} body={copy.nativeReview} />;
}

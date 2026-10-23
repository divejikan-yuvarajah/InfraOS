import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/styles/auth-login.css";

export const metadata: Metadata = {
  title: "Sign in · INFRAOS",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div data-infra-app className="auth-login-root min-h-dvh">
      {children}
    </div>
  );
}

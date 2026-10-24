import type { Metadata } from "next";

import { ForgotPasswordPageShell } from "@/components/auth/forgot-password-page-shell";

export const metadata: Metadata = {
  title: "கடவுச்சொல் · INFRAOS",
  robots: { index: false, follow: false },
};

export default function TamilForgotPasswordPage() {
  return <ForgotPasswordPageShell locale="ta" />;
}

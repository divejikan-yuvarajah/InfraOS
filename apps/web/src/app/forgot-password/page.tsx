import type { Metadata } from "next";

import { ForgotPasswordPageShell } from "@/components/auth/forgot-password-page-shell";

export const metadata: Metadata = {
  title: "Reset password · INFRAOS",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageShell locale="en" />;
}

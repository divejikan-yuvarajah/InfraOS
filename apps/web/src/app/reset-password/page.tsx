import type { Metadata } from "next";

import { ResetPasswordPageShell } from "@/components/auth/reset-password-page-shell";

export const metadata: Metadata = {
  title: "Reset password · INFRAOS",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return <ResetPasswordPageShell locale="en" />;
}

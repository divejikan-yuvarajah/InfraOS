import type { Metadata } from "next";

import { ForgotPasswordPageShell } from "@/components/auth/forgot-password-page-shell";

export const metadata: Metadata = {
  title: "මුරපදය · INFRAOS",
  robots: { index: false, follow: false },
};

export default function SinhalaForgotPasswordPage() {
  return <ForgotPasswordPageShell locale="si" />;
}

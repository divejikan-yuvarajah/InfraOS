import type { Metadata } from "next";

import { RegisterPageShell } from "@/components/auth/register-page-shell";

export const metadata: Metadata = {
  title: "Create Institutional Account — InfraOS",
  description:
    "Begin the institutional access and verification process for the InfraOS National Infrastructure Intelligence & Coordination Platform.",
};

type SignupPageProps = {
  searchParams: Promise<{ step?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const parsedStep = params.step === "2" ? 2 : params.step === "3" ? 3 : 1;
  return <RegisterPageShell locale="en" initialStep={parsedStep} />;
}


import type { Metadata } from "next";

import { RegisterPageShell } from "@/components/auth/register-page-shell";

export const metadata: Metadata = {
  title: "ආයතනික ගිණුමක් සාදන්න — InfraOS",
  description:
    "InfraOS ජාතික යටිතල පහසුකම් බුද්ධි හා සම්බන්ධීකරණ වේදිකාව සඳහා ආයතනික ප්‍රවේශ ඉල්ලීම ආරම්භ කරන්න.",
};

type RegisterPageProps = {
  searchParams: Promise<{ step?: string }>;
};

export default async function SinhalaRegisterPage({
  searchParams,
}: RegisterPageProps) {
  const params = await searchParams;
  const parsedStep = params.step === "2" ? 2 : params.step === "3" ? 3 : 1;
  return <RegisterPageShell locale="si" initialStep={parsedStep} />;
}


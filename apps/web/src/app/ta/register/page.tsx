import type { Metadata } from "next";

import { RegisterPageShell } from "@/components/auth/register-page-shell";

export const metadata: Metadata = {
  title: "நிறுவன கணக்கை உருவாக்கவும் — InfraOS",
  description:
    "InfraOS தேசிய உள்கட்டமைப்பு நுண்ணறிவு மற்றும் ஒருங்கிணைப்பு தளத்திற்கான நிறுவன அணுகல் செயல்முறையைத் தொடங்கவும்.",
};

type RegisterPageProps = {
  searchParams: Promise<{ step?: string }>;
};

export default async function TamilRegisterPage({
  searchParams,
}: RegisterPageProps) {
  const params = await searchParams;
  const parsedStep = params.step === "2" ? 2 : params.step === "3" ? 3 : 1;
  return <RegisterPageShell locale="ta" initialStep={parsedStep} />;
}


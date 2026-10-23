import { LoginPageShell } from "@/components/auth/login-page-shell";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function TamilLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return <LoginPageShell locale="ta" nextParam={params.next ?? null} />;
}

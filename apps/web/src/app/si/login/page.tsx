import { LoginPageShell } from "@/components/auth/login-page-shell";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SinhalaLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return <LoginPageShell locale="si" nextParam={params.next ?? null} />;
}

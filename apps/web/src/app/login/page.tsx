import { LoginPageShell } from "@/components/auth/login-page-shell";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return <LoginPageShell locale="en" nextParam={params.next ?? null} />;
}

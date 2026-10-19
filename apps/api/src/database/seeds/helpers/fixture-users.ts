/** Non-login fixture hash only; never a usable password. */
export const NON_LOGIN_PASSWORD_HASH =
  "SYNTHETIC_NON_LOGIN_FIXTURE_" + "x".repeat(40);

export const DEMO_USER_EMAIL_DOMAIN = "infraos-demo.invalid";

export const DEMO_USER_KEYS = [
  "PROJECT_MANAGER",
  "AGENCY_OFFICER",
  "INSPECTOR",
  "FINANCE_OFFICER",
  "CITIZEN",
] as const;

export type DemoUserKey = (typeof DEMO_USER_KEYS)[number];

export function demoUserEmail(key: DemoUserKey): string {
  return `demo.fixture.${key.toLowerCase()}@${DEMO_USER_EMAIL_DOMAIN}`;
}

export function isDemoFixtureUserEmail(email: string): boolean {
  return email.endsWith(`@${DEMO_USER_EMAIL_DOMAIN}`);
}

import { registerPathForLocale } from "@/lib/auth/redirect";
import type { AuthLocale } from "@/lib/auth/types";

import { AuthStitchFrame } from "./auth-stitch-frame";
import { RegisterWizardForm } from "./register-wizard-form";

type RegisterPageShellProps = {
  locale: AuthLocale;
  initialStep?: 1 | 2 | 3;
};

export function RegisterPageShell({ locale, initialStep = 1 }: RegisterPageShellProps) {
  return (
    <AuthStitchFrame
      locale={locale}
      localeHrefFor={(item) => registerPathForLocale(item)}
      variant="register"
    >
      <RegisterWizardForm locale={locale} initialStep={initialStep} />
    </AuthStitchFrame>
  );
}


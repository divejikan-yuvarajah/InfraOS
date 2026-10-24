import type { AuthLocale } from "./types";

export type AuthResetCopy = {
  title: string;
  subtitle: string;
  passwordLabel: string;
  submit: string;
  submitting: string;
  reset: string;
  rejected: string;
  unavailable: string;
  missing: string;
  tooShort: string;
  tooLong: string;
  privacy: string;
  backToLogin: string;
  nativeReview: string;
};

export type AuthForgotCopy = {
  title: string;
  subtitle: string;
  demoNotice: string;
  emailLabel: string;
  submit: string;
  submitting: string;
  accepted: string;
  unavailable: string;
  retry: string;
  privacy: string;
  backToLogin: string;
  nativeReview: string;
};

export type AuthLoginCopy = {
  title: string;
  subtitle: string;
  demoNotice: string;
  notLiveBanner: string;
  emailLabel: string;
  passwordLabel: string;
  showPassword: string;
  hidePassword: string;
  submit: string;
  submitting: string;
  forgotPassword: string;
  helpLink: string;
  homeLink: string;
  corridorTagline: string;
  corridorBody: string;
  nativeReview: string;
};

const EN: AuthLoginCopy = {
  title: "Sign in to INFRAOS",
  subtitle: "University GovTech demonstration workspace. Not an official government portal.",
  demoNotice:
    "Staff accounts are provisioned by administrators. There is no public staff registration.",
  notLiveBanner:
    "Sign-in is not live until Step 39 connects this page to the authentication service.",
  emailLabel: "Work email",
  passwordLabel: "Password",
  showPassword: "Show password",
  hidePassword: "Hide password",
  submit: "Sign in",
  submitting: "Signing in…",
  helpLink: "How it works",
  homeLink: "Public site",
  corridorTagline: "Infrastructure coordination",
  corridorBody:
    "Route-aware planning, agency coordination, and governed project intelligence for demonstration use.",
  forgotPassword: "Forgot password?",
  nativeReview: "Sinhala and Tamil copy is draft until native review.",
};

const FORGOT_EN: AuthForgotCopy = {
  title: "Reset your password",
  subtitle: "University GovTech demonstration workspace. Not an official government portal.",
  demoNotice:
    "If a matching staff account can sign in, recovery instructions are prepared. This demo does not send live email until a mail provider is approved.",
  emailLabel: "Work email",
  submit: "Request reset",
  submitting: "Requesting…",
  accepted:
    "If an account can be recovered, instructions will be sent. This page cannot confirm whether an address is registered.",
  unavailable: "Recovery is temporarily unavailable. Try again shortly.",
  retry: "Try again",
  privacy:
    "We do not tell you whether this address exists, is verified, or is active. Do not share recovery links.",
  backToLogin: "Back to sign in",
  nativeReview: "Sinhala and Tamil copy is draft until native review.",
};

const FORGOT_SI: AuthForgotCopy = {
  ...FORGOT_EN,
  title: "මුරපදය යළි සකසන්න",
  subtitle: "විශ්වවිද්‍යා GovTech ආදර්ශනයකි. නිල රජයේ දොරටුවක් නොවේ.",
  emailLabel: "වැඩ ඊමේල්",
  submit: "යළි සැකසීම ඉල්ලන්න",
  submitting: "ඉල්ලමින්…",
  backToLogin: "පිවිසීමට ආපසු",
  nativeReview: "සිංහල/දෙමළ පිටපත් native review සඳහා draft.",
};

const FORGOT_TA: AuthForgotCopy = {
  ...FORGOT_EN,
  title: "கடவுச்சொல்லை மீட்டமை",
  subtitle: "University GovTech demo. Official government portal அல்ல.",
  submit: "மீட்டமைப்பு கோரிக்கை",
  submitting: "அனுப்புகிறது…",
  backToLogin: "உள்நுழைவுக்குத் திரும்பு",
  nativeReview: "Sinhala/Tamil copy native review pending.",
};

const SI: AuthLoginCopy = {
  ...EN,
  title: "INFRAOS වෙත පිවිසෙන්න",
  subtitle: "විශ්වවිද්‍යා GovTech පෙළිගේන demo.workbench. නිල රජයේ දොරටුවක් නොවේ.",
  demoNotice: "කාර්ය මණ්ඩල ගිණුම් පරිපාලකයින් විසින් සැපයේ. පොදු ලියාපදිංචියක් නැත.",
  notLiveBanner:
    "Step 39 authentication service සම්බන්ධ වන තුරු sign-in live නොවේ.",
  emailLabel: "Work email",
  passwordLabel: "මුරපදය",
  showPassword: "මුරපදය පෙන්වන්න",
  hidePassword: "මුරපදය සඟවන්න",
  submit: "පිවිසෙන්න",
  submitting: "පිවිසෙමින්…",
  helpLink: "ක්‍රමය",
  homeLink: "පොදු අඩවිය",
  corridorTagline: "Infrastructure coordination",
  corridorBody:
    "Route-aware planning, agency coordination, and governed project intelligence for demonstration use.",
  nativeReview: "සිංහල/දෙමළ පිටපත් native review සඳහා draft.",
};

const TA: AuthLoginCopy = {
  ...EN,
  title: "INFRAOS உள்நுழை",
  subtitle: "University GovTech demo workspace. Official government portal அல்ல.",
  demoNotice: "Staff accounts administrators provision செய்கின்றனர். Public registration இல்லை.",
  notLiveBanner: "Step 39 authentication service இணைக்கப்படும் வரை sign-in live அல்ல.",
  emailLabel: "Work email",
  passwordLabel: "Password",
  showPassword: "Show password",
  hidePassword: "Hide password",
  submit: "Sign in",
  submitting: "Signing in…",
  helpLink: "How it works",
  homeLink: "Public site",
  corridorTagline: "Infrastructure coordination",
  corridorBody:
    "Route-aware planning, agency coordination, and governed project intelligence for demonstration use.",
  nativeReview: "Sinhala/Tamil copy native review pending.",
};

export function getAuthLoginCopy(locale: AuthLocale): AuthLoginCopy {
  if (locale === "si") return SI;
  if (locale === "ta") return TA;
  return EN;
}

const RESET_EN: AuthResetCopy = {
  title: "Choose a new password",
  subtitle: "University GovTech demonstration workspace. Not an official government portal.",
  passwordLabel: "New password",
  submit: "Update password",
  submitting: "Updating…",
  reset: "Your password was updated. Sign in with the new password. This does not sign you in.",
  rejected: "This reset link could not be used. Request a new one.",
  unavailable: "Password reset is temporarily unavailable. You can try again.",
  missing: "This page needs a reset link. Request a new one from sign in.",
  tooShort: "Use at least 8 characters.",
  tooLong: "Use at most 72 bytes.",
  privacy: "The reset link is removed from the address bar. It is not stored in this browser.",
  backToLogin: "Back to sign in",
  nativeReview: "Sinhala and Tamil copy is draft until native review.",
};

const RESET_SI: AuthResetCopy = {
  ...RESET_EN,
  title: "නව මුරපදයක් තෝරන්න",
  passwordLabel: "නව මුරපදය",
  submit: "මුරපදය යාවත්කාලීන කරන්න",
  backToLogin: "පිවිසීමට ආපසු",
  nativeReview: "සිංහල/දෙමළ පිටපත් native review සඳහා draft.",
};

const RESET_TA: AuthResetCopy = {
  ...RESET_EN,
  title: "புதிய கடவுச்சொல்",
  passwordLabel: "புதிய கடவுச்சொல்",
  submit: "கடவுச்சொல்லை புதுப்பி",
  backToLogin: "உள்நுழைவுக்குத் திரும்பு",
  nativeReview: "Sinhala/Tamil copy native review pending.",
};

export function getAuthForgotCopy(locale: AuthLocale): AuthForgotCopy {
  if (locale === "si") return FORGOT_SI;
  if (locale === "ta") return FORGOT_TA;
  return FORGOT_EN;
}

export function getAuthResetCopy(locale: AuthLocale): AuthResetCopy {
  if (locale === "si") return RESET_SI;
  if (locale === "ta") return RESET_TA;
  return RESET_EN;
}

export type AuthAccessCopy = {
  checking: string;
  workspaceTitle: string;
  workspaceBody: string;
  previewTitle: string;
  previewBody: string;
  retryTitle: string;
  retryBody: string;
  retry: string;
  signOut: string;
  publicSite: string;
  nativeReview: string;
};

const ACCESS_EN: AuthAccessCopy = {
  checking: "Checking your session.",
  workspaceTitle: "Workspace shell",
  workspaceBody: "Operational modules are not available yet. This page only confirms an authenticated session.",
  previewTitle: "Sign-in is not live in this build",
  previewBody: "This workspace stays hidden until a non-production live session is available. No private records are shown.",
  retryTitle: "The workspace could not be checked",
  retryBody: "The authentication service did not respond. Your session was not signed out. Try again.",
  retry: "Try again",
  signOut: "Sign out",
  publicSite: "Public site",
  nativeReview: "Staff workspace copy is English. Sinhala and Tamil staff pages are not available yet.",
};

export function getAuthAccessCopy(): AuthAccessCopy {
  return ACCESS_EN;
}

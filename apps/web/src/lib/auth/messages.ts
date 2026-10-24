import type { AuthLocale } from "./types";

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

export function getAuthForgotCopy(locale: AuthLocale): AuthForgotCopy {
  if (locale === "si") return FORGOT_SI;
  if (locale === "ta") return FORGOT_TA;
  return FORGOT_EN;
}

import type { AuthLocale } from "./types";

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
  nativeReview: "Sinhala and Tamil copy is draft until native review.",
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

import type { AuthLocale } from "@/lib/auth/types";

export type ProfileCopy = {
  title: string;
  subtitle: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  agency: string;
  verified: string;
  lastLogin: string;
  save: string;
  saving: string;
  cancel: string;
  saved: string;
  reload: string;
  conflict: string;
  forbidden: string;
  unavailable: string;
  loadError: string;
  nativeReview: string;
};

export type SettingsCopy = {
  title: string;
  subtitle: string;
  email: string;
  verified: string;
  role: string;
  agency: string;
  lastLogin: string;
  passwordReset: string;
  passwordResetBody: string;
  profileLink: string;
  signOut: string;
  demoEmail: string;
  unavailable: string;
  nativeReview: string;
};

const PROFILE_EN: ProfileCopy = {
  title: "Your profile",
  subtitle: "Update how your name appears in the staff workspace.",
  firstName: "First name",
  lastName: "Last name",
  email: "Work email",
  role: "Role",
  agency: "Agency",
  verified: "Email verified",
  lastLogin: "Last sign-in",
  save: "Save changes",
  saving: "Saving…",
  cancel: "Cancel",
  saved: "Profile saved.",
  reload: "Reload current profile",
  conflict: "Someone else saved a newer version. Reload, then try again.",
  forbidden: "You cannot edit this profile.",
  unavailable: "The profile service is unavailable. Try again.",
  loadError: "Your profile could not be loaded.",
  nativeReview: "Sinhala and Tamil labels are draft until native review.",
};

const SETTINGS_EN: SettingsCopy = {
  title: "Account settings",
  subtitle: "Security overview and links for this demonstration account.",
  email: "Work email",
  verified: "Verification",
  role: "Role",
  agency: "Agency",
  lastLogin: "Last sign-in",
  passwordReset: "Password recovery",
  passwordResetBody:
    "Use the existing forgot-password flow. Live email is not enabled in this demo until a provider is approved.",
  profileLink: "Edit profile",
  signOut: "Sign out",
  demoEmail: "University GovTech demo — not an official government portal.",
  unavailable: "Account details could not be loaded.",
  nativeReview: "Sinhala and Tamil labels are draft until native review.",
};

const PROFILE_SI: ProfileCopy = {
  ...PROFILE_EN,
  title: "ඔබගේ පැතිකඩ",
  firstName: "මුල් නම",
  lastName: "අවසාන නම",
  save: "වෙනස්කම් සුරකින්න",
  nativeReview: "සිංහala/දෙමළ පිටපත් native review සඳහා draft.",
};

const PROFILE_TA: ProfileCopy = {
  ...PROFILE_EN,
  title: "உங்கள் சுயவிவரம்",
  firstName: "முதல் பெயர்",
  lastName: "குடும்பப் பெயர்",
  save: "மாற்றங்களைச் சேமி",
  nativeReview: "Sinhala/Tamil copy native review pending.",
};

const SETTINGS_SI: SettingsCopy = {
  ...SETTINGS_EN,
  title: "ගිණුම් සැකසුම්",
  passwordReset: "මුරපදය ප්‍රතිසාධනය",
};

const SETTINGS_TA: SettingsCopy = {
  ...SETTINGS_EN,
  title: "கணக்கு அமைப்புகள்",
  passwordReset: "கடவுச்சொல் மீட்பு",
};

export function getProfileCopy(locale: AuthLocale): ProfileCopy {
  if (locale === "si") return PROFILE_SI;
  if (locale === "ta") return PROFILE_TA;
  return PROFILE_EN;
}

export function getSettingsCopy(locale: AuthLocale): SettingsCopy {
  if (locale === "si") return SETTINGS_SI;
  if (locale === "ta") return SETTINGS_TA;
  return SETTINGS_EN;
}

import type { AuthLocale } from "@/lib/auth/types";

const EN = {
  title: "Roles",
  subtitle: "Review the seven system roles and their current grants.",
  readOnly: "Only a platform administrator can change role text or grants. This page does not apply hidden changes.",
  forbidden: "You do not have access to role administration.",
  unavailable: "Role administration is temporarily unavailable.",
  conflict: "This role changed, or the grant is outside the locked policy. Reload it before trying again.",
  saved: "Saved.",
  nativeReview: "Sinhala and Tamil copy is a draft pending native review.",
  reason: "Reason for the grant change",
  saveGrants: "Save grants",
  saveText: "Save name and description",
};

export type RoleCopy = typeof EN;

export function getRoleCopy(locale: AuthLocale): RoleCopy {
  if (locale === "si") {
    return { ...EN, title: "භූමිකා", subtitle: "පද්ධති භූමිකා සහ වර්තමාන අවසර සමාලෝචනය කරන්න.", forbidden: "භූමිකා පරිපාලනයට ඔබට ප්‍රවේශය නැත." };
  }
  if (locale === "ta") {
    return { ...EN, title: "பாத்திரங்கள்", subtitle: "ஏழு கணினி பாத்திரங்களையும் தற்போதைய அனுமதிகளையும் பார்க்கவும்.", forbidden: "பாத்திர நிர்வாகத்திற்கு உங்களுக்கு அணுகல் இல்லை." };
  }
  return EN;
}

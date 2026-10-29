import type { AuthLocale } from "@/lib/auth/types";

const EN = {
  title: "Reported physical progress",
  description: "This number is a project report. It is not an inspection result, a finance figure, or official completion.",
  officialStatus: "Official project status",
  recorded: "Latest recorded progress",
  noneYet: "No physical progress has been reported.",
  percentage: "Percentage (0–100)",
  note: "Note",
  noteHint: "Required. A lower percentage needs a correction note of at least 12 characters.",
  submit: "Submit report",
  saving: "Submitting report",
  saved: "Physical progress report saved. The official project status did not change.",
  history: "Report history",
  previous: "Previous",
  when: "Reported at",
  older: "Older reports",
  newer: "Newer reports",
  activeOnly: "New reports are accepted only while the official status is ACTIVE. This page does not start the project.",
  contractorBlocked: "Contractor reporting is unavailable until a user is linked to the contractor record. Signing in as a contractor does not open this project.",
  conflict: "This project changed. Reload it before reporting again.",
  invalid: "Check the percentage and note. A correction needs a longer note.",
  forbidden: "You cannot report or read physical progress for this project.",
  notFound: "This project is outside your scope, or it does not exist.",
  unavailable: "ProjectTrace is temporarily unavailable.",
  offline: "You appear to be offline. Nothing was saved.",
  blocked: "The report could not be saved.",
  compareTitle: "Physical and financial comparison",
  compareNote: "These are different measures. They do not have to match, and neither one completes the project or verifies an inspection.",
  physicalBar: "Reported physical progress",
  financialBar: "Recorded PAID-payment financial progress",
  financeRestricted: "Budget and payment figures are not available for this sign-in.",
  financeUnavailable: "A financial ratio is unavailable. No percentage is shown.",
  financeProvisional: "Provisional. Calculated from stored rows marked PAID. Not a bank payment.",
  remaining: "Remaining",
  overrun: "Overrun",
  budget: "Budget",
  paid: "Recorded PAID",
  calculatedAt: "Calculated at",
  barCapped: "The bar stops at 100%. The recorded ratio is higher.",
  back: "Project overview",
  nativeReview: "Sinhala and Tamil copy is a draft pending native review.",
  language: "Progress language",
  english: "English",
  sinhala: "සිංහල",
  tamil: "தமிழ்",
};

const SI: typeof EN = {
  ...EN,
  title: "වාර්තා කළ භෞතික ප්‍රගතිය",
  description: "මෙය වාර්තාවකි. පරීක්ෂණයක්, මූල්‍ය අගයක් හෝ නිල සම්පූර්ණ කිරීමක් නොවේ.",
  officialStatus: "නිල ව්‍යාපෘති තත්ත්වය",
  recorded: "අවසන් වාර්තාගත ප්‍රගතිය",
  submit: "වාර්තාව යවන්න",
  history: "වාර්තා ඉතිහාසය",
  back: "ව්‍යාපෘති දළ විශ්ලේෂණය",
  english: "English",
  sinhala: "සිංහල",
  tamil: "தமிழ்",
};

const TA: typeof EN = {
  ...EN,
  title: "அறிக்கையிடப்பட்ட பௌதீக முன்னேற்றம்",
  description: "இது ஒரு அறிக்கை. ஆய்வு முடிவு, நிதி எண் அல்லது அதிகாரப்பூர்வ நிறைவு அல்ல.",
  officialStatus: "அதிகாரப்பூர்வ திட்ட நிலை",
  recorded: "சமீபத்திய பதிவு செய்யப்பட்ட முன்னேற்றம்",
  submit: "அறிக்கையை அனுப்பு",
  history: "அறிக்கை வரலாறு",
  back: "திட்ட மேலோட்டம்",
  english: "English",
  sinhala: "සිංහල",
  tamil: "தமிழ்",
};

const COPY = { en: EN, si: SI, ta: TA } as const;

export function getProgressCopy(locale: AuthLocale) {
  return COPY[locale];
}

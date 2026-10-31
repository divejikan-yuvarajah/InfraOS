import type { AuthLocale } from "@/lib/auth/types";

export type ReviewCopy = {
  title: string;
  subtitle: string;
  backToProjects: string;
  backToQueue: string;
  searchLabel: string;
  statusFilter: string;
  anyStatus: string;
  agencyFilter: string;
  anyAgency: string;
  clearFilters: string;
  submittedCount: string;
  underReviewCount: string;
  empty: string;
  noMatch: string;
  openReview: string;
  reviewTitle: string;
  beginReview: string;
  approve: string;
  confirmBegin: string;
  confirmApprove: string;
  confirmPhrase: string;
  confirmAction: string;
  cancel: string;
  working: string;
  saved: string;
  conflict: string;
  reject: string;
  returnForChanges: string;
  confirmReject: string;
  confirmReturn: string;
  reasonLabel: string;
  reasonHint: string;
  invalidReason: string;
  decisionHistory: string;
  noDecision: string;
  submissionFound: string;
  submissionMissing: string;
  noActions: string;
  submissionActor: string;
  sectionSchedule: string;
  sectionLocation: string;
  sectionGeometry: string;
  sectionBudget: string;
  notProvided: string;
  signIn: string;
  forbidden: string;
  missing: string;
  unavailable: string;
  offline: string;
  nativeReview: string;
  columnCode: string;
  columnTitle: string;
  columnStatus: string;
  columnAgency: string;
};

const EN: ReviewCopy = {
  title: "Project reviews",
  subtitle: "Submitted work in your ministry that is waiting for a reviewer.",
  backToProjects: "Back to projects",
  backToQueue: "Back to the review queue",
  searchLabel: "Search by title or code",
  statusFilter: "Review status",
  anyStatus: "Submitted and under review",
  agencyFilter: "Agency",
  anyAgency: "All agencies in scope",
  clearFilters: "Clear filters",
  submittedCount: "Submitted",
  underReviewCount: "Under review",
  empty: "No projects are waiting for review in your ministry.",
  noMatch: "No projects match these filters.",
  openReview: "Open review",
  reviewTitle: "Review decision",
  beginReview: "Begin review",
  approve: "Approve project",
  confirmBegin: "Begin review of this submitted project. It will move to under review.",
  confirmApprove: "Approve this project. It will not start automatically.",
  confirmPhrase: "Type the project code to confirm",
  confirmAction: "Confirm",
  cancel: "Cancel",
  working: "Saving",
  saved: "The server confirmed this decision.",
  conflict: "Another decision used this revision. Review the latest project and try again.",
  reject: "Reject project",
  returnForChanges: "Return for correction",
  confirmReject: "Reject this project. The reason is stored with the decision.",
  confirmReturn: "Return this project to draft. The reason is stored, and editing becomes available again.",
  reasonLabel: "Decision reason",
  reasonHint: "1 to 500 characters. Do not include $ or control characters.",
  invalidReason: "Enter a specific reason the server can store.",
  decisionHistory: "Recorded decisions",
  noDecision: "No review decision has been recorded.",
  submissionFound: "Trusted submission recorded",
  submissionMissing: "No single trusted submission was found. Approval stays closed.",
  noActions: "No review action is available to you for this project right now.",
  submissionActor: "Submitting account",
  sectionSchedule: "Planned schedule",
  sectionLocation: "Location",
  sectionGeometry: "Map geometry",
  sectionBudget: "Budget",
  notProvided: "Not provided",
  signIn: "Sign in to review projects.",
  forbidden: "Your role cannot review projects.",
  missing: "This project is not in your review scope.",
  unavailable: "The review service is unavailable.",
  offline: "You appear to be offline.",
  nativeReview: "Sinhala and Tamil review labels are drafts. A native-language review is still pending.",
  columnCode: "Code",
  columnTitle: "Title",
  columnStatus: "Status",
  columnAgency: "Agency",
};

const SI: ReviewCopy = {
  ...EN,
  title: "ව්‍යාපෘති සමාලෝචන",
  subtitle: "ඔබේ අමාත්‍යාංශය තුළ සමාලෝචනය සඳහා බලා සිටින ඉදිරිපත් කළ වැඩ.",
  backToProjects: "ව්‍යාපෘති වෙත",
  backToQueue: "සමාලෝචන පෝලිම වෙත",
  searchLabel: "මාතෘකාව හෝ කේතයෙන් සොයන්න",
  empty: "ඔබේ අමාත්‍යාංශයේ සමාලෝචනය සඳහා ව්‍යාපෘති නැත.",
  beginReview: "සමාලෝචනය අරඹන්න",
  approve: "ව්‍යාපෘතිය අනුමත කරන්න",
  cancel: "අවලංගු කරන්න",
  reject: "ව්‍යාපෘතිය ප්‍රතික්ෂේප කරන්න",
  returnForChanges: "නිවැරදි කිරීම සඳහා ආපසු යවන්න",
  confirmReject: "මෙම ව්‍යාපෘතිය ප්‍රතික්ෂේප වේ. හේතුව තීරණය සමඟ සුරැකේ.",
  confirmReturn: "මෙම ව්‍යාපෘතිය කෙටුම්පතට ආපසු යයි. හේතුව සුරැකෙන අතර සංස්කරණය නැවත ලැබේ.",
  reasonLabel: "තීරණ හේතුව",
  reasonHint: "අකුරු 1 සිට 500 දක්වා.",
  invalidReason: "සේවාදායකයට සුරැකිය හැකි නිශ්චිත හේතුවක් යොදන්න.",
  decisionHistory: "සටහන් කළ තීරණ",
  noDecision: "සමාලෝචන තීරණයක් තවම නැත.",
  nativeReview: "සිංහල සහ දෙමළ සමාලෝචන ලේබල කෙටුම්පත් වේ. ස්වදේශීය සමාලෝචනය තවම බලාපොරොත්තුවෙන්.",
};

const TA: ReviewCopy = {
  ...EN,
  title: "திட்ட மதிப்பாய்வுகள்",
  subtitle: "உங்கள் அமைச்சில் மதிப்பாய்வுக்காக காத்திருக்கும் சமர்ப்பிப்புகள்.",
  backToProjects: "திட்டங்களுக்கு",
  backToQueue: "மதிப்பாய்வு வரிசைக்கு",
  searchLabel: "தலைப்பு அல்லது குறியீட்டால் தேடு",
  empty: "உங்கள் அமைச்சில் மதிப்பாய்வுக்கான திட்டங்கள் இல்லை.",
  beginReview: "மதிப்பாய்வை தொடங்கு",
  approve: "திட்டத்தை அங்கீகரி",
  cancel: "ரத்து செய்",
  reject: "திட்டத்தை நிராகரி",
  returnForChanges: "திருத்தத்திற்கு திருப்பு",
  confirmReject: "இந்த திட்டம் நிராகரிக்கப்படும். காரணம் முடிவுடன் சேமிக்கப்படும்.",
  confirmReturn: "இந்த திட்டம் வரைவுக்குத் திரும்பும். காரணம் சேமிக்கப்படும்.",
  reasonLabel: "முடிவுக்கான காரணம்",
  reasonHint: "1 முதல் 500 எழுத்துகள்.",
  invalidReason: "சேவையகம் சேமிக்கக்கூடிய குறிப்பிட்ட காரணத்தை உள்ளிடுக.",
  decisionHistory: "பதிவான முடிவுகள்",
  noDecision: "மதிப்பாய்வு முடிவு இன்னும் இல்லை.",
  nativeReview: "சிங்கள மற்றும் தமிழ் மதிப்பாய்வு லேபிள்கள் வரைவுகள். தாய்மொழி மதிப்பாய்வு இன்னும் நிலுவையில்.",
};

const COPY: Record<AuthLocale, ReviewCopy> = { en: EN, si: SI, ta: TA };

export function getReviewCopy(locale: AuthLocale): ReviewCopy {
  return COPY[locale];
}

export function reviewFailureMessage(status: number, copy: ReviewCopy): string {
  if (status === 401) return copy.signIn;
  if (status === 403) return copy.forbidden;
  if (status === 404) return copy.missing;
  if (status === 400) return copy.invalidReason;
  if (status === 409) return copy.conflict;
  return copy.unavailable;
}

import type { AuthLocale } from "@/lib/auth/types";

export type AdminUsersCopy = {
  title: string;
  subtitle: string;
  activationBlocked: string;
  forbidden: string;
  unavailable: string;
  empty: string;
  search: string;
  create: string;
  save: string;
  disable: string;
  enable: string;
  confirmDisable: string;
  confirmEnable: string;
  conflict: string;
  notFound: string;
  nativeReview: string;
};

const EN: AdminUsersCopy = {
  title: "Staff directory",
  subtitle: "Manage staff accounts in your authorized organization.",
  activationBlocked: "Activation delivery unavailable. New staff stay pending until a verified invitation channel exists.",
  forbidden: "You do not have access to staff administration.",
  unavailable: "The directory is temporarily unavailable. Retry when the connection returns.",
  empty: "No staff match this view.",
  search: "Search name or email",
  create: "Create pending staff",
  save: "Save name",
  disable: "Disable account",
  enable: "Enable account",
  confirmDisable: "Disable this account and sign them out of every session?",
  confirmEnable: "Enable this verified account? This does not send email or create a session.",
  conflict: "This account changed. Reload it before trying again.",
  notFound: "That account is not available.",
  nativeReview: "Sinhala and Tamil copy is a draft pending native review.",
};

const SI: AdminUsersCopy = {
  ...EN,
  title: "කාර්ය මණ්ඩල නාමාවලිය",
  subtitle: "ඔබට අවසර ඇති ආයතනය තුළ කාර්ය මණ්ඩල ගිණුම් කළමනාකරණය කරන්න.",
  activationBlocked: "සක්‍රිය කිරීමේ යැවීම නොමැත. ආරාධනා නාලිකාවක් තහවුරු වන තුරු නව කාර්ය මණ්ඩලය පොරොත්තු තත්වයේ පවතී.",
  forbidden: "කාර්ය මණ්ඩල පරිපාලනයට ඔබට ප්‍රවේශය නැත.",
  unavailable: "නාමාවලිය තාවකාලිකව නොමැත. සම්බන්ධතාව නැවත ලැබුණු පසු උත්සාහ කරන්න.",
  empty: "මෙම දසුනට ගැළපෙන කාර්ය මණ්ඩලයක් නැත.",
  search: "නම හෝ ඊමේල් සොයන්න",
  create: "පොරොත්තු කාර්ය මණ්ඩලයක් සාදන්න",
  save: "නම සුරකින්න",
  disable: "ගිණුම අක්‍රිය කරන්න",
  enable: "ගිණුම සක්‍රිය කරන්න",
  confirmDisable: "මෙම ගිණුම අක්‍රිය කර සියලු සැසිවලින් ඉවත් කරන්නද?",
  confirmEnable: "මෙම සත්‍යාපිත ගිණුම සක්‍රිය කරන්නද? ඊමේල් එවන්නේ හෝ සැසියක් සාදන්නේ නැත.",
  conflict: "මෙම ගිණුම වෙනස් වී ඇත. නැවත උත්සාහ කිරීමට පෙර එය නැවත පූරණය කරන්න.",
  notFound: "එම ගිණුම නොමැත.",
};

const TA: AdminUsersCopy = {
  ...EN,
  title: "பணியாளர் பட்டியல்",
  subtitle: "உங்களுக்கு அனுமதி உள்ள நிறுவனத்தில் பணியாளர் கணக்குகளை நிர்வகிக்கவும்.",
  activationBlocked: "செயல்படுத்தும் அனுப்புதல் இல்லை. சரிபார்க்கப்பட்ட அழைப்பு வழி வரும் வரை புதிய பணியாளர் நிலுவையில் இருப்பர்.",
  forbidden: "பணியாளர் நிர்வாகத்திற்கு உங்களுக்கு அணுகல் இல்லை.",
  unavailable: "பட்டியல் தற்காலிகமாக இல்லை. இணைப்பு திரும்பியதும் மீண்டும் முயலவும்.",
  empty: "இந்த பார்வைக்கு பொருந்தும் பணியாளர் இல்லை.",
  search: "பெயர் அல்லது மின்னஞ்சலை தேடுங்கள்",
  create: "நிலுவை பணியாளரை உருவாக்கு",
  save: "பெயரை சேமி",
  disable: "கணக்கை முடக்கு",
  enable: "கணக்கை இயக்கு",
  confirmDisable: "இந்த கணக்கை முடக்கி அனைத்து அமர்வுகளிலிருந்தும் வெளியேற்றவா?",
  confirmEnable: "இந்த சரிபார்க்கப்பட்ட கணக்கை இயக்கவா? மின்னஞ்சல் அனுப்பப்படாது; அமர்வு உருவாகாது.",
  conflict: "இந்த கணக்கு மாறியுள்ளது. மீண்டும் முயலும் முன் ஏற்றவும்.",
  notFound: "அந்த கணக்கு இல்லை.",
};

export function getAdminUsersCopy(locale: AuthLocale): AdminUsersCopy {
  if (locale === "si") return SI;
  if (locale === "ta") return TA;
  return EN;
}

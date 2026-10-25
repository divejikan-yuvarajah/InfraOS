import type { AuthLocale } from "@/lib/auth/types";

export type AgencyCopy = {
  title: string;
  subtitle: string;
  readOnly: string;
  forbidden: string;
  unavailable: string;
  empty: string;
  search: string;
  create: string;
  save: string;
  reparent: string;
  deactivate: string;
  confirmDeactivate: string;
  conflict: string;
  dependency: string;
  notFound: string;
  nativeReview: string;
};

const EN: AgencyCopy = {
  title: "Agencies",
  subtitle: "Review the agencies you are allowed to see.",
  readOnly: "Only platform administration can change agencies. This view does not apply changes by itself.",
  forbidden: "You do not have access to agency administration.",
  unavailable: "The agency directory is temporarily unavailable. Retry when the connection returns.",
  empty: "No agencies match this view.",
  search: "Search code or name",
  create: "Create agency",
  save: "Save details",
  reparent: "Change parent",
  deactivate: "Deactivate",
  confirmDeactivate: "Deactivate this agency? Active staff, child agencies, projects, or work requests will block this.",
  conflict: "This agency changed or the hierarchy was rejected. Reload it before trying again.",
  dependency: "Deactivation is blocked until dependent records are moved by an approved migration.",
  notFound: "That agency is not available.",
  nativeReview: "Sinhala and Tamil copy is a draft pending native review.",
};

const SI: AgencyCopy = {
  ...EN,
  title: "ආයතන",
  subtitle: "ඔබට බැලීමට අවසර ඇති ආයතන සමාලෝචනය කරන්න.",
  readOnly: "ආයතන වෙනස් කළ හැක්කේ වේදිකා පරිපාලනයට පමණි. මෙම දසුනෙන් වෙනස්කම් යොදන්නේ නැත.",
  forbidden: "ආයතන පරිපාලනයට ඔබට ප්‍රවේශය නැත.",
  unavailable: "ආයතන නාමාවලිය තාවකාලිකව නොමැත. සම්බන්ධතාව නැවත ලැබුණු පසු උත්සාහ කරන්න.",
  empty: "මෙම දසුනට ගැළපෙන ආයතන නැත.",
  search: "කේතය හෝ නම සොයන්න",
  create: "ආයතනයක් සාදන්න",
  save: "විස්තර සුරකින්න",
  reparent: "මව් ආයතනය වෙනස් කරන්න",
  deactivate: "අක්‍රිය කරන්න",
  confirmDeactivate: "මෙම ආයතනය අක්‍රිය කරන්නද? සක්‍රිය කාර්ය මණ්ඩලය, ළමා ආයතන, ව්‍යාපෘති හෝ වැඩ ඉල්ලීම් මෙය වළක්වයි.",
  conflict: "මෙම ආයතනය වෙනස් වී ඇත හෝ ධූරාවලිය ප්‍රතික්ෂේප විය. නැවත උත්සාහ කිරීමට පෙර එය පූරණය කරන්න.",
  dependency: "අනුමත සංක්‍රමණයකින් යැපෙන වාර්තා ගෙන යන තුරු අක්‍රිය කිරීම වළකිනි.",
  notFound: "එම ආයතනය නොමැත.",
};

const TA: AgencyCopy = {
  ...EN,
  title: "நிறுவனங்கள்",
  subtitle: "நீங்கள் காண அனுமதிக்கப்பட்ட நிறுவனங்களை பார்க்கவும்.",
  readOnly: "நிறுவனங்களை மாற்றக்கூடியது தள நிர்வாகம் மட்டும். இந்த பார்வை மாற்றங்களை செயல்படுத்தாது.",
  forbidden: "நிறுவன நிர்வாகத்திற்கு உங்களுக்கு அணுகல் இல்லை.",
  unavailable: "நிறுவன பட்டியல் தற்காலிகமாக இல்லை. இணைப்பு திரும்பியதும் மீண்டும் முயலவும்.",
  empty: "இந்த பார்வைக்கு பொருந்தும் நிறுவனம் இல்லை.",
  search: "குறியீடு அல்லது பெயரை தேடுங்கள்",
  create: "நிறுவனத்தை உருவாக்கு",
  save: "விவரங்களை சேமி",
  reparent: "பெற்றோரை மாற்று",
  deactivate: "முடக்கு",
  confirmDeactivate: "இந்த நிறுவனத்தை முடக்கவா? செயலில் உள்ள பணியாளர், துணை நிறுவனம், திட்டம் அல்லது பணி கோரிக்கை இதை தடுக்கும்.",
  conflict: "இந்த நிறுவனம் மாறியுள்ளது அல்லது அடுக்கு நிராகரிக்கப்பட்டது. மீண்டும் முயலும் முன் ஏற்றவும்.",
  dependency: "அங்கீகரிக்கப்பட்ட இடமாற்றம் வரை முடக்கம் தடுக்கப்பட்டுள்ளது.",
  notFound: "அந்த நிறுவனம் இல்லை.",
};

export function getAgencyCopy(locale: AuthLocale): AgencyCopy {
  if (locale === "si") return SI;
  if (locale === "ta") return TA;
  return EN;
}

import type { AuthLocale } from "@/lib/auth/types";

export type PortalCopy = {
  brandTitle: string;
  brandSubtitle: string;
  navPortal: string;
  navMap: string;
  navReport: string;
  navTrack: string;
  navStaffSignIn: string;
  statsReleased: string;
  statsActive: string;
  statsCompleted: string;
  statsIssues: string;
  directoryTitle: string;
  searchPlaceholder: string;
  allCategories: string;
  allStatuses: string;
  allDistricts: string;
  noProjects: string;
  progressLabel: string;
  budgetBandLabel: string;
  targetEndLabel: string;
  viewDetails: string;
  backToPortal: string;
  mapTitle: string;
  mapSubtitle: string;
  mapListFallback: string;
  reportTitle: string;
  reportSubtitle: string;
  stepCategory: string;
  stepLocation: string;
  stepPhotos: string;
  stepContact: string;
  stepReview: string;
  submitReport: string;
  submitting: string;
  saveSecretWarning: string;
  referenceLabel: string;
  secretLabel: string;
  trackTitle: string;
  trackSubtitle: string;
  trackSubmit: string;
  trackNotFound: string;
  timelineTitle: string;
  updatesTitle: string;
  draftNotice?: string;
};

export const PORTAL_COPY: Record<AuthLocale, PortalCopy> = {
  en: {
    brandTitle: "INFRAOS Public Transparency Portal",
    brandSubtitle: "Public infrastructure works, Sri Lanka corridor map, and anonymous citizen issue reporting.",
    navPortal: "Projects Directory",
    navMap: "Public Map",
    navReport: "Report Issue",
    navTrack: "Track Report",
    navStaffSignIn: "Staff Sign In",
    statsReleased: "Released Projects",
    statsActive: "Active Works",
    statsCompleted: "Completed",
    statsIssues: "Citizen Reports",
    directoryTitle: "Public Infrastructure Directory",
    searchPlaceholder: "Search project title, code, or district…",
    allCategories: "All categories",
    allStatuses: "All statuses",
    allDistricts: "All districts",
    noProjects: "No publicly released projects match your filters yet.",
    progressLabel: "Physical progress",
    budgetBandLabel: "Budget band",
    targetEndLabel: "Target completion",
    viewDetails: "View details",
    backToPortal: "Back to portal",
    mapTitle: "Sri Lanka Public Works & Issues Map",
    mapSubtitle: "Coarsened public locations for released projects and approved citizen issue markers.",
    mapListFallback: "List View Fallback",
    reportTitle: "Report an Infrastructure Issue",
    reportSubtitle: "No account required. Save your one-time tracking secret after submission.",
    stepCategory: "1. Category & Details",
    stepLocation: "2. Location (Sri Lanka)",
    stepPhotos: "3. Photos (max 4 × 5 MB)",
    stepContact: "4. Optional Contact",
    stepReview: "5. Review & Submit",
    submitReport: "Submit Report",
    submitting: "Submitting…",
    saveSecretWarning: "Save this tracking secret now. It will not be shown again.",
    referenceLabel: "Reference Number",
    secretLabel: "Tracking Secret",
    trackTitle: "Track a Citizen Report",
    trackSubtitle: "Enter your reference number and one-time tracking secret.",
    trackSubmit: "Check Status",
    trackNotFound: "Report not found or invalid tracking secret.",
    timelineTitle: "Status History",
    updatesTitle: "Public Updates",
  },
  si: {
    brandTitle: "INFRAOS මහජන විනිවිදභාව ද්වාරය",
    brandSubtitle: "මහජන යටිතල පහසුකම් ව්‍යාපෘති, ශ්‍රී ලංකා සිතියම සහ පුරවැසි ගැටලු වාර්තා කිරීම.",
    navPortal: "ව්‍යාපෘති නාමාවලිය",
    navMap: "මහජන සිතියම",
    navReport: "ගැටලුවක් වාර්තා කරන්න",
    navTrack: "වාර්තාව පරීක්ෂා කරන්න",
    navStaffSignIn: "කාර්ය මණ්ඩල පිවිසුම",
    statsReleased: "ප්‍රකාශිත ව්‍යාපෘති",
    statsActive: "ක්‍රියාත්මක වැඩ",
    statsCompleted: "සම්පූර්ණ කළ",
    statsIssues: "පුරවැසි වාර්තා",
    directoryTitle: "මහජන යටිතල පහසුකම් නාමාවලිය",
    searchPlaceholder: "ව්‍යාපෘති නම, කේතය හෝ දිස්ත්‍රික්කය සොයන්න…",
    allCategories: "සියලුම වර්ග",
    allStatuses: "සියලුම තත්ත්වයන්",
    allDistricts: "සියලුම දිස්ත්‍රික්ක",
    noProjects: "ප්‍රකාශිත ව්‍යාපෘති කිසිවක් හමු නොවීය.",
    progressLabel: "භෞතික ප්‍රගතිය",
    budgetBandLabel: "අයවැය පරාසය",
    targetEndLabel: "ඉලක්කගත අවසානය",
    viewDetails: "විස්තර බලන්න",
    backToPortal: "ද්වාරයට ආපසු",
    mapTitle: "ශ්‍රී ලංකා මහජන වැඩ සහ ගැටලු සිතියම",
    mapSubtitle: "ප්‍රකාශිත ව්‍යාපෘති සහ අනුමත පුරවැසි ගැටලු සඳහා ආසන්න ස්ථාන.",
    mapListFallback: "ලැයිස්තු දසුන",
    reportTitle: "යටිතල පහසුකම් ගැටලුවක් වාර්තා කරන්න",
    reportSubtitle: "ගිණුමක් අවශ්‍ය නොවේ. ඉදිරිපත් කිරීමෙන් පසු ලැබෙන රහස් කේතය සුරකින්න.",
    stepCategory: "1. වර්ගය සහ විස්තර",
    stepLocation: "2. ස්ථානය (ශ්‍රී ලංකාව)",
    stepPhotos: "3. ඡායාරූප (උපරිම 4 × 5 MB)",
    stepContact: "4. විකල්ප සම්බන්ධතා",
    stepReview: "5. සමාලෝචනය සහ ඉදිරිපත් කිරීම",
    submitReport: "වාර්තාව යවන්න",
    submitting: "යවමින් පවතී…",
    saveSecretWarning: "මෙම රහස් කේතය දැන් සුරකින්න. එය නැවත නොපෙන්වයි.",
    referenceLabel: "යොමු අංකය",
    secretLabel: "රහස් කේතය",
    trackTitle: "පුරවැසි වාර්තාවක් පරීක්ෂා කරන්න",
    trackSubtitle: "ඔබගේ යොමු අංකය සහ රහස් කේතය ඇතුළත් කරන්න.",
    trackSubmit: "තත්ත්වය පරීක්ෂා කරන්න",
    trackNotFound: "වාර්තාව හමු නොවීය හෝ රහස් කේතය වැරදිය.",
    timelineTitle: "තත්ත්ව ඉතිහාසය",
    updatesTitle: "මහජන යාවත්කාලීන",
    draftNotice: "unverified-draft",
  },
  ta: {
    brandTitle: "INFRAOS பொது வெளிப்படைத்தன்மை தளம்",
    brandSubtitle: "பொது உட்கட்டமைப்புத் திட்டங்கள், இலங்கை வரைபடம் மற்றும் குடிமக்கள் புகார் அறிக்கை.",
    navPortal: "திட்டங்களின் பட்டியல்",
    navMap: "பொது வரைபடம்",
    navReport: "புகார் அளிக்கவும்",
    navTrack: "புகாரை கண்காணிக்கவும்",
    navStaffSignIn: "பணியாளர் உள்நுழைவு",
    statsReleased: "வெளியிடப்பட்ட திட்டங்கள்",
    statsActive: "நடைபெறும் பணிகள்",
    statsCompleted: "முடிவடைந்தவை",
    statsIssues: "குடிமக்கள் புகார்கள்",
    directoryTitle: "பொது உட்கட்டமைப்புத் திட்டப் பட்டியல்",
    searchPlaceholder: "திட்டத்தின் பெயர், குறியீடு அல்லது மாவட்டத்தைத் தேடுங்கள்…",
    allCategories: "அனைத்து வகைகள்",
    allStatuses: "அனைத்து நிலைகள்",
    allDistricts: "அனைத்து மாவட்டங்கள்",
    noProjects: "பொருந்தும் வெளியிடப்பட்ட திட்டங்கள் எதுவும் இல்லை.",
    progressLabel: "இயற்பியல் முன்னேற்றம்",
    budgetBandLabel: "பட்ஜெட் வரம்பு",
    targetEndLabel: "இலக்கு முடிவு",
    viewDetails: "விவரங்களைப் பார்க்கவும்",
    backToPortal: "தளத்திற்குத் திரும்பு",
    mapTitle: "இலங்கை பொதுப் பணிகள் மற்றும் புகார்கள் வரைபடம்",
    mapSubtitle: "வெளியிடப்பட்ட திட்டங்கள் மற்றும் அங்கீகரிக்கப்பட்ட புகார்களுக்கான தோராய இடங்கள்.",
    mapListFallback: "பட்டியல் காட்சி",
    reportTitle: "உட்கட்டமைப்புப் புகாரை சமர்ப்பிக்கவும்",
    reportSubtitle: "கணக்கு தேவையில்லை. சமர்ப்பித்த பிறகு கிடைக்கும் ரகசிய குறியீட்டைச் சேமிக்கவும்.",
    stepCategory: "1. வகை மற்றும் விவரம்",
    stepLocation: "2. இடம் (இலங்கை)",
    stepPhotos: "3. புகைப்படங்கள் (அதிகபட்சம் 4 × 5 MB)",
    stepContact: "4. விருப்பத் தொடர்பு",
    stepReview: "5. சரிபார்த்து சமர்ப்பிக்கவும்",
    submitReport: "புகாரை சமர்ப்பி",
    submitting: "சமர்ப்பிக்கிறது…",
    saveSecretWarning: "இந்த ரகசிய குறியீட்டை இப்போதே சேமிக்கவும். மீண்டும் காட்டப்படாது.",
    referenceLabel: "குறிப்பு எண்",
    secretLabel: "கண்காணிப்பு ரகசியம்",
    trackTitle: "குடிமக்கள் புகாரை கண்காணிக்கவும்",
    trackSubtitle: "உங்கள் குறிப்பு எண் மற்றும் ரகசிய குறியீட்டை உள்ளிடவும்.",
    trackSubmit: "நிலையைப் பார்க்கவும்",
    trackNotFound: "புகார் கிடைக்கவில்லை அல்லது ரகசிய குறியீடு தவறானது.",
    timelineTitle: "நிலை வரலாறு",
    updatesTitle: "பொது புதுப்பிப்புகள்",
    draftNotice: "unverified-draft",
  },
};

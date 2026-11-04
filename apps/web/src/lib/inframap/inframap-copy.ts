import type { AuthLocale } from "@/lib/auth/types";

/**
 * Steps 81-84 copy. Sinhala and Tamil are drafts pending native review and fall back to English per key.
 * Labels for statuses, work types, priorities and bands are reused from the RoadSync copy, not repeated here.
 */
const EN = {
  title: "InfraMap",
  description: "A map of the projects, planned roadworks and coordination conflicts you are allowed to see.",
  demoNote: "Demo and seed data only. Not official government data.",
  mapLabel: "Map of projects, roadworks and conflicts in view. The same features are listed below the map.",
  layers: { projects: "Projects", roadworks: "Roadworks", conflicts: "Conflicts" },
  layerHelp: {
    projects: "Projects that have a recorded location.",
    roadworks: "Work requests inside your agency's scope.",
    conflicts: "Conflict hotspots that involve your agency.",
  } as Record<string, string>,
  controls: { heading: "Layers", reset: "Sri Lanka view", legend: "Legend", retry: "Retry", show: "Show {layer}", closedNote: "Dimmed circles are closed conflicts." },
  states: {
    loading: "Loading…", count: "{n} in view", countOne: "1 in view", truncated: "First {n} shown. Zoom in to see more.",
    error: "This layer could not be loaded.", forbidden: "Not available to your role.", empty: "Nothing in view.",
    allEmpty: "No features in this view. Pan or zoom, or switch another layer on.", nothingOn: "All layers are switched off.",
    mapFailed: "The map could not be loaded.",
  },
  panel: {
    heading: "Details", none: "Select a feature on the map or from the list.", inView: "In view", inViewEmpty: "Nothing to list yet.", clear: "Clear selection",
    open: { projects: "Open in ProjectTrace", roadworks: "Open in RoadSync", conflicts: "Open conflict" } as Record<string, string>,
    more: "{n} more not listed. Zoom in to narrow the view.",
  },
  fields: {
    code: "Code", type: "Type", status: "Status", agency: "Agency", dates: "Dates", priority: "Priority", band: "Severity", score: "Score",
    resolution: "Resolution", window: "Overlap window", project: "Project", workType: "Work",
  },
  noValue: "Not recorded",
};

export type InframapCopy = typeof EN;
type Patch = { [K in keyof InframapCopy]?: Partial<InframapCopy[K]> };

const SI: Patch = {
  title: "InfraMap", description: "ඔබට බැලීමට අවසර ඇති ව්‍යාපෘති, සැලසුම් කළ මාර්ග වැඩ සහ සම්බන්ධීකරණ ගැටුම් පෙන්වන සිතියමක්.",
  mapLabel: "දසුනේ ඇති ව්‍යාපෘති, මාර්ග වැඩ සහ ගැටුම් සිතියම. එම අංගම සිතියමට පහළින් ලැයිස්තුගත කර ඇත.",
  layers: { projects: "ව්‍යාපෘති", roadworks: "මාර්ග වැඩ", conflicts: "ගැටුම්" },
  controls: { heading: "ස්ථර", reset: "ශ්‍රී ලංකා දසුන", legend: "සටහන", retry: "නැවත උත්සාහ කරන්න", closedNote: "අඳුරු කව වසා දැමූ ගැටුම් වේ." },
  states: { loading: "පූරණය වෙමින්…", count: "දසුනේ {n}", countOne: "දසුනේ 1", error: "මෙම ස්ථරය පූරණය කළ නොහැකි විය.", forbidden: "ඔබේ භූමිකාවට නොමැත.", empty: "දසුනේ කිසිවක් නැත.", allEmpty: "මෙම දසුනේ අංග නැත. ගෙන යන්න හෝ විශාල/කුඩා කරන්න, නැතහොත් තවත් ස්ථරයක් සක්‍රිය කරන්න.", nothingOn: "සියලු ස්ථර අක්‍රියයි.", mapFailed: "සිතියම පූරණය කළ නොහැකි විය." },
  panel: { heading: "විස්තර", none: "සිතියමෙන් හෝ ලැයිස්තුවෙන් අංගයක් තෝරන්න.", inView: "දසුනේ ඇති", clear: "තේරීම ඉවත් කරන්න", open: { projects: "ProjectTrace හි විවෘත කරන්න", roadworks: "RoadSync හි විවෘත කරන්න", conflicts: "ගැටුම විවෘත කරන්න" } },
  fields: { code: "කේතය", type: "වර්ගය", status: "තත්ත්වය", agency: "ආයතනය", dates: "දිනයන්", priority: "ප්‍රමුඛතාවය", band: "බැරෑරුම්කම", score: "ලකුණු", resolution: "විසඳුම", window: "අතිච්ඡාදන කාලය", project: "ව්‍යාපෘතිය", workType: "වැඩය" },
  noValue: "සටහන් කර නැත",
};

const TA: Patch = {
  title: "InfraMap", description: "நீங்கள் பார்க்க அனுமதிக்கப்பட்ட திட்டங்கள், திட்டமிட்ட சாலைப் பணிகள் மற்றும் ஒருங்கிணைப்பு முரண்பாடுகளின் வரைபடம்.",
  mapLabel: "பார்வையில் உள்ள திட்டங்கள், சாலைப் பணிகள் மற்றும் முரண்பாடுகளின் வரைபடம். அதே அம்சங்கள் வரைபடத்திற்குக் கீழே பட்டியலிடப்பட்டுள்ளன.",
  layers: { projects: "திட்டங்கள்", roadworks: "சாலைப் பணிகள்", conflicts: "முரண்பாடுகள்" },
  controls: { heading: "அடுக்குகள்", reset: "இலங்கைக் காட்சி", legend: "விளக்கம்", retry: "மீண்டும் முயல்க", closedNote: "மங்கலான வட்டங்கள் மூடப்பட்ட முரண்பாடுகள்." },
  states: { loading: "ஏற்றப்படுகிறது…", count: "பார்வையில் {n}", countOne: "பார்வையில் 1", error: "இந்த அடுக்கை ஏற்ற இயலவில்லை.", forbidden: "உங்கள் பங்குக்குக் கிடைக்காது.", empty: "பார்வையில் எதுவும் இல்லை.", allEmpty: "இந்தப் பார்வையில் அம்சங்கள் இல்லை. நகர்த்தவும் அல்லது அளவை மாற்றவும், அல்லது வேறு அடுக்கை இயக்கவும்.", nothingOn: "அனைத்து அடுக்குகளும் அணைக்கப்பட்டுள்ளன.", mapFailed: "வரைபடத்தை ஏற்ற இயலவில்லை." },
  panel: { heading: "விவரங்கள்", none: "வரைபடத்திலோ பட்டியலிலோ ஓர் அம்சத்தைத் தேர்ந்தெடுக்கவும்.", inView: "பார்வையில்", clear: "தேர்வை நீக்கு", open: { projects: "ProjectTrace இல் திற", roadworks: "RoadSync இல் திற", conflicts: "முரண்பாட்டைத் திற" } },
  fields: { code: "குறியீடு", type: "வகை", status: "நிலை", agency: "நிறுவனம்", dates: "தேதிகள்", priority: "முன்னுரிமை", band: "தீவிரம்", score: "மதிப்பெண்", resolution: "தீர்வு", window: "மேற்பொருந்தும் காலம்", project: "திட்டம்", workType: "பணி" },
  noValue: "பதிவு செய்யப்படவில்லை",
};

function merge(patch: Patch): InframapCopy {
  const out: Record<string, unknown> = { ...EN };
  for (const [key, value] of Object.entries(patch)) {
    const base = (EN as Record<string, unknown>)[key];
    out[key] = value && typeof value === "object" && base && typeof base === "object" ? { ...(base as object), ...value } : value;
  }
  return out as InframapCopy;
}

const COPY: Record<AuthLocale, InframapCopy> = { en: EN, si: merge(SI), ta: merge(TA) };
export const getInframapCopy = (locale: AuthLocale): InframapCopy => COPY[locale] ?? EN;

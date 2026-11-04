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
    resolution: "Resolution", window: "Overlap window", project: "Project", workType: "Work", district: "District",
  },
  toolbar: { refresh: "Refresh", updated: "Updated {time}", notYet: "Not loaded yet", fullscreen: "Full screen", exitFullscreen: "Exit full screen", showPanel: "Layers and search", hidePanel: "Hide panel" },
  search: { label: "Search the map", placeholder: "Search loaded projects, roadworks, conflicts", none: "No loaded feature matches \"{q}\".", hint: "Searches only what is loaded in the current view." },
  filters: { heading: "Filters", reset: "Reset filters", clearFilters: "Clear filters", group: "Filters for {layer}" },
  projectStatus: { ACTIVE: "Active", APPROVED: "Approved", DELAYED: "Delayed", ON_HOLD: "On hold", COMPLETED: "Completed" } as Record<string, string>,
  values: { overdue: "Overdue", open: "Open", closed: "Closed", point: "Point work", closedMarker: "Closed conflict" } as Record<string, string>,
  more: {
    locked: "You don't have access to this layer", unavailable: "This layer is temporarily unavailable.", emptyLayer: "No {layer} match the current view or filters.",
    tilesFailed: "Basemap tiles are unavailable — data layers still work.", truncatedBar: "Showing first {n} {layer} — zoom in or filter to see more.",
    noLocation: "{n} projects have no map location", noLocationOne: "1 project has no map location", noLocationTitle: "Projects without a map location",
    noLocationHelp: "These are not drawn. Open one to add a location in ProjectTrace.", moreNotShown: "{n} more not listed.", zoom: "Zoom", cursor: "Cursor", chooser: "Several features here",
    chooserHelp: "Pick one to select it.", announce: "Selected {title}", cleared: "Selection cleared", close: "Close", layersLegendNote: "Overdue is derived from the planned end date; it is not a stored status.",
    firstError: "Could not load {layer}.",
  },
  conflict: {
    parties: "Conflicting works", sideA: "Side A", sideB: "Side B", overlaps: "Overlaps {range}", agencies: "Agencies affected", noGeometry: "Detailed geometry isn't available for this record.",
    loadingEvidence: "Loading the conflicting works…", evidenceError: "The conflicting works could not be loaded.", closedNote: "This record is closed. Open it in RoadSync to read its history.",
    openNote: "Details follow RoadSync's visibility rules: other agencies' items may be masked.", history: "Read-only history",
  },
  roadwork: { overdue: "Overdue", overdueNote: "Planned end has passed and the work is not completed or cancelled.", onTime: "Not overdue" },
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
  fields: { code: "කේතය", type: "වර්ගය", status: "තත්ත්වය", agency: "ආයතනය", dates: "දිනයන්", priority: "ප්‍රමුඛතාවය", band: "බැරෑරුම්කම", score: "ලකුණු", resolution: "විසඳුම", window: "අතිච්ඡාදන කාලය", project: "ව්‍යාපෘතිය", workType: "වැඩය", district: "දිස්ත්‍රික්කය" },
  toolbar: { refresh: "නැවුම් කරන්න", updated: "යාවත්කාලීන {time}", notYet: "තවම පූරණය වී නැත", fullscreen: "සම්පූර්ණ තිරය", exitFullscreen: "සම්පූර්ණ තිරයෙන් ඉවත් වන්න", showPanel: "ස්ථර සහ සෙවීම", hidePanel: "පුවරුව සඟවන්න" },
  search: { label: "සිතියම සොයන්න", placeholder: "පූරණය වූ ව්‍යාපෘති, මාර්ග වැඩ, ගැටුම් සොයන්න", none: "\"{q}\" ට ගැළපෙන අංගයක් නැත.", hint: "වත්මන් දසුනේ පූරණය වූ දේ පමණක් සොයයි." },
  filters: { heading: "පෙරහන්", reset: "පෙරහන් යළි සකසන්න", clearFilters: "පෙරහන් ඉවත් කරන්න", group: "{layer} සඳහා පෙරහන්" },
  projectStatus: { ACTIVE: "සක්‍රිය", APPROVED: "අනුමත", DELAYED: "ප්‍රමාද", ON_HOLD: "රඳවා ඇත", COMPLETED: "සම්පූර්ණයි" },
  values: { overdue: "කල් ඉකුත්", open: "විවෘත", closed: "වසා ඇත", point: "ලක්ෂ්‍ය වැඩ", closedMarker: "වසා දැමූ ගැටුම" },
  more: {
    locked: "ඔබට මෙම ස්ථරයට ප්‍රවේශය නැත", unavailable: "මෙම ස්ථරය තාවකාලිකව නොමැත.", emptyLayer: "වත්මන් දසුනට හෝ පෙරහන්වලට ගැළපෙන {layer} නැත.",
    tilesFailed: "සිතියම් පසුබිම නොමැත — දත්ත ස්ථර තවමත් ක්‍රියා කරයි.", truncatedBar: "පළමු {n} {layer} පෙන්වයි — තව බැලීමට විශාලනය කරන්න හෝ පෙරන්න.",
    noLocation: "ව්‍යාපෘති {n} කට සිතියම් ස්ථානයක් නැත", noLocationOne: "ව්‍යාපෘතියක් 1 කට සිතියම් ස්ථානයක් නැත", noLocationTitle: "සිතියම් ස්ථානයක් නැති ව්‍යාපෘති",
    noLocationHelp: "මේවා සිතියමේ ඇඳෙන්නේ නැත. ස්ථානයක් එක් කිරීමට ProjectTrace හි විවෘත කරන්න.", moreNotShown: "තවත් {n} ලැයිස්තුගත කර නැත.", zoom: "විශාලනය", cursor: "කර්සරය", chooser: "මෙහි අංග කිහිපයක් ඇත",
    chooserHelp: "තේරීමට එකක් තෝරන්න.", announce: "{title} තෝරා ඇත", cleared: "තේරීම ඉවත් කර ඇත", close: "වසන්න", layersLegendNote: "කල් ඉකුත්වීම සැලසුම් කළ අවසන් දිනයෙන් ගණනය කෙරේ; එය ගබඩා කළ තත්ත්වයක් නොවේ.",
    firstError: "{layer} පූරණය කළ නොහැකි විය.",
  },
  conflict: {
    parties: "ගැටෙන වැඩ", sideA: "A පාර්ශ්වය", sideB: "B පාර්ශ්වය", overlaps: "{range} අතිච්ඡාදනය වේ", agencies: "බලපෑමට ලක් වූ ආයතන", noGeometry: "මෙම වාර්තාව සඳහා සවිස්තර ජ්‍යාමිතිය නොමැත.",
    loadingEvidence: "ගැටෙන වැඩ පූරණය වෙමින්…", evidenceError: "ගැටෙන වැඩ පූරණය කළ නොහැකි විය.", closedNote: "මෙම වාර්තාව වසා ඇත. ඉතිහාසය කියවීමට RoadSync හි විවෘත කරන්න.",
    openNote: "විස්තර RoadSync හි දෘශ්‍යතා රීති අනුගමනය කරයි: වෙනත් ආයතනවල අයිතම සැඟවිය හැක.", history: "කියවීමට පමණක් ඉතිහාසය",
  },
  roadwork: { overdue: "කල් ඉකුත්", overdueNote: "සැලසුම් කළ අවසන් දිනය ඉක්මවා ඇති අතර වැඩය සම්පූර්ණ කර හෝ අවලංගු කර නැත.", onTime: "කල් ඉකුත් නොවේ" },
  noValue: "සටහන් කර නැත",
};

const TA: Patch = {
  title: "InfraMap", description: "நீங்கள் பார்க்க அனுமதிக்கப்பட்ட திட்டங்கள், திட்டமிட்ட சாலைப் பணிகள் மற்றும் ஒருங்கிணைப்பு முரண்பாடுகளின் வரைபடம்.",
  mapLabel: "பார்வையில் உள்ள திட்டங்கள், சாலைப் பணிகள் மற்றும் முரண்பாடுகளின் வரைபடம். அதே அம்சங்கள் வரைபடத்திற்குக் கீழே பட்டியலிடப்பட்டுள்ளன.",
  layers: { projects: "திட்டங்கள்", roadworks: "சாலைப் பணிகள்", conflicts: "முரண்பாடுகள்" },
  controls: { heading: "அடுக்குகள்", reset: "இலங்கைக் காட்சி", legend: "விளக்கம்", retry: "மீண்டும் முயல்க", closedNote: "மங்கலான வட்டங்கள் மூடப்பட்ட முரண்பாடுகள்." },
  states: { loading: "ஏற்றப்படுகிறது…", count: "பார்வையில் {n}", countOne: "பார்வையில் 1", error: "இந்த அடுக்கை ஏற்ற இயலவில்லை.", forbidden: "உங்கள் பங்குக்குக் கிடைக்காது.", empty: "பார்வையில் எதுவும் இல்லை.", allEmpty: "இந்தப் பார்வையில் அம்சங்கள் இல்லை. நகர்த்தவும் அல்லது அளவை மாற்றவும், அல்லது வேறு அடுக்கை இயக்கவும்.", nothingOn: "அனைத்து அடுக்குகளும் அணைக்கப்பட்டுள்ளன.", mapFailed: "வரைபடத்தை ஏற்ற இயலவில்லை." },
  panel: { heading: "விவரங்கள்", none: "வரைபடத்திலோ பட்டியலிலோ ஓர் அம்சத்தைத் தேர்ந்தெடுக்கவும்.", inView: "பார்வையில்", clear: "தேர்வை நீக்கு", open: { projects: "ProjectTrace இல் திற", roadworks: "RoadSync இல் திற", conflicts: "முரண்பாட்டைத் திற" } },
  fields: { code: "குறியீடு", type: "வகை", status: "நிலை", agency: "நிறுவனம்", dates: "தேதிகள்", priority: "முன்னுரிமை", band: "தீவிரம்", score: "மதிப்பெண்", resolution: "தீர்வு", window: "மேற்பொருந்தும் காலம்", project: "திட்டம்", workType: "பணி", district: "மாவட்டம்" },
  toolbar: { refresh: "புதுப்பி", updated: "புதுப்பிப்பு {time}", notYet: "இன்னும் ஏற்றப்படவில்லை", fullscreen: "முழுத்திரை", exitFullscreen: "முழுத்திரையிலிருந்து வெளியேறு", showPanel: "அடுக்குகளும் தேடலும்", hidePanel: "பலகத்தை மறை" },
  search: { label: "வரைபடத்தில் தேடு", placeholder: "ஏற்றப்பட்ட திட்டங்கள், சாலைப் பணிகள், முரண்பாடுகளைத் தேடு", none: "\"{q}\" க்குப் பொருந்தும் அம்சம் இல்லை.", hint: "தற்போதைய பார்வையில் ஏற்றப்பட்டவற்றை மட்டுமே தேடும்." },
  filters: { heading: "வடிகட்டிகள்", reset: "வடிகட்டிகளை மீட்டமை", clearFilters: "வடிகட்டிகளை நீக்கு", group: "{layer} க்கான வடிகட்டிகள்" },
  projectStatus: { ACTIVE: "செயலில்", APPROVED: "அங்கீகரிக்கப்பட்டது", DELAYED: "தாமதம்", ON_HOLD: "நிறுத்தி வைப்பு", COMPLETED: "முடிந்தது" },
  values: { overdue: "காலக்கெடு கடந்தது", open: "திறந்தவை", closed: "மூடப்பட்டவை", point: "புள்ளிப் பணி", closedMarker: "மூடப்பட்ட முரண்பாடு" },
  more: {
    locked: "இந்த அடுக்கை அணுக உங்களுக்கு அனுமதி இல்லை", unavailable: "இந்த அடுக்கு தற்காலிகமாகக் கிடைக்கவில்லை.", emptyLayer: "தற்போதைய பார்வை அல்லது வடிகட்டிகளுக்குப் பொருந்தும் {layer} இல்லை.",
    tilesFailed: "வரைபடப் பின்னணி கிடைக்கவில்லை — தரவு அடுக்குகள் தொடர்ந்து செயல்படும்.", truncatedBar: "முதல் {n} {layer} காட்டப்படுகிறது — மேலும் காண பெரிதாக்கவும் அல்லது வடிகட்டவும்.",
    noLocation: "{n} திட்டங்களுக்கு வரைபட இடம் இல்லை", noLocationOne: "1 திட்டத்திற்கு வரைபட இடம் இல்லை", noLocationTitle: "வரைபட இடம் இல்லாத திட்டங்கள்",
    noLocationHelp: "இவை வரையப்படாது. இடத்தைச் சேர்க்க ProjectTrace இல் திறக்கவும்.", moreNotShown: "மேலும் {n} பட்டியலிடப்படவில்லை.", zoom: "பெரிதாக்கம்", cursor: "சுட்டி", chooser: "இங்கே பல அம்சங்கள் உள்ளன",
    chooserHelp: "தேர்ந்தெடுக்க ஒன்றைத் தேர்வு செய்யவும்.", announce: "{title} தேர்ந்தெடுக்கப்பட்டது", cleared: "தேர்வு நீக்கப்பட்டது", close: "மூடு", layersLegendNote: "காலக்கெடு கடந்தது என்பது திட்டமிட்ட முடிவுத் தேதியிலிருந்து கணக்கிடப்படுகிறது; அது சேமிக்கப்பட்ட நிலை அல்ல.",
    firstError: "{layer} ஐ ஏற்ற இயலவில்லை.",
  },
  conflict: {
    parties: "முரண்படும் பணிகள்", sideA: "தரப்பு A", sideB: "தரப்பு B", overlaps: "{range} மேற்பொருந்தும்", agencies: "பாதிக்கப்பட்ட நிறுவனங்கள்", noGeometry: "இந்தப் பதிவுக்கு விரிவான வடிவியல் கிடைக்கவில்லை.",
    loadingEvidence: "முரண்படும் பணிகள் ஏற்றப்படுகின்றன…", evidenceError: "முரண்படும் பணிகளை ஏற்ற இயலவில்லை.", closedNote: "இந்தப் பதிவு மூடப்பட்டது. வரலாற்றைப் படிக்க RoadSync இல் திறக்கவும்.",
    openNote: "விவரங்கள் RoadSync இன் தெரிவுநிலை விதிகளைப் பின்பற்றும்: பிற நிறுவனங்களின் உருப்படிகள் மறைக்கப்படலாம்.", history: "படிக்க-மட்டும் வரலாறு",
  },
  roadwork: { overdue: "காலக்கெடு கடந்தது", overdueNote: "திட்டமிட்ட முடிவு தேதி கடந்துவிட்டது; பணி முடிக்கப்படவில்லை அல்லது ரத்து செய்யப்படவில்லை.", onTime: "காலக்கெடு கடக்கவில்லை" },
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

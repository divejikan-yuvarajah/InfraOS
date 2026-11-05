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
  layers: { projects: "Projects", roadworks: "Roadworks", conflicts: "Conflicts", assets: "Assets", utilities: "Utilities", risks: "Risk" },
  layerHelp: {
    projects: "Projects that have a recorded location.",
    roadworks: "Work requests inside your agency's scope.",
    conflicts: "Conflict hotspots that involve your agency.",
    assets: "Roads, bridges, buildings and facilities with a recorded location.",
    utilities: "Water, drainage, electricity and telecom records. Sensitive by default.",
    risks: "Recorded hazard zones and the latest project risk assessment.",
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
    open: { projects: "Open in ProjectTrace", roadworks: "Open in RoadSync", conflicts: "Open conflict", risks: "Open project in ProjectTrace" } as Record<string, string>,
    more: "{n} more not listed. Zoom in to narrow the view.",
  },
  fields: {
    code: "Code", type: "Type", status: "Status", agency: "Agency", dates: "Dates", priority: "Priority", band: "Severity", score: "Score",
    resolution: "Resolution", window: "Overlap window", project: "Project", workType: "Work", district: "District", condition: "Condition", utilityClass: "Class", tier: "Detail level",
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
  groups: { operations: "Operations", infrastructure: "Infrastructure", risk: "Risk & context" },
  deck: {
    groupOn: "Show all in {group}", focus: "Focus", exitFocus: "Exit focus", focusActive: "Focusing on {layer}. Other layers are dimmed.", focusEnded: "Focus ended",
    restrictedHidden: "{n} restricted features are hidden for your role", attention: "Needs attention", attentionCount: "{n} need attention",
    conditionBar: "Loaded assets by condition. Select a segment to filter.", loadingLayer: "Loading {layer}…", empty: "Nothing recorded in this view",
  },
  provenance: { LIVE: "Live InfraOS record", OFFICIAL_PUBLIC: "Official dataset", AGENCY_SUPPLIED: "Agency supplied", DEMO: "DEMO data" } as Record<string, string>,
  demo: { ribbon: "DEMO DATA — not official government data" },
  reasons: { CONDITION_POOR: "Condition is poor", CONDITION_CRITICAL: "Condition is critical", MAINTENANCE_OVERDUE: "Planned maintenance date has passed", INSPECTION_STALE: "No inspection in the last 12 months" } as Record<string, string>,
  tier: { awareness: "More detail is visible to the owning agency.", restricted: "Restricted utility record" },
  tabs: { overview: "Overview", exposure: "Exposure", nearby: "Nearby", source: "Source" },
  exposure: {
    heading: "Exposure check", note: "Spatial overlap with recorded hazard data — not a prediction.", none: "No overlap with the hazard data currently loaded.",
    intersects: "Intersects {n} hazard zones · worst: {level}", intersectsOne: "Intersects 1 hazard zone · worst: {level}", unavailable: "The exposure check is not available for your role.",
    loading: "Checking recorded hazard zones…", error: "The exposure check could not be loaded.", exposedRecords: "Exposed records",
    projects: "Projects", roadworks: "Roadworks", assets: "Assets", utilities: "Utilities", empty: "None of the records you can see overlap this zone.",
    highlight: "Highlight exposed", highlightOff: "Clear highlight", more: "{n} more not listed", hiddenNote: "{n} restricted utility features overlap this zone but are hidden for your role.",
    source: "Source: {org} · {dataset}", dataDate: "Data date {date}", zoneLine: "{name} · {level} · {type}",
  },
  nearby: {
    open: "Show what's nearby", heading: "Nearby context", radius: "Radius", metres: "{m} m",
    banner: "Informational proximity lookup. Official coordination conflicts are managed in RoadSync.", approx: "Approximate, envelope-based. No distances are shown.",
    none: "Nothing recorded within {m} m.", hidden: "{n} restricted features nearby are hidden for your role.", openRoadsync: "Open in RoadSync",
    back: "Back to {title}", loading: "Looking up nearby records…", error: "The nearby lookup could not be loaded.", close: "Close lens", noAccess: "None of the nearby layers are available to your role.",
  },
  detail: {
    health: "Health", timeline: "Maintenance timeline", lastInspection: "Last inspection", today: "Today", nextMaintenance: "Next maintenance", overdue: "Overdue",
    recent: "Recent maintenance", noMaintenance: "No maintenance recorded.", reasons: "Why it needs attention", source: "About this data", organisation: "Organisation", dataset: "Dataset",
    licence: "Licence", dataDate: "Data date", retrieved: "Retrieved", url: "Source link", topFactors: "Top risk factors", assessed: "Assessed {date}", model: "Model {v}",
    level: "Level", hazardType: "Hazard type", riskBand: "Risk band", overall: "Overall risk", loading: "Loading details…", pending: "Loading the selected feature…",
  },
  values2: {
    ROAD: "Road", BRIDGE: "Bridge", BUILDING: "Building", PUBLIC_FACILITY: "Public facility", OTHER: "Other", EXCELLENT: "Excellent", GOOD: "Good", FAIR: "Fair", POOR: "Poor", CRITICAL: "Critical", UNKNOWN: "Unknown",
    WATER: "Water", DRAINAGE: "Drainage", ELECTRICITY: "Electricity", TELECOM: "Telecom", water: "Water (solid)", drainage: "Drainage (dashed)", electricity: "Electricity (dash-dot)", telecom: "Telecom (dotted)", facility: "Facility point",
    FLOOD: "Flood", LANDSLIDE: "Landslide", COASTAL: "Coastal", INFRASTRUCTURE_DAMAGE: "Infrastructure damage", LOW: "Low", MEDIUM: "Medium", HIGH: "High", VERY_HIGH: "Very high",
    hazard: "Hazard zones", project: "Project risk", flood: "Flood outline (solid)", landslide: "Landslide outline (dashed)", other: "Other outline (dotted)",
    "level:LOW": "Low level (dots)", "level:MEDIUM": "Medium level (diagonal)", "level:HIGH": "High level (dense diagonal)", "level:VERY_HIGH": "Very high level (cross-hatch)",
    "band:LOW": "Project risk low (L)", "band:MEDIUM": "Project risk medium (M)", "band:HIGH": "Project risk high (H)",
    "cond:FAIR": "Fair (half ring)", "cond:POOR": "Poor (dashed ring, !)", "cond:CRITICAL": "Critical (double ring, !)", "cond:UNKNOWN": "Unknown (hollow, ?)",
  } as Record<string, string>,
  noValue: "Not recorded",
};

export type InframapCopy = typeof EN;
type Patch = { [K in keyof InframapCopy]?: Partial<InframapCopy[K]> };

const SI: Patch = {
  title: "InfraMap", description: "ඔබට බැලීමට අවසර ඇති ව්‍යාපෘති, සැලසුම් කළ මාර්ග වැඩ සහ සම්බන්ධීකරණ ගැටුම් පෙන්වන සිතියමක්.",
  mapLabel: "දසුනේ ඇති ව්‍යාපෘති, මාර්ග වැඩ සහ ගැටුම් සිතියම. එම අංගම සිතියමට පහළින් ලැයිස්තුගත කර ඇත.",
  layers: { projects: "ව්‍යාපෘති", roadworks: "මාර්ග වැඩ", conflicts: "ගැටුම්", assets: "වත්කම්", utilities: "උපයෝගිතා", risks: "අවදානම" },
  controls: { heading: "ස්ථර", reset: "ශ්‍රී ලංකා දසුන", legend: "සටහන", retry: "නැවත උත්සාහ කරන්න", closedNote: "අඳුරු කව වසා දැමූ ගැටුම් වේ." },
  states: { loading: "පූරණය වෙමින්…", count: "දසුනේ {n}", countOne: "දසුනේ 1", error: "මෙම ස්ථරය පූරණය කළ නොහැකි විය.", forbidden: "ඔබේ භූමිකාවට නොමැත.", empty: "දසුනේ කිසිවක් නැත.", allEmpty: "මෙම දසුනේ අංග නැත. ගෙන යන්න හෝ විශාල/කුඩා කරන්න, නැතහොත් තවත් ස්ථරයක් සක්‍රිය කරන්න.", nothingOn: "සියලු ස්ථර අක්‍රියයි.", mapFailed: "සිතියම පූරණය කළ නොහැකි විය." },
  panel: { heading: "විස්තර", none: "සිතියමෙන් හෝ ලැයිස්තුවෙන් අංගයක් තෝරන්න.", inView: "දසුනේ ඇති", clear: "තේරීම ඉවත් කරන්න", open: { projects: "ProjectTrace හි විවෘත කරන්න", roadworks: "RoadSync හි විවෘත කරන්න", conflicts: "ගැටුම විවෘත කරන්න", risks: "ProjectTrace හි ව්‍යාපෘතිය විවෘත කරන්න" } },
  fields: { code: "කේතය", type: "වර්ගය", status: "තත්ත්වය", agency: "ආයතනය", dates: "දිනයන්", priority: "ප්‍රමුඛතාවය", band: "බැරෑරුම්කම", score: "ලකුණු", resolution: "විසඳුම", window: "අතිච්ඡාදන කාලය", project: "ව්‍යාපෘතිය", workType: "වැඩය", district: "දිස්ත්‍රික්කය", condition: "තත්ත්වය", utilityClass: "පන්තිය", tier: "විස්තර මට්ටම" },
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
  groups: { operations: "මෙහෙයුම්", infrastructure: "යටිතල පහසුකම්", risk: "අවදානම් සහ සන්දර්භය" },
  deck: {
    groupOn: "{group} සියල්ල පෙන්වන්න", focus: "අවධානය", exitFocus: "අවධානයෙන් ඉවත් වන්න", focusActive: "{layer} කෙරෙහි අවධානය. අනෙක් ස්ථර අඳුරු කර ඇත.", focusEnded: "අවධානය අවසන්",
    restrictedHidden: "ඔබේ භූමිකාවට සීමිත අංග {n} ක් සඟවා ඇත", attention: "අවධානය අවශ්‍යයි", attentionCount: "{n} කට අවධානය අවශ්‍යයි",
    conditionBar: "පූරණය වූ වත්කම් තත්ත්වය අනුව. පෙරීමට කොටසක් තෝරන්න.", loadingLayer: "{layer} පූරණය වෙමින්…", empty: "මෙම දසුනේ කිසිවක් සටහන් වී නැත",
  },
  provenance: { LIVE: "සජීවී InfraOS වාර්තාව", OFFICIAL_PUBLIC: "නිල දත්ත කට්ටලය", AGENCY_SUPPLIED: "ආයතනය සපයා ඇත", DEMO: "ආදර්ශන දත්ත" },
  demo: { ribbon: "ආදර්ශන දත්ත — නිල රජයේ දත්ත නොවේ" },
  reasons: { CONDITION_POOR: "තත්ත්වය දුර්වලයි", CONDITION_CRITICAL: "තත්ත්වය අතිශය නරකයි", MAINTENANCE_OVERDUE: "සැලසුම් කළ නඩත්තු දිනය ඉක්මවා ඇත", INSPECTION_STALE: "මාස 12ක් තුළ පරීක්ෂාවක් නැත" },
  tier: { awareness: "වැඩි විස්තර හිමි ආයතනයට පෙනේ.", restricted: "සීමිත උපයෝගිතා වාර්තාව" },
  tabs: { overview: "දළ විශ්ලේෂණය", exposure: "නිරාවරණය", nearby: "ආසන්නයේ", source: "ප්‍රභවය" },
  exposure: {
    heading: "නිරාවරණ පරීක්ෂාව", note: "සටහන් වූ අවදානම් දත්ත සමඟ අවකාශීය අතිච්ඡාදනය — අනාවැකියක් නොවේ.", none: "දැනට පූරණය වූ අවදානම් දත්ත සමඟ අතිච්ඡාදනයක් නැත.",
    intersects: "අවදානම් කලාප {n} ක් හරහා යයි · නරකම: {level}", intersectsOne: "අවදානම් කලාප 1 ක් හරහා යයි · නරකම: {level}", unavailable: "ඔබේ භූමිකාවට නිරාවරණ පරීක්ෂාව නොමැත.",
    loading: "සටහන් වූ අවදානම් කලාප පරීක්ෂා කරමින්…", error: "නිරාවරණ පරීක්ෂාව පූරණය කළ නොහැකි විය.", exposedRecords: "නිරාවරණය වූ වාර්තා",
    projects: "ව්‍යාපෘති", roadworks: "මාර්ග වැඩ", assets: "වත්කම්", utilities: "උපයෝගිතා", empty: "ඔබට පෙනෙන වාර්තා කිසිවක් මෙම කලාපය සමඟ අතිච්ඡාදනය නොවේ.",
    highlight: "නිරාවරණය වූ දේ උද්දීපනය", highlightOff: "උද්දීපනය ඉවත් කරන්න", more: "තවත් {n} ලැයිස්තුගත කර නැත", hiddenNote: "සීමිත උපයෝගිතා අංග {n} ක් මෙම කලාපය සමඟ අතිච්ඡාදනය වන නමුත් ඔබේ භූමිකාවට සඟවා ඇත.",
    source: "ප්‍රභවය: {org} · {dataset}", dataDate: "දත්ත දිනය {date}", zoneLine: "{name} · {level} · {type}",
  },
  nearby: {
    open: "ආසන්නයේ ඇති දේ පෙන්වන්න", heading: "ආසන්න සන්දර්භය", radius: "අරය", metres: "මීටර් {m}",
    banner: "තොරතුරු සඳහා ආසන්න සෙවුමකි. නිල සම්බන්ධීකරණ ගැටුම් කළමනාකරණය කරන්නේ RoadSync හි ය.", approx: "ආසන්න අගයකි. දුර ප්‍රමාණ පෙන්වන්නේ නැත.",
    none: "මීටර් {m} ක් තුළ කිසිවක් සටහන් වී නැත.", hidden: "ආසන්නයේ සීමිත අංග {n} ක් ඔබේ භූමිකාවට සඟවා ඇත.", openRoadsync: "RoadSync හි විවෘත කරන්න",
    back: "{title} වෙත ආපසු", loading: "ආසන්න වාර්තා සොයමින්…", error: "ආසන්න සෙවුම පූරණය කළ නොහැකි විය.", close: "කාචය වසන්න", noAccess: "ආසන්න ස්ථර කිසිවක් ඔබේ භූමිකාවට නොමැත.",
  },
  detail: {
    health: "සෞඛ්‍යය", timeline: "නඩත්තු කාලරේඛාව", lastInspection: "අවසන් පරීක්ෂාව", today: "අද", nextMaintenance: "ඊළඟ නඩත්තුව", overdue: "කල් ඉකුත්",
    recent: "මෑත නඩත්තු", noMaintenance: "නඩත්තු සටහන් නැත.", reasons: "අවධානය අවශ්‍ය වන්නේ ඇයි", source: "මෙම දත්ත ගැන", organisation: "සංවිධානය", dataset: "දත්ත කට්ටලය",
    licence: "බලපත්‍රය", dataDate: "දත්ත දිනය", retrieved: "ලබාගත් දිනය", url: "ප්‍රභව සබැඳිය", topFactors: "ප්‍රධාන අවදානම් සාධක", assessed: "තක්සේරු කළේ {date}", model: "ආකෘතිය {v}",
    level: "මට්ටම", hazardType: "උපද්‍රව වර්ගය", riskBand: "අවදානම් පරාසය", overall: "සමස්ත අවදානම", loading: "විස්තර පූරණය වෙමින්…", pending: "තෝරාගත් අංගය පූරණය වෙමින්…",
  },
  values2: {
    ROAD: "මාර්ගය", BRIDGE: "පාලම", BUILDING: "ගොඩනැගිල්ල", PUBLIC_FACILITY: "පොදු පහසුකම", OTHER: "වෙනත්", EXCELLENT: "විශිෂ්ට", GOOD: "හොඳ", FAIR: "සාමාන්‍ය", POOR: "දුර්වල", CRITICAL: "අතිශය නරක", UNKNOWN: "නොදනී",
    WATER: "ජලය", DRAINAGE: "ජලාපවහනය", ELECTRICITY: "විදුලිය", TELECOM: "විදුලි සංදේශ", water: "ජලය (අඛණ්ඩ)", drainage: "ජලාපවහනය (කඩ)", electricity: "විදුලිය (කඩ-තිත)", telecom: "විදුලි සංදේශ (තිත්)", facility: "පහසුකම් ලක්ෂ්‍යය",
    FLOOD: "ගංවතුර", LANDSLIDE: "නායයෑම", COASTAL: "වෙරළ", INFRASTRUCTURE_DAMAGE: "යටිතල පහසුකම් හානි", LOW: "අඩු", MEDIUM: "මධ්‍යම", HIGH: "ඉහළ", VERY_HIGH: "ඉතා ඉහළ",
    hazard: "උපද්‍රව කලාප", project: "ව්‍යාපෘති අවදානම", flood: "ගංවතුර මායිම (අඛණ්ඩ)", landslide: "නායයෑම් මායිම (කඩ)", other: "වෙනත් මායිම (තිත්)",
    "level:LOW": "අඩු මට්ටම (තිත්)", "level:MEDIUM": "මධ්‍යම මට්ටම (ඇල)", "level:HIGH": "ඉහළ මට්ටම (ඝන ඇල)", "level:VERY_HIGH": "ඉතා ඉහළ මට්ටම (හරස් ඇල)",
    "band:LOW": "ව්‍යාපෘති අවදානම අඩු (L)", "band:MEDIUM": "ව්‍යාපෘති අවදානම මධ්‍යම (M)", "band:HIGH": "ව්‍යාපෘති අවදානම ඉහළ (H)",
    "cond:FAIR": "සාමාන්‍ය (අර්ධ වළල්ල)", "cond:POOR": "දුර්වල (කඩ වළල්ල, !)", "cond:CRITICAL": "අතිශය නරක (ද්විත්ව වළල්ල, !)", "cond:UNKNOWN": "නොදනී (හිස්, ?)",
  },
  noValue: "සටහන් කර නැත",
};

const TA: Patch = {
  title: "InfraMap", description: "நீங்கள் பார்க்க அனுமதிக்கப்பட்ட திட்டங்கள், திட்டமிட்ட சாலைப் பணிகள் மற்றும் ஒருங்கிணைப்பு முரண்பாடுகளின் வரைபடம்.",
  mapLabel: "பார்வையில் உள்ள திட்டங்கள், சாலைப் பணிகள் மற்றும் முரண்பாடுகளின் வரைபடம். அதே அம்சங்கள் வரைபடத்திற்குக் கீழே பட்டியலிடப்பட்டுள்ளன.",
  layers: { projects: "திட்டங்கள்", roadworks: "சாலைப் பணிகள்", conflicts: "முரண்பாடுகள்", assets: "சொத்துகள்", utilities: "பயன்பாட்டு சேவைகள்", risks: "அபாயம்" },
  controls: { heading: "அடுக்குகள்", reset: "இலங்கைக் காட்சி", legend: "விளக்கம்", retry: "மீண்டும் முயல்க", closedNote: "மங்கலான வட்டங்கள் மூடப்பட்ட முரண்பாடுகள்." },
  states: { loading: "ஏற்றப்படுகிறது…", count: "பார்வையில் {n}", countOne: "பார்வையில் 1", error: "இந்த அடுக்கை ஏற்ற இயலவில்லை.", forbidden: "உங்கள் பங்குக்குக் கிடைக்காது.", empty: "பார்வையில் எதுவும் இல்லை.", allEmpty: "இந்தப் பார்வையில் அம்சங்கள் இல்லை. நகர்த்தவும் அல்லது அளவை மாற்றவும், அல்லது வேறு அடுக்கை இயக்கவும்.", nothingOn: "அனைத்து அடுக்குகளும் அணைக்கப்பட்டுள்ளன.", mapFailed: "வரைபடத்தை ஏற்ற இயலவில்லை." },
  panel: { heading: "விவரங்கள்", none: "வரைபடத்திலோ பட்டியலிலோ ஓர் அம்சத்தைத் தேர்ந்தெடுக்கவும்.", inView: "பார்வையில்", clear: "தேர்வை நீக்கு", open: { projects: "ProjectTrace இல் திற", roadworks: "RoadSync இல் திற", conflicts: "முரண்பாட்டைத் திற", risks: "ProjectTrace இல் திட்டத்தைத் திற" } },
  fields: { code: "குறியீடு", type: "வகை", status: "நிலை", agency: "நிறுவனம்", dates: "தேதிகள்", priority: "முன்னுரிமை", band: "தீவிரம்", score: "மதிப்பெண்", resolution: "தீர்வு", window: "மேற்பொருந்தும் காலம்", project: "திட்டம்", workType: "பணி", district: "மாவட்டம்", condition: "நிலை", utilityClass: "வகுப்பு", tier: "விவர நிலை" },
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
  groups: { operations: "செயல்பாடுகள்", infrastructure: "உள்கட்டமைப்பு", risk: "அபாயமும் சூழலும்" },
  deck: {
    groupOn: "{group} அனைத்தையும் காட்டு", focus: "கவனம்", exitFocus: "கவனத்திலிருந்து வெளியேறு", focusActive: "{layer} மீது கவனம். மற்ற அடுக்குகள் மங்கலாக்கப்பட்டுள்ளன.", focusEnded: "கவனம் முடிந்தது",
    restrictedHidden: "உங்கள் பங்குக்கு {n} கட்டுப்படுத்தப்பட்ட அம்சங்கள் மறைக்கப்பட்டுள்ளன", attention: "கவனம் தேவை", attentionCount: "{n} க்கு கவனம் தேவை",
    conditionBar: "ஏற்றப்பட்ட சொத்துகள் நிலைப்படி. வடிகட்ட ஒரு பகுதியைத் தேர்ந்தெடுக்கவும்.", loadingLayer: "{layer} ஏற்றப்படுகிறது…", empty: "இந்தப் பார்வையில் எதுவும் பதிவாகவில்லை",
  },
  provenance: { LIVE: "நேரடி InfraOS பதிவு", OFFICIAL_PUBLIC: "அதிகாரப்பூர்வ தரவுத்தொகுப்பு", AGENCY_SUPPLIED: "நிறுவனம் வழங்கியது", DEMO: "டெமோ தரவு" },
  demo: { ribbon: "டெமோ தரவு — அதிகாரப்பூர்வ அரசுத் தரவு அல்ல" },
  reasons: { CONDITION_POOR: "நிலை மோசமாக உள்ளது", CONDITION_CRITICAL: "நிலை மிக மோசமாக உள்ளது", MAINTENANCE_OVERDUE: "திட்டமிட்ட பராமரிப்புத் தேதி கடந்துவிட்டது", INSPECTION_STALE: "கடந்த 12 மாதங்களில் ஆய்வு இல்லை" },
  tier: { awareness: "மேலும் விவரங்கள் உரிமையாளர் நிறுவனத்திற்குத் தெரியும்.", restricted: "கட்டுப்படுத்தப்பட்ட பயன்பாட்டுப் பதிவு" },
  tabs: { overview: "கண்ணோட்டம்", exposure: "வெளிப்பாடு", nearby: "அருகில்", source: "மூலம்" },
  exposure: {
    heading: "வெளிப்பாட்டுச் சரிபார்ப்பு", note: "பதிவான அபாயத் தரவுடன் இடஞ்சார்ந்த மேற்பொருந்துதல் — முன்கணிப்பு அல்ல.", none: "தற்போது ஏற்றப்பட்ட அபாயத் தரவுடன் மேற்பொருந்துதல் இல்லை.",
    intersects: "{n} அபாய மண்டலங்களைக் கடக்கிறது · மிக மோசமானது: {level}", intersectsOne: "1 அபாய மண்டலத்தைக் கடக்கிறது · மிக மோசமானது: {level}", unavailable: "உங்கள் பங்குக்கு வெளிப்பாட்டுச் சரிபார்ப்பு கிடைக்காது.",
    loading: "பதிவான அபாய மண்டலங்கள் சரிபார்க்கப்படுகின்றன…", error: "வெளிப்பாட்டுச் சரிபார்ப்பை ஏற்ற இயலவில்லை.", exposedRecords: "வெளிப்பட்ட பதிவுகள்",
    projects: "திட்டங்கள்", roadworks: "சாலைப் பணிகள்", assets: "சொத்துகள்", utilities: "பயன்பாட்டு சேவைகள்", empty: "நீங்கள் காணக்கூடிய பதிவுகள் எதுவும் இந்த மண்டலத்துடன் மேற்பொருந்தவில்லை.",
    highlight: "வெளிப்பட்டவற்றை முன்னிலைப்படுத்து", highlightOff: "முன்னிலையை நீக்கு", more: "மேலும் {n} பட்டியலிடப்படவில்லை", hiddenNote: "{n} கட்டுப்படுத்தப்பட்ட பயன்பாட்டு அம்சங்கள் இந்த மண்டலத்துடன் மேற்பொருந்துகின்றன, ஆனால் உங்கள் பங்குக்கு மறைக்கப்பட்டுள்ளன.",
    source: "மூலம்: {org} · {dataset}", dataDate: "தரவுத் தேதி {date}", zoneLine: "{name} · {level} · {type}",
  },
  nearby: {
    open: "அருகில் உள்ளவற்றைக் காட்டு", heading: "அருகிலுள்ள சூழல்", radius: "ஆரம்", metres: "{m} மீ",
    banner: "தகவலுக்கான அருகாமைத் தேடல். அதிகாரப்பூர்வ ஒருங்கிணைப்பு முரண்பாடுகள் RoadSync இல் நிர்வகிக்கப்படுகின்றன.", approx: "தோராயமானது. தூரங்கள் காட்டப்படுவதில்லை.",
    none: "{m} மீ க்குள் எதுவும் பதிவாகவில்லை.", hidden: "அருகிலுள்ள {n} கட்டுப்படுத்தப்பட்ட அம்சங்கள் உங்கள் பங்குக்கு மறைக்கப்பட்டுள்ளன.", openRoadsync: "RoadSync இல் திற",
    back: "{title} க்குத் திரும்பு", loading: "அருகிலுள்ள பதிவுகள் தேடப்படுகின்றன…", error: "அருகாமைத் தேடலை ஏற்ற இயலவில்லை.", close: "லென்ஸை மூடு", noAccess: "அருகிலுள்ள அடுக்குகள் எதுவும் உங்கள் பங்குக்குக் கிடைக்காது.",
  },
  detail: {
    health: "ஆரோக்கியம்", timeline: "பராமரிப்புக் காலவரிசை", lastInspection: "கடைசி ஆய்வு", today: "இன்று", nextMaintenance: "அடுத்த பராமரிப்பு", overdue: "காலக்கெடு கடந்தது",
    recent: "சமீபத்திய பராமரிப்பு", noMaintenance: "பராமரிப்புப் பதிவுகள் இல்லை.", reasons: "ஏன் கவனம் தேவை", source: "இந்தத் தரவு பற்றி", organisation: "அமைப்பு", dataset: "தரவுத்தொகுப்பு",
    licence: "உரிமம்", dataDate: "தரவுத் தேதி", retrieved: "பெறப்பட்டது", url: "மூல இணைப்பு", topFactors: "முக்கிய அபாயக் காரணிகள்", assessed: "மதிப்பீடு {date}", model: "மாதிரி {v}",
    level: "நிலை", hazardType: "அபாய வகை", riskBand: "அபாய வரம்பு", overall: "ஒட்டுமொத்த அபாயம்", loading: "விவரங்கள் ஏற்றப்படுகின்றன…", pending: "தேர்ந்தெடுத்த அம்சம் ஏற்றப்படுகிறது…",
  },
  values2: {
    ROAD: "சாலை", BRIDGE: "பாலம்", BUILDING: "கட்டிடம்", PUBLIC_FACILITY: "பொது வசதி", OTHER: "மற்றவை", EXCELLENT: "மிகச் சிறந்தது", GOOD: "நல்லது", FAIR: "சராசரி", POOR: "மோசம்", CRITICAL: "மிக மோசம்", UNKNOWN: "தெரியவில்லை",
    WATER: "நீர்", DRAINAGE: "வடிகால்", ELECTRICITY: "மின்சாரம்", TELECOM: "தொலைத்தொடர்பு", water: "நீர் (தொடர்ச்சி)", drainage: "வடிகால் (கோடுகள்)", electricity: "மின்சாரம் (கோடு-புள்ளி)", telecom: "தொலைத்தொடர்பு (புள்ளிகள்)", facility: "வசதிப் புள்ளி",
    FLOOD: "வெள்ளம்", LANDSLIDE: "நிலச்சரிவு", COASTAL: "கடலோரம்", INFRASTRUCTURE_DAMAGE: "உள்கட்டமைப்புச் சேதம்", LOW: "குறைவு", MEDIUM: "நடுத்தரம்", HIGH: "அதிகம்", VERY_HIGH: "மிக அதிகம்",
    hazard: "அபாய மண்டலங்கள்", project: "திட்ட அபாயம்", flood: "வெள்ள எல்லை (தொடர்ச்சி)", landslide: "நிலச்சரிவு எல்லை (கோடுகள்)", other: "பிற எல்லை (புள்ளிகள்)",
    "level:LOW": "குறைந்த நிலை (புள்ளிகள்)", "level:MEDIUM": "நடுத்தர நிலை (சாய்வு)", "level:HIGH": "அதிக நிலை (அடர் சாய்வு)", "level:VERY_HIGH": "மிக அதிக நிலை (குறுக்குக் கோடுகள்)",
    "band:LOW": "திட்ட அபாயம் குறைவு (L)", "band:MEDIUM": "திட்ட அபாயம் நடுத்தரம் (M)", "band:HIGH": "திட்ட அபாயம் அதிகம் (H)",
    "cond:FAIR": "சராசரி (அரை வளையம்)", "cond:POOR": "மோசம் (கோட்டு வளையம், !)", "cond:CRITICAL": "மிக மோசம் (இரட்டை வளையம், !)", "cond:UNKNOWN": "தெரியவில்லை (வெற்று, ?)",
  },
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

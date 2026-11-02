import type { AuthLocale } from "@/lib/auth/types";

import { fmt } from "./assessment";
import type { SlaState, TimeToImpact } from "./conflict-records";

/**
 * Steps 72-73 copy (keys: conflictRecords, agencyRoles, agencyReasons, lifecycle, inbox, notifications).
 * The server sends codes and params only; every sentence is composed here. Sinhala and Tamil are complete
 * drafts pending native review, matching the rest of the workspace.
 */
const EN = {
  nav: "Conflicts",
  title: "Conflict Command Bridge",
  subtitle: "Triage conflicts that involve your agency, acknowledge them and follow every change.",
  demoNote: "Demo and seed data only. Not official government data.",
  exportCsv: "Export CSV",
  views: { inbox: "Inbox", board: "Board", map: "Map" },
  mission: { needsMyAck: "Needs my acknowledgement", overdue: "Overdue", criticalHigh: "Critical & High", soon: "Starting within 14 days", opportunities: "Opportunities" },
  presets: {
    needsMyAck: "Needs my acknowledgement", overdue: "Overdue acknowledgement", criticalHigh: "Critical & High", soon: "Starting within 14 days", opportunities: "Opportunities",
    watching: "Watching", mine: "All involving my agency", unassigned: "Unassigned lead", dismissed: "Dismissed", autoClosed: "Auto-closed", all: "All agencies",
  },
  filters: { title: "Filters", withCount: "Filters ({n})", clear: "Clear all", status: "Status", band: "Severity", classes: "Class", recordType: "Type", internal: "Internal only", search: "Search number, reference or title", close: "Close", presets: "Views" },
  recordType: { conflict: "Conflict", opportunity: "Opportunity" },
  status: { open: "Open", acknowledged: "Acknowledged", awaiting_response: "Awaiting response", negotiating: "Negotiating", escalated: "Escalated", resolved: "Resolved", dismissed: "Dismissed", auto_closed: "Auto-closed", withdrawn: "Withdrawn" } as Record<string, string>,
  belowThreshold: "Severity now below recording threshold",
  internalChip: "Internal",
  roles: { requesting: "Requesting agency", counterpart: "Counterpart agency", asset_owner: "Asset owner", third_party: "Nearby work (informed)" } as Record<string, string>,
  reasons: {
    owns_this_request: "Owns one of the two works in this conflict",
    owns_other_request: "Owns the other work in this conflict",
    owns_asset_in_footprint: "Owns {assetCount} asset(s) in the footprint ({infrastructureType})",
    third_party_work_nearby: "Has work {distanceMeters} m away with overlapping dates",
    manually_added: "Added by National Coordination",
    lead_road_owner: "Suggested lead: owns the road",
    lead_first_submitted: "Suggested lead: first to submit",
    national_set: "Lead set by National Coordination",
  } as Record<string, string>,
  ack: { pending: "Acknowledgement pending", acknowledged: "Acknowledged", excluded: "Excluded", required: "Required", informed: "Informed only", manual: "Added manually", auto: "Detected", onBehalf: "on behalf" },
  sla: { later: "Ack due in {hours} h", laterDays: "Ack due in {days} d", today: "Due today", overdueH: "Overdue {hours} h", overdueD: "Overdue {days} d", none: "No deadline", tooltip: "Due {when} (Asia/Colombo)" },
  ring: { upcoming: "Starts in {days} d", active: "Active · day {day}/{total}", ended: "Ended", none: "No dates", aria: "Time to impact: {text}" },
  lead: { suggested: "Suggested lead: {agency} · {reason}", national: "Lead set by National Coordination: {agency}", none: "No lead", crown: "Lead agency" },
  row: { open: "Open dossier", acknowledge: "Acknowledge", watch: "Watch", unwatch: "Stop watching", select: "Select {no}", unseen: "{n} unseen change(s)", ackProgress: "{done} of {required} required agencies acknowledged", mine: "Mine", vs: "↔", more: "+{n}", noAgencies: "No agency", preview: "Preview" },
  bulk: { acknowledge: "Acknowledge {n}", clear: "Clear", summary: "{ok} acknowledged · {already} already · {failed} could not be done", max: "At most 25 at a time." },
  states: { loading: "Loading conflicts…", emptyTitle: "No conflicts need your attention", emptyBody: "Try another view on the left, or clear filters.", filteredEmpty: "No conflicts match these filters.", error: "Conflicts could not be loaded right now.", retry: "Retry", updated: "Updated just now", stale: "This record changed. It was reloaded.", forbidden: "You are not permitted to do this.", notFound: "This conflict record is not available to you.", failed: "That action could not be completed.", live: "{n} conflicts need your acknowledgement", ackLive: "Conflict {no} acknowledged", capped: "Showing the most recent 1000 matching records.", noPreview: "Select a conflict to preview it." },
  shortcuts: { title: "Keyboard shortcuts", move: "J / K or ↑ / ↓ — move", open: "Enter — open dossier", ack: "A — acknowledge (own agency)", watch: "W — watch", select: "X — select row", help: "? — this help" },
  board: { lane: "{band} · {n}", collapse: "Collapse", expand: "Expand", empty: "Nothing here" },
  map: { aria: "Map of conflict hotspots", open: "Open dossier", unavailable: "The map could not be drawn." },
  dossier: {
    back: "All conflicts", copy: "Copy number", copied: "Copied", watch: "Watch", unwatch: "Watching", acknowledge: "Acknowledge", dismiss: "Dismiss", reopen: "Reopen", setLead: "Set lead", evidence: "Export evidence (GeoJSON)", permalink: "Copy link",
    ackSummary: "{done} of {required} required agencies acknowledged",
    tabs: { overview: "Overview", stakeholders: "Stakeholders", timeline: "Timeline", notes: "Notes", related: "Related", evidence: "Evidence" },
    since: "Since you last looked", sinceEvents: "+{n} events", sinceSeverity: "Severity {from} → {to}", sinceAgencies: "{n} agency added", sinceStatus: "Status {from} → {to}", markSeen: "Mark as seen",
    why: "Why this is a conflict", digOnce: "Dig once", digOnceBody: "About {meters} m of shared trench. Coordinating these works can save one excavation.", yours: "Yours", theirs: "Theirs", partyA: "Party A", partyB: "Party B", schedule: "Schedules", redacted: "Only summary details of other agencies' work are shown.", ruleVersion: "Rule v{version}", floor: "Safety floor {code} applied (minimum {min})",
    overrideNote: "Severity was set by National Coordination.", loading: "Loading dossier…", notFound: "This conflict record is not available to you.", error: "The dossier could not be loaded.", noMap: "No map data.", mapToggle: "Related hotspots", openItem: "Open {ref}", cannotOpen: "You cannot open this item.",
    ackTitle: "Acknowledge this conflict", ackBody: "Acknowledging records that {agency} has seen this conflict. It does not resolve it.", ackNote: "Optional note (kept in the audit trail)", confirm: "Confirm", cancel: "Cancel",
    reasonLabel: "Reason (at least 10 characters)", dismissTitle: "Dismiss this conflict", dismissBody: "It reopens automatically if the severity rises by one band or more.", reopenTitle: "Reopen this conflict", leadTitle: "Set lead agency", addAgency: "Add agency", addAgencyTitle: "Add an agency", chooseAgency: "Agency", exclude: "Exclude", restore: "Restore", excludeTitle: "Exclude this agency", excluded: "Excluded", inactive: "No longer detected",
  },
  lifecycle: { title: "Lifecycle", open: "Open", acknowledged: "Acknowledged", dismissed: "Dismissed", auto_closed: "Auto-closed", current: "Current", changedAt: "{when}" },
  constellation: { title: "Stakeholder Constellation", center: "Conflict", table: "Stakeholders table", agency: "Agency", roles: "Roles", ack: "Acknowledgement", due: "Due", reasons: "Why involved", hint: "Arrow keys move between agencies. Enter opens the card.", orbitParties: "Parties", orbitAssets: "Asset owners", orbitNearby: "Nearby work", close: "Close", ackBy: "{role} · {when}", noAck: "Not acknowledged yet" },
  events: {
    detected: "Detected", agency_added: "Agency added", agency_removed: "Agency removed", agency_excluded: "Agency excluded", agency_restored: "Agency restored", severity_changed: "Severity changed", acknowledged: "Acknowledged", lead_set: "Lead set", dismissed: "Dismissed", reopened: "Reopened", auto_closed: "Auto-closed", redetected: "Detected again", note_added: "Private note added", override_applied: "Severity override",
    actorSystem: "System", actorAgency: "{agency}", detailSeverity: "{from} → {to}", detailAgencies: "{n} agencies",
  } as Record<string, string>,
  timeline: { title: "Activity", sparkline: "Severity history", sparkAria: "Severity history: {text}", noEvents: "No activity yet.", point: "{score} · {band} · rule v{version} · {reason}", reason: { detected: "detected", reassessed: "reassessed", override: "override", override_cleared: "override cleared" } as Record<string, string> },
  notes: { private: "Private to {agency}", placeholder: "Write a private note (plain text, up to 1000 characters)", add: "Add note", delete: "Delete", empty: "No private notes yet.", filter: "Agency", all: "All agencies", failed: "The note could not be saved." },
  related: { title: "Related conflicts", empty: "No related conflicts.", open: "Open" },
  evidence: { title: "At detection vs now", metric: "Metric", atDetection: "At detection", now: "Now", score: "Score", band: "Band", classes: "Classes", ruleVersion: "Rule version", dates: "Dates", agencies: "Affected agencies", factors: "Factors at detection", download: "Download GeoJSON", delta: "Δ {n}" },
  notifications: {
    batch_new: "{count} new conflict(s) involve your agency, highest: {band}",
    escalated: "{conflictNo} escalated to {band}",
    agency_added: "Your agency is now involved in {conflictNo}",
    reopened: "{conflictNo} was reopened",
    auto_closed: "{conflictNo} was closed automatically",
  } as Record<string, string>,
  integrations: { chip: "{status} · {done}/{required} acknowledged", openRecord: "Open conflict record", heroChip: "{total} conflict records · {needs} need acknowledgement", heroChipNone: "{total} conflict records", agenciesTitle: "Agencies you will need to coordinate with", agenciesNote: "These agencies will be notified once you submit.", required: "Required", informed: "Informed", needsAck: "Needs acknowledgement", records: "{n} records" },
};
export type ConflictCopy = typeof EN;

const SI: ConflictCopy = {
  nav: "ගැටුම්",
  title: "ගැටුම් මෙහෙයුම් මධ්‍යස්ථානය",
  subtitle: "ඔබේ ආයතනයට අදාළ ගැටුම් පිළිවෙළට සලකා, පිළිගෙන, සෑම වෙනසක්ම අනුගමනය කරන්න.",
  demoNote: "නිරූපණ සහ බීජ දත්ත පමණි. නිල රජයේ දත්ත නොවේ.",
  exportCsv: "CSV අපනයනය",
  views: { inbox: "එන පෙට්ටිය", board: "පුවරුව", map: "සිතියම" },
  mission: { needsMyAck: "මගේ පිළිගැනීම අවශ්‍යයි", overdue: "කල් ඉකුත්", criticalHigh: "අති ඉහළ සහ ඉහළ", soon: "දින 14ක් තුළ ආරම්භ", opportunities: "අවස්ථා" },
  presets: { needsMyAck: "මගේ පිළිගැනීම අවශ්‍යයි", overdue: "කල් ඉකුත් පිළිගැනීම්", criticalHigh: "අති ඉහළ සහ ඉහළ", soon: "දින 14ක් තුළ ආරම්භ", opportunities: "අවස්ථා", watching: "නිරීක්ෂණය කරන", mine: "මගේ ආයතනය සම්බන්ධ සියල්ල", unassigned: "නායකයා නොදැක්වූ", dismissed: "ඉවත දැමූ", autoClosed: "ස්වයංක්‍රීයව වසා දැමූ", all: "සියලු ආයතන" },
  filters: { title: "පෙරහන්", withCount: "පෙරහන් ({n})", clear: "සියල්ල මකන්න", status: "තත්ත්වය", band: "බරපතළකම", classes: "පන්තිය", recordType: "වර්ගය", internal: "අභ්‍යන්තර පමණි", search: "අංකය, යොමුව හෝ මාතෘකාව සොයන්න", close: "වසන්න", presets: "දසුන්" },
  recordType: { conflict: "ගැටුම", opportunity: "අවස්ථාව" },
  status: { open: "විවෘත", acknowledged: "පිළිගත්", awaiting_response: "පිළිතුරු බලාපොරොත්තුවෙන්", negotiating: "සාකච්ඡා කරමින්", escalated: "ඉහළ යැවූ", resolved: "විසඳූ", dismissed: "ඉවත දැමූ", auto_closed: "ස්වයංක්‍රීයව වසා දැමූ", withdrawn: "ඉල්ලා අස්කර ගත්" },
  belowThreshold: "බරපතළකම දැන් සටහන් කිරීමේ සීමාවට පහළයි",
  internalChip: "අභ්‍යන්තර",
  roles: { requesting: "ඉල්ලුම් කරන ආයතනය", counterpart: "ප්‍රතිපාර්ශ්ව ආයතනය", asset_owner: "වත්කම් හිමිකරු", third_party: "ආසන්න වැඩ (දැනුම් දෙන)" },
  reasons: {
    owns_this_request: "මෙම ගැටුමේ වැඩ දෙකෙන් එකක් හිමි වේ",
    owns_other_request: "මෙම ගැටුමේ අනෙක් වැඩය හිමි වේ",
    owns_asset_in_footprint: "පාද සටහන තුළ වත්කම් {assetCount}ක් ({infrastructureType}) හිමි වේ",
    third_party_work_nearby: "දින අතිච්ඡාදනය වන වැඩයක් මීටර් {distanceMeters}ක් දුරින් ඇත",
    manually_added: "ජාතික සම්බන්ධීකරණය විසින් එක් කරන ලදී",
    lead_road_owner: "යෝජිත නායකයා: මාර්ගය හිමි ආයතනය",
    lead_first_submitted: "යෝජිත නායකයා: පළමුව ඉදිරිපත් කළ ආයතනය",
    national_set: "නායකයා ජාතික සම්බන්ධීකරණය විසින් නියම කරන ලදී",
  },
  ack: { pending: "පිළිගැනීම අපේක්ෂිතයි", acknowledged: "පිළිගත්", excluded: "බැහැර කළ", required: "අවශ්‍යයි", informed: "දැනුම් දීම පමණි", manual: "අතින් එක් කළ", auto: "හඳුනාගත්", onBehalf: "වෙනුවෙන්" },
  sla: { later: "පිළිගැනීම පැය {hours}කින්", laterDays: "පිළිගැනීම දින {days}කින්", today: "අද නියමිතයි", overdueH: "පැය {hours}ක් ප්‍රමාදයි", overdueD: "දින {days}ක් ප්‍රමාදයි", none: "නියමිත දිනයක් නැත", tooltip: "නියමිත කාලය {when} (ආසියා/කොළඹ)" },
  ring: { upcoming: "දින {days}කින් ආරම්භ", active: "සක්‍රීයයි · දින {day}/{total}", ended: "අවසන්", none: "දිනයන් නැත", aria: "බලපෑමට ඇති කාලය: {text}" },
  lead: { suggested: "යෝජිත නායකයා: {agency} · {reason}", national: "ජාතික සම්බන්ධීකරණය විසින් නායකයා: {agency}", none: "නායකයෙක් නැත", crown: "නායක ආයතනය" },
  row: { open: "ලිපිගොනුව විවෘත කරන්න", acknowledge: "පිළිගන්න", watch: "නිරීක්ෂණය", unwatch: "නිරීක්ෂණය නවත්වන්න", select: "{no} තෝරන්න", unseen: "නොදුටු වෙනස්කම් {n}", ackProgress: "අවශ්‍ය ආයතන {required}න් {done}ක් පිළිගෙන ඇත", mine: "මගේ", vs: "↔", more: "+{n}", noAgencies: "ආයතනයක් නැත", preview: "පෙරදසුන" },
  bulk: { acknowledge: "{n}ක් පිළිගන්න", clear: "මකන්න", summary: "{ok}ක් පිළිගත් · {already}ක් දැනටමත් · {failed}ක් කළ නොහැකි විය", max: "එකවර 25ක් දක්වා පමණි." },
  states: { loading: "ගැටුම් පූරණය වේ…", emptyTitle: "ඔබේ අවධානය අවශ්‍ය ගැටුම් නැත", emptyBody: "වම්පස වෙනත් දසුනක් උත්සාහ කරන්න, නැතහොත් පෙරහන් මකන්න.", filteredEmpty: "මෙම පෙරහන් වලට ගැළපෙන ගැටුම් නැත.", error: "ගැටුම් දැන් පූරණය කළ නොහැක.", retry: "නැවත උත්සාහ කරන්න", updated: "මේ දැන් යාවත්කාලීන විය", stale: "මෙම වාර්තාව වෙනස් විය. නැවත පූරණය කරන ලදී.", forbidden: "මෙය කිරීමට ඔබට අවසර නැත.", notFound: "මෙම ගැටුම් වාර්තාව ඔබට ලබා ගත නොහැක.", failed: "එම ක්‍රියාව සම්පූර්ණ කළ නොහැකි විය.", live: "ගැටුම් {n}ක් ඔබේ පිළිගැනීම අවශ්‍යයි", ackLive: "ගැටුම {no} පිළිගන්නා ලදී", capped: "ගැළපෙන නවතම වාර්තා 1000 පෙන්වයි.", noPreview: "පෙරදසුනට ගැටුමක් තෝරන්න." },
  shortcuts: { title: "යතුරුපුවරු කෙටිමං", move: "J / K හෝ ↑ / ↓ — චලනය", open: "Enter — ලිපිගොනුව විවෘත කරන්න", ack: "A — පිළිගන්න (ඔබේ ආයතනය)", watch: "W — නිරීක්ෂණය", select: "X — පේළිය තෝරන්න", help: "? — මෙම උපකාරය" },
  board: { lane: "{band} · {n}", collapse: "හකුළන්න", expand: "දිග හරින්න", empty: "මෙහි කිසිවක් නැත" },
  map: { aria: "ගැටුම් ස්ථාන සිතියම", open: "ලිපිගොනුව විවෘත කරන්න", unavailable: "සිතියම ඇඳිය නොහැකි විය." },
  dossier: {
    back: "සියලු ගැටුම්", copy: "අංකය පිටපත් කරන්න", copied: "පිටපත් කළා", watch: "නිරීක්ෂණය", unwatch: "නිරීක්ෂණය කරමින්", acknowledge: "පිළිගන්න", dismiss: "ඉවත දමන්න", reopen: "නැවත විවෘත කරන්න", setLead: "නායකයා නියම කරන්න", evidence: "සාක්ෂි අපනයනය (GeoJSON)", permalink: "සබැඳිය පිටපත් කරන්න",
    ackSummary: "අවශ්‍ය ආයතන {required}න් {done}ක් පිළිගෙන ඇත",
    tabs: { overview: "දළ විශ්ලේෂණය", stakeholders: "සහභාගිවන්නන්", timeline: "කාලරේඛාව", notes: "සටහන්", related: "අදාළ", evidence: "සාක්ෂි" },
    since: "ඔබ අවසන් වරට බැලූ දා සිට", sinceEvents: "+සිදුවීම් {n}", sinceSeverity: "බරපතළකම {from} → {to}", sinceAgencies: "ආයතන {n}ක් එක් විය", sinceStatus: "තත්ත්වය {from} → {to}", markSeen: "දුටු ලෙස සලකුණු කරන්න",
    why: "මෙය ගැටුමක් වන්නේ ඇයි", digOnce: "එක් වරක් හාරන්න", digOnceBody: "මීටර් {meters}ක පමණ හවුල් අගල. මෙම වැඩ සම්බන්ධීකරණයෙන් එක් කැණීමක් ඉතිරි කළ හැක.", yours: "ඔබේ", theirs: "ඔවුන්ගේ", partyA: "පාර්ශ්වය A", partyB: "පාර්ශ්වය B", schedule: "කාලසටහන්", redacted: "අනෙක් ආයතනවල වැඩ පිළිබඳ සාරාංශ තොරතුරු පමණක් පෙන්වයි.", ruleVersion: "රීති v{version}", floor: "ආරක්ෂණ පහළ සීමාව {code} යෙදිණි (අවම {min})",
    overrideNote: "බරපතළකම ජාතික සම්බන්ධීකරණය විසින් නියම කරන ලදී.", loading: "ලිපිගොනුව පූරණය වේ…", notFound: "මෙම ගැටුම් වාර්තාව ඔබට ලබා ගත නොහැක.", error: "ලිපිගොනුව පූරණය කළ නොහැකි විය.", noMap: "සිතියම් දත්ත නැත.", mapToggle: "අදාළ ස්ථාන", openItem: "{ref} විවෘත කරන්න", cannotOpen: "මෙය විවෘත කිරීමට ඔබට නොහැක.",
    ackTitle: "මෙම ගැටුම පිළිගන්න", ackBody: "පිළිගැනීමෙන් {agency} මෙම ගැටුම දුටු බව සටහන් වේ. එය විසඳන්නේ නැත.", ackNote: "විකල්ප සටහන (විගණන මාර්ගයේ තබයි)", confirm: "තහවුරු කරන්න", cancel: "අවලංගු කරන්න",
    reasonLabel: "හේතුව (අවම අකුරු 10ක්)", dismissTitle: "මෙම ගැටුම ඉවත දමන්න", dismissBody: "බරපතළකම එක් පටියකින් හෝ වැඩි වුවහොත් ස්වයංක්‍රීයව නැවත විවෘත වේ.", reopenTitle: "මෙම ගැටුම නැවත විවෘත කරන්න", leadTitle: "නායක ආයතනය නියම කරන්න", addAgency: "ආයතනයක් එක් කරන්න", addAgencyTitle: "ආයතනයක් එක් කරන්න", chooseAgency: "ආයතනය", exclude: "බැහැර කරන්න", restore: "නැවත ස්ථාපනය", excludeTitle: "මෙම ආයතනය බැහැර කරන්න", excluded: "බැහැර කළ", inactive: "තවදුරටත් හඳුනාගෙන නැත",
  },
  lifecycle: { title: "ජීවන චක්‍රය", open: "විවෘත", acknowledged: "පිළිගත්", dismissed: "ඉවත දැමූ", auto_closed: "ස්වයංක්‍රීයව වසා දැමූ", current: "වත්මන්", changedAt: "{when}" },
  constellation: { title: "සහභාගිවන්නන්ගේ තාරකාවලිය", center: "ගැටුම", table: "සහභාගිවන්නන්ගේ වගුව", agency: "ආයතනය", roles: "භූමිකා", ack: "පිළිගැනීම", due: "නියමිත", reasons: "සම්බන්ධ වන්නේ ඇයි", hint: "ඊතල යතුරෙන් ආයතන අතර ගමන් කරන්න. Enter මගින් කාඩ්පත විවෘත කරන්න.", orbitParties: "පාර්ශ්ව", orbitAssets: "වත්කම් හිමියන්", orbitNearby: "ආසන්න වැඩ", close: "වසන්න", ackBy: "{role} · {when}", noAck: "තවම පිළිගෙන නැත" },
  events: {
    detected: "හඳුනා ගත්තා", agency_added: "ආයතනයක් එක් කළා", agency_removed: "ආයතනයක් ඉවත් කළා", agency_excluded: "ආයතනයක් බැහැර කළා", agency_restored: "ආයතනයක් නැවත ස්ථාපිත කළා", severity_changed: "බරපතළකම වෙනස් විය", acknowledged: "පිළිගත්තා", lead_set: "නායකයා නියම කළා", dismissed: "ඉවත දැමුවා", reopened: "නැවත විවෘත කළා", auto_closed: "ස්වයංක්‍රීයව වසා දැමුවා", redetected: "නැවත හඳුනා ගත්තා", note_added: "පෞද්ගලික සටහනක් එක් කළා", override_applied: "බරපතළකම අභිබවා යාම",
    actorSystem: "පද්ධතිය", actorAgency: "{agency}", detailSeverity: "{from} → {to}", detailAgencies: "ආයතන {n}ක්",
  },
  timeline: { title: "ක්‍රියාකාරකම්", sparkline: "බරපතළකම් ඉතිහාසය", sparkAria: "බරපතළකම් ඉතිහාසය: {text}", noEvents: "තවම ක්‍රියාකාරකම් නැත.", point: "{score} · {band} · රීති v{version} · {reason}", reason: { detected: "හඳුනාගැනීම", reassessed: "නැවත තක්සේරුව", override: "අභිබවා යාම", override_cleared: "අභිබවා යාම ඉවත් කළා" } },
  notes: { private: "{agency} සඳහා පෞද්ගලික", placeholder: "පෞද්ගලික සටහනක් ලියන්න (සරල පෙළ, අකුරු 1000 දක්වා)", add: "සටහන එක් කරන්න", delete: "මකන්න", empty: "තවම පෞද්ගලික සටහන් නැත.", filter: "ආයතනය", all: "සියලු ආයතන", failed: "සටහන සුරැකිය නොහැකි විය." },
  related: { title: "අදාළ ගැටුම්", empty: "අදාළ ගැටුම් නැත.", open: "විවෘත කරන්න" },
  evidence: { title: "හඳුනාගත් අවස්ථාව සහ දැන්", metric: "මිනුම", atDetection: "හඳුනාගත් විට", now: "දැන්", score: "ලකුණු", band: "පටිය", classes: "පන්ති", ruleVersion: "රීති අනුවාදය", dates: "දිනයන්", agencies: "බලපාන ආයතන", factors: "හඳුනාගත් විට සාධක", download: "GeoJSON බාගන්න", delta: "Δ {n}" },
  notifications: {
    batch_new: "ඔබේ ආයතනයට අදාළ නව ගැටුම් {count}ක්, ඉහළම: {band}",
    escalated: "{conflictNo} {band} දක්වා ඉහළ ගියේය",
    agency_added: "ඔබේ ආයතනය දැන් {conflictNo} හි සම්බන්ධයි",
    reopened: "{conflictNo} නැවත විවෘත කරන ලදී",
    auto_closed: "{conflictNo} ස්වයංක්‍රීයව වසා දමන ලදී",
  },
  integrations: { chip: "{status} · {done}/{required} පිළිගත්", openRecord: "ගැටුම් වාර්තාව විවෘත කරන්න", heroChip: "ගැටුම් වාර්තා {total}ක් · {needs}ක් පිළිගැනීම අවශ්‍යයි", heroChipNone: "ගැටුම් වාර්තා {total}ක්", agenciesTitle: "ඔබ සම්බන්ධීකරණය කළ යුතු ආයතන", agenciesNote: "ඔබ ඉදිරිපත් කළ පසු මෙම ආයතනවලට දැනුම් දෙනු ලැබේ.", required: "අවශ්‍යයි", informed: "දැනුම් දෙන", needsAck: "පිළිගැනීම අවශ්‍යයි", records: "වාර්තා {n}" },
};

const TA: ConflictCopy = {
  nav: "முரண்பாடுகள்",
  title: "முரண்பாட்டு கட்டளை மையம்",
  subtitle: "உங்கள் நிறுவனம் தொடர்பான முரண்பாடுகளை வரிசைப்படுத்தி, ஏற்றுக்கொண்டு, ஒவ்வொரு மாற்றத்தையும் பின்தொடருங்கள்.",
  demoNote: "டெமோ மற்றும் விதை தரவு மட்டுமே. அதிகாரப்பூர்வ அரசு தரவு அல்ல.",
  exportCsv: "CSV ஏற்றுமதி",
  views: { inbox: "இன்பாக்ஸ்", board: "பலகை", map: "வரைபடம்" },
  mission: { needsMyAck: "எனது ஏற்பு தேவை", overdue: "காலக்கெடு கடந்தது", criticalHigh: "மிகக் கடுமை & அதிகம்", soon: "14 நாட்களுக்குள் தொடக்கம்", opportunities: "வாய்ப்புகள்" },
  presets: { needsMyAck: "எனது ஏற்பு தேவை", overdue: "காலக்கெடு கடந்த ஏற்பு", criticalHigh: "மிகக் கடுமை & அதிகம்", soon: "14 நாட்களுக்குள் தொடக்கம்", opportunities: "வாய்ப்புகள்", watching: "கண்காணிப்பவை", mine: "எனது நிறுவனம் தொடர்பான அனைத்தும்", unassigned: "தலைமை நியமிக்கப்படாதவை", dismissed: "நிராகரிக்கப்பட்டவை", autoClosed: "தானாக மூடப்பட்டவை", all: "அனைத்து நிறுவனங்கள்" },
  filters: { title: "வடிகட்டிகள்", withCount: "வடிகட்டிகள் ({n})", clear: "அனைத்தையும் அழி", status: "நிலை", band: "தீவிரம்", classes: "வகுப்பு", recordType: "வகை", internal: "உள்ளகம் மட்டும்", search: "எண், குறிப்பு அல்லது தலைப்பைத் தேடுக", close: "மூடு", presets: "காட்சிகள்" },
  recordType: { conflict: "முரண்பாடு", opportunity: "வாய்ப்பு" },
  status: { open: "திறந்தது", acknowledged: "ஏற்கப்பட்டது", awaiting_response: "பதிலுக்காக காத்திருப்பு", negotiating: "பேச்சுவார்த்தை", escalated: "மேல்நிலைக்கு அனுப்பப்பட்டது", resolved: "தீர்க்கப்பட்டது", dismissed: "நிராகரிக்கப்பட்டது", auto_closed: "தானாக மூடப்பட்டது", withdrawn: "திரும்பப் பெறப்பட்டது" },
  belowThreshold: "தீவிரம் இப்போது பதிவு வரம்பிற்குக் கீழே உள்ளது",
  internalChip: "உள்ளகம்",
  roles: { requesting: "கோரும் நிறுவனம்", counterpart: "எதிர்த்தரப்பு நிறுவனம்", asset_owner: "சொத்து உரிமையாளர்", third_party: "அருகிலுள்ள பணி (தகவலுக்கு)" },
  reasons: {
    owns_this_request: "இந்த முரண்பாட்டிலுள்ள இரு பணிகளில் ஒன்றை வைத்திருக்கிறது",
    owns_other_request: "இந்த முரண்பாட்டிலுள்ள மற்ற பணியை வைத்திருக்கிறது",
    owns_asset_in_footprint: "தடத்திற்குள் {assetCount} சொத்து(கள்) ({infrastructureType}) உள்ளன",
    third_party_work_nearby: "தேதிகள் ஒன்றோடொன்று பொருந்தும் பணி {distanceMeters} மீ தொலைவில் உள்ளது",
    manually_added: "தேசிய ஒருங்கிணைப்பால் சேர்க்கப்பட்டது",
    lead_road_owner: "பரிந்துரைக்கப்பட்ட தலைமை: சாலையின் உரிமையாளர்",
    lead_first_submitted: "பரிந்துரைக்கப்பட்ட தலைமை: முதலில் சமர்ப்பித்தவர்",
    national_set: "தேசிய ஒருங்கிணைப்பால் தலைமை நியமிக்கப்பட்டது",
  },
  ack: { pending: "ஏற்பு நிலுவையில்", acknowledged: "ஏற்கப்பட்டது", excluded: "விலக்கப்பட்டது", required: "தேவை", informed: "தகவலுக்கு மட்டும்", manual: "கைமுறையாகச் சேர்த்தது", auto: "கண்டறியப்பட்டது", onBehalf: "சார்பாக" },
  sla: { later: "ஏற்பு {hours} மணிநேரத்தில்", laterDays: "ஏற்பு {days} நாளில்", today: "இன்று கடைசி", overdueH: "{hours} மணிநேரம் தாமதம்", overdueD: "{days} நாள் தாமதம்", none: "காலக்கெடு இல்லை", tooltip: "கடைசி நேரம் {when} (ஆசியா/கொழும்பு)" },
  ring: { upcoming: "{days} நாளில் தொடக்கம்", active: "செயலில் · நாள் {day}/{total}", ended: "முடிந்தது", none: "தேதிகள் இல்லை", aria: "தாக்கத்திற்கான நேரம்: {text}" },
  lead: { suggested: "பரிந்துரைக்கப்பட்ட தலைமை: {agency} · {reason}", national: "தேசிய ஒருங்கிணைப்பு நியமித்த தலைமை: {agency}", none: "தலைமை இல்லை", crown: "தலைமை நிறுவனம்" },
  row: { open: "கோப்பைத் திற", acknowledge: "ஏற்றுக்கொள்", watch: "கண்காணி", unwatch: "கண்காணிப்பை நிறுத்து", select: "{no} ஐத் தேர்ந்தெடு", unseen: "பார்க்காத மாற்றங்கள் {n}", ackProgress: "தேவையான {required} நிறுவனங்களில் {done} ஏற்றுள்ளன", mine: "என்னுடையது", vs: "↔", more: "+{n}", noAgencies: "நிறுவனம் இல்லை", preview: "முன்னோட்டம்" },
  bulk: { acknowledge: "{n} ஐ ஏற்றுக்கொள்", clear: "அழி", summary: "{ok} ஏற்கப்பட்டது · {already} ஏற்கனவே · {failed} முடியவில்லை", max: "ஒரே நேரத்தில் 25 வரை மட்டும்." },
  states: { loading: "முரண்பாடுகள் ஏற்றப்படுகின்றன…", emptyTitle: "உங்கள் கவனம் தேவைப்படும் முரண்பாடுகள் இல்லை", emptyBody: "இடப்புறத்தில் வேறு காட்சியை முயலவும் அல்லது வடிகட்டிகளை அழிக்கவும்.", filteredEmpty: "இந்த வடிகட்டிகளுக்குப் பொருந்தும் முரண்பாடுகள் இல்லை.", error: "முரண்பாடுகளை இப்போது ஏற்ற முடியவில்லை.", retry: "மீண்டும் முயல்க", updated: "இப்போது புதுப்பிக்கப்பட்டது", stale: "இந்தப் பதிவு மாறியது. மீண்டும் ஏற்றப்பட்டது.", forbidden: "இதைச் செய்ய உங்களுக்கு அனுமதி இல்லை.", notFound: "இந்த முரண்பாட்டுப் பதிவு உங்களுக்குக் கிடைக்கவில்லை.", failed: "அந்தச் செயலை முடிக்க முடியவில்லை.", live: "{n} முரண்பாடுகளுக்கு உங்கள் ஏற்பு தேவை", ackLive: "முரண்பாடு {no} ஏற்கப்பட்டது", capped: "பொருந்தும் சமீபத்திய 1000 பதிவுகள் காட்டப்படுகின்றன.", noPreview: "முன்னோட்டத்திற்கு ஒரு முரண்பாட்டைத் தேர்ந்தெடுக்கவும்." },
  shortcuts: { title: "விசைப்பலகை குறுக்குவழிகள்", move: "J / K அல்லது ↑ / ↓ — நகர்த்து", open: "Enter — கோப்பைத் திற", ack: "A — ஏற்றுக்கொள் (உங்கள் நிறுவனம்)", watch: "W — கண்காணி", select: "X — வரிசையைத் தேர்ந்தெடு", help: "? — இந்த உதவி" },
  board: { lane: "{band} · {n}", collapse: "சுருக்கு", expand: "விரி", empty: "இங்கு எதுவும் இல்லை" },
  map: { aria: "முரண்பாட்டு இடங்களின் வரைபடம்", open: "கோப்பைத் திற", unavailable: "வரைபடத்தை வரைய முடியவில்லை." },
  dossier: {
    back: "அனைத்து முரண்பாடுகள்", copy: "எண்ணை நகலெடு", copied: "நகலெடுக்கப்பட்டது", watch: "கண்காணி", unwatch: "கண்காணிக்கிறது", acknowledge: "ஏற்றுக்கொள்", dismiss: "நிராகரி", reopen: "மீண்டும் திற", setLead: "தலைமையை நியமி", evidence: "ஆதார ஏற்றுமதி (GeoJSON)", permalink: "இணைப்பை நகலெடு",
    ackSummary: "தேவையான {required} நிறுவனங்களில் {done} ஏற்றுள்ளன",
    tabs: { overview: "கண்ணோட்டம்", stakeholders: "பங்குதாரர்கள்", timeline: "காலவரிசை", notes: "குறிப்புகள்", related: "தொடர்புடையவை", evidence: "ஆதாரம்" },
    since: "நீங்கள் கடைசியாகப் பார்த்த பிறகு", sinceEvents: "+{n} நிகழ்வுகள்", sinceSeverity: "தீவிரம் {from} → {to}", sinceAgencies: "{n} நிறுவனம் சேர்க்கப்பட்டது", sinceStatus: "நிலை {from} → {to}", markSeen: "பார்த்ததாகக் குறி",
    why: "இது ஏன் முரண்பாடு", digOnce: "ஒருமுறை தோண்டுங்கள்", digOnceBody: "சுமார் {meters} மீ பகிரப்பட்ட அகழி. இந்தப் பணிகளை ஒருங்கிணைத்தால் ஒரு அகழ்வைச் சேமிக்கலாம்.", yours: "உங்களுடையது", theirs: "அவர்களுடையது", partyA: "தரப்பு A", partyB: "தரப்பு B", schedule: "அட்டவணைகள்", redacted: "மற்ற நிறுவனங்களின் பணிகள் குறித்த சுருக்க விவரங்கள் மட்டுமே காட்டப்படுகின்றன.", ruleVersion: "விதி v{version}", floor: "பாதுகாப்பு தளம் {code} பயன்படுத்தப்பட்டது (குறைந்தபட்சம் {min})",
    overrideNote: "தீவிரம் தேசிய ஒருங்கிணைப்பால் அமைக்கப்பட்டது.", loading: "கோப்பு ஏற்றப்படுகிறது…", notFound: "இந்த முரண்பாட்டுப் பதிவு உங்களுக்குக் கிடைக்கவில்லை.", error: "கோப்பை ஏற்ற முடியவில்லை.", noMap: "வரைபடத் தரவு இல்லை.", mapToggle: "தொடர்புடைய இடங்கள்", openItem: "{ref} ஐத் திற", cannotOpen: "இதைத் திறக்க உங்களுக்கு அனுமதி இல்லை.",
    ackTitle: "இந்த முரண்பாட்டை ஏற்றுக்கொள்", ackBody: "ஏற்பு என்பது {agency} இந்த முரண்பாட்டைப் பார்த்ததைப் பதிவு செய்கிறது. அது அதைத் தீர்க்காது.", ackNote: "விருப்பக் குறிப்பு (தணிக்கைப் பதிவில் இருக்கும்)", confirm: "உறுதிசெய்", cancel: "ரத்து செய்",
    reasonLabel: "காரணம் (குறைந்தது 10 எழுத்துகள்)", dismissTitle: "இந்த முரண்பாட்டை நிராகரி", dismissBody: "தீவிரம் ஒரு நிலை அல்லது அதற்கு மேல் உயர்ந்தால் தானாகவே மீண்டும் திறக்கும்.", reopenTitle: "இந்த முரண்பாட்டை மீண்டும் திற", leadTitle: "தலைமை நிறுவனத்தை நியமி", addAgency: "நிறுவனத்தைச் சேர்", addAgencyTitle: "நிறுவனத்தைச் சேர்", chooseAgency: "நிறுவனம்", exclude: "விலக்கு", restore: "மீட்டமை", excludeTitle: "இந்த நிறுவனத்தை விலக்கு", excluded: "விலக்கப்பட்டது", inactive: "இனி கண்டறியப்படவில்லை",
  },
  lifecycle: { title: "வாழ்க்கைச் சுழற்சி", open: "திறந்தது", acknowledged: "ஏற்கப்பட்டது", dismissed: "நிராகரிக்கப்பட்டது", auto_closed: "தானாக மூடப்பட்டது", current: "தற்போதைய", changedAt: "{when}" },
  constellation: { title: "பங்குதாரர் விண்மீன் தொகுதி", center: "முரண்பாடு", table: "பங்குதாரர்கள் அட்டவணை", agency: "நிறுவனம்", roles: "பாத்திரங்கள்", ack: "ஏற்பு", due: "கடைசி நேரம்", reasons: "ஏன் தொடர்புடையது", hint: "அம்பு விசைகளால் நிறுவனங்களுக்கிடையே நகரலாம். Enter அட்டையைத் திறக்கும்.", orbitParties: "தரப்புகள்", orbitAssets: "சொத்து உரிமையாளர்கள்", orbitNearby: "அருகிலுள்ள பணி", close: "மூடு", ackBy: "{role} · {when}", noAck: "இன்னும் ஏற்கவில்லை" },
  events: {
    detected: "கண்டறியப்பட்டது", agency_added: "நிறுவனம் சேர்க்கப்பட்டது", agency_removed: "நிறுவனம் நீக்கப்பட்டது", agency_excluded: "நிறுவனம் விலக்கப்பட்டது", agency_restored: "நிறுவனம் மீட்டமைக்கப்பட்டது", severity_changed: "தீவிரம் மாறியது", acknowledged: "ஏற்கப்பட்டது", lead_set: "தலைமை நியமிக்கப்பட்டது", dismissed: "நிராகரிக்கப்பட்டது", reopened: "மீண்டும் திறக்கப்பட்டது", auto_closed: "தானாக மூடப்பட்டது", redetected: "மீண்டும் கண்டறியப்பட்டது", note_added: "தனிப்பட்ட குறிப்பு சேர்க்கப்பட்டது", override_applied: "தீவிர மேலெழுதல்",
    actorSystem: "அமைப்பு", actorAgency: "{agency}", detailSeverity: "{from} → {to}", detailAgencies: "{n} நிறுவனங்கள்",
  },
  timeline: { title: "செயல்பாடு", sparkline: "தீவிர வரலாறு", sparkAria: "தீவிர வரலாறு: {text}", noEvents: "இன்னும் செயல்பாடு இல்லை.", point: "{score} · {band} · விதி v{version} · {reason}", reason: { detected: "கண்டறிதல்", reassessed: "மறுமதிப்பீடு", override: "மேலெழுதல்", override_cleared: "மேலெழுதல் நீக்கம்" } },
  notes: { private: "{agency} க்கு மட்டும் தனிப்பட்டது", placeholder: "தனிப்பட்ட குறிப்பை எழுதுங்கள் (எளிய உரை, 1000 எழுத்துகள் வரை)", add: "குறிப்பைச் சேர்", delete: "நீக்கு", empty: "இன்னும் தனிப்பட்ட குறிப்புகள் இல்லை.", filter: "நிறுவனம்", all: "அனைத்து நிறுவனங்கள்", failed: "குறிப்பைச் சேமிக்க முடியவில்லை." },
  related: { title: "தொடர்புடைய முரண்பாடுகள்", empty: "தொடர்புடைய முரண்பாடுகள் இல்லை.", open: "திற" },
  evidence: { title: "கண்டறிந்தபோது vs இப்போது", metric: "அளவீடு", atDetection: "கண்டறிந்தபோது", now: "இப்போது", score: "மதிப்பெண்", band: "பட்டை", classes: "வகுப்புகள்", ruleVersion: "விதி பதிப்பு", dates: "தேதிகள்", agencies: "பாதிக்கப்பட்ட நிறுவனங்கள்", factors: "கண்டறிந்தபோதான காரணிகள்", download: "GeoJSON பதிவிறக்கு", delta: "Δ {n}" },
  notifications: {
    batch_new: "உங்கள் நிறுவனம் தொடர்பான புதிய முரண்பாடுகள் {count}, அதிகபட்சம்: {band}",
    escalated: "{conflictNo} {band} நிலைக்கு உயர்ந்தது",
    agency_added: "உங்கள் நிறுவனம் இப்போது {conflictNo} இல் தொடர்புடையது",
    reopened: "{conflictNo} மீண்டும் திறக்கப்பட்டது",
    auto_closed: "{conflictNo} தானாக மூடப்பட்டது",
  },
  integrations: { chip: "{status} · {done}/{required} ஏற்கப்பட்டது", openRecord: "முரண்பாட்டுப் பதிவைத் திற", heroChip: "{total} முரண்பாட்டுப் பதிவுகள் · {needs} க்கு ஏற்பு தேவை", heroChipNone: "{total} முரண்பாட்டுப் பதிவுகள்", agenciesTitle: "நீங்கள் ஒருங்கிணைக்க வேண்டிய நிறுவனங்கள்", agenciesNote: "நீங்கள் சமர்ப்பித்த பிறகு இந்த நிறுவனங்களுக்கு அறிவிக்கப்படும்.", required: "தேவை", informed: "தகவலுக்கு", needsAck: "ஏற்பு தேவை", records: "{n} பதிவுகள்" },
};

export function getConflictCopy(locale: AuthLocale): ConflictCopy {
  return locale === "si" ? SI : locale === "ta" ? TA : EN;
}

const dayCount = (h: number) => Math.round(h / 24);
export function slaText(copy: ConflictCopy, s: SlaState): string {
  if (s.kind === "none") return copy.sla.none;
  if (s.kind === "today") return copy.sla.today;
  if (s.kind === "later") return s.hours >= 48 ? fmt(copy.sla.laterDays, { days: dayCount(s.hours) }) : fmt(copy.sla.later, { hours: s.hours });
  return s.hours >= 48 ? fmt(copy.sla.overdueD, { days: s.days }) : fmt(copy.sla.overdueH, { hours: s.hours });
}
export function ringText(copy: ConflictCopy, t: TimeToImpact): string {
  if (t.state === "upcoming") return fmt(copy.ring.upcoming, { days: t.days });
  if (t.state === "active") return fmt(copy.ring.active, { day: t.dayIndex, total: t.totalDays });
  return t.state === "ended" ? copy.ring.ended : copy.ring.none;
}

/** One localized sentence for a bell notification: key + params only from the server. */
export function conflictNoticeText(copy: ConflictCopy, titleKey: string, params: Record<string, unknown>, bands: Record<string, string>): string {
  const key = titleKey.replace("roadsync.notifications.", "");
  const band = typeof params.band === "string" ? bands[params.band] ?? params.band : typeof params.highestBand === "string" ? bands[params.highestBand] ?? params.highestBand : "";
  return fmt(copy.notifications[key] ?? copy.nav, { ...params, band });
}
export function reasonText(copy: ConflictCopy, code: string, params: Record<string, unknown> = {}): string {
  return fmt(copy.reasons[code] ?? code, params);
}

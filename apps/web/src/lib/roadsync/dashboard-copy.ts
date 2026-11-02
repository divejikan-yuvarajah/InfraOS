import type { AuthLocale } from "@/lib/auth/types";

import { fmt } from "./assessment";

/**
 * Step 78 copy (keys: dashboard, metrics, signals, health). The server sends codes and params only; every sentence is
 * composed here. Sinhala and Tamil are drafts pending native review and fall back to English per key.
 */
const EN = {
  title: "Coordination Command Center", subtitle: "What needs attention now, how conflicts flow, where risk concentrates and how well agencies coordinate.",
  demoNote: "Demo and seed data only. Not official government data.", nav: "Dashboard",
  scope: { national: "National view", agency: "Agency view" },
  range: { label: "Period", "7d": "7 days", "30d": "30 days", "90d": "90 days", "12m": "12 months", custom: "Custom", from: "From", to: "To", compare: "Compare to previous period", previous: "vs previous {n} days", customHelp: "Pick both dates (up to 24 months)." },
  filters: { agency: "Agency", allAgencies: "All agencies", district: "District", allDistricts: "All districts" },
  updated: { ago: "Updated {when}", now: "Updated just now", min: "{n} min ago", refresh: "Refresh", stale: "These figures are cached and over 5 minutes old.", live: "Dashboard updated: {n} critical or high open." },
  actions: { export: "Export CSV", brief: "Briefing", customize: "Customize", print: "Print", back: "Back to dashboard", view: "View", showAll: "Show all ({n})", showLess: "Show fewer", copyDef: "Definition", close: "Close", open: "Open" },
  widgets: { attention: "Needs you now", signals: "Signals", kpis: "Key indicators", health: "Coordination health", funnel: "Conflict journey", flow: "Flow and exposure", aging: "Backlog aging", map: "Corridor pulse", calendar: "Impact calendar", scorecards: "Agency scorecards", outcomes: "Outcomes and dig-once", lists: "Top lists" },
  attention: { needsMyAck: "Needs my acknowledgement", needsMyResponse: "Needs my response", needsMyApproval: "Needs my approval", overdue: "Overdue", startingSoon: "Starting within 14 days", allClear: "All clear", overdueBreakdown: "{a} acknowledgements · {r} responses · {p} approvals", title: "Needs you now" },
  signalsTitle: "Signals", noSignals: "No signals right now.", severity: { info: "Info", warning: "Warning", critical: "Critical" } as Record<string, string>,
  signal: {
    critical_starting_uncoordinated: "{count} critical or high conflicts start within 7 days with no coordination or resolution.",
    overdue_acks_cluster: "{agencyName}: {count} acknowledgements are overdue.", overdue_acks_cluster_own: "{count} of your agency's acknowledgements are overdue.",
    stuck_negotiation: "{count} negotiations have had no activity for {days} days or more.", approvals_overdue: "{count} approval steps are overdue.",
    verification_followup: "{count} resolutions need follow-up after verification.", escalated_unattended: "{count} escalated requests have had no activity for {days} days.",
    risk_accepted_rising: "{count} accepted risks now sit in a higher band than when accepted.", opportunity_window_closing: "{count} dig-once opportunities close within {days} days.",
    backlog_aging: "{percent}% of open conflicts ({count}) are older than {days} days.",
  } as Record<string, string>,
  kpiTitle: "Key indicators",
  kpi: {
    openConflicts: "Open conflicts", criticalHigh: "Critical and high", medianDaysToResolve: "Median days to resolve", agreementRate: "Agreement rate",
    ackTimeliness: "Acknowledgement timeliness", responseTimeliness: "Response timeliness", digOnceMeters: "Dig-once trench",
  } as Record<string, string>,
  def: {
    openConflicts: "Conflict records (not opportunities) whose status is open, acknowledged, awaiting response, negotiating or escalated, in your scope.",
    criticalHigh: "Open conflicts whose current severity band is critical or high.",
    medianDaysToResolve: "Median of (resolved date − record created date) for conflicts resolved in the period. Nearest-rank percentile.",
    agreementRate: "Agreed requests ÷ (agreed + closed without agreement), for requests closed in the period.",
    ackTimeliness: "Required acknowledgements completed in the period at or before their due time ÷ (all required acknowledgements completed in the period + those still pending past their due time, when the period includes today).",
    responseTimeliness: "Required coordination responses given in the period at or before their due time ÷ (all required responses given in the period + those still pending past their due time, when the period includes today).",
    digOnceMeters: "Sum of estimated shared trench length of dig-once opportunities realized in the period. Trench length only, not money.",
  } as Record<string, string>,
  defParts: { numerator: "Numerator", denominator: "Denominator", scope: "Scope", scopeNational: "All agencies", scopeAgency: "Your agency only", noData: "Not enough data in this period.", periodNote: "Period: {from} to {to} (Asia/Colombo).", sampled: "Computed on a sample of the first 5,000 values." },
  delta: { up: "up", down: "down", flat: "no change", vs: "{pct}% {dir} {vsText}", abs: "{abs} {dir} {vsText}", good: "improving", bad: "worsening", noBaseline: "no baseline" },
  health: {
    title: "Coordination health", caption: "Operational indicator, not a performance rating.", insufficient: "Needs at least {n} cases in this period.",
    grade: { excellent: "Excellent", good: "Good", needs_attention: "Needs attention", at_risk: "At risk" } as Record<string, string>,
    component: { ackTimeliness: "Acknowledgement timeliness", responseTimeliness: "Response timeliness", resolutionProgress: "Resolution progress", backlogHealth: "Backlog health", commitmentCompletion: "Commitment completion" } as Record<string, string>,
    weight: "Weight {w}%", contribution: "{c} points", excluded: "Insufficient data (excluded)", scoreOf: "Score {s} of 100, {g}", waterfall: "How the score is built", cases: "Based on {n} cases",
  },
  funnel: { title: "Conflict journey", stage: { recorded: "Recorded", acknowledged: "Acknowledged", coordination: "Coordination started", agreed: "Agreed", resolved: "Resolved" } as Record<string, string>, ofPrevious: "{p}% of previous", median: "Median {d} d from creation", step: "+{d} d", bottleneck: "Bottleneck", noData: "No data yet", note: "Cases created in the period; medians are measured from case creation." },
  flow: { title: "New vs resolved", created: "New", resolved: "Resolved", net: "Net", exposureTitle: "Risk exposure", exposure: "Exposure index", open: "Open", hiddenTable: "Data table", date: "Date", summary: "{n} new and {r} resolved in {d} days.", exposureSummary: "Exposure index now {e} across {o} open conflicts.", exposureHelp: "Weighted by band: critical 4, high 3, medium 2, low 1." },
  aging: { title: "Backlog aging", bucket: "{from}–{to} days", bucketOpen: "{from}+ days", oldest: "Oldest open: {no} ({d} d)", empty: "No open conflicts.", summary: "{n} open conflicts by age and band." },
  map: { title: "Corridor pulse", asOf: "Showing open cases as of now", empty: "No open cases in scope.", cell: "{n} open", cluster: "Cluster at {lat}, {lng}", openMap: "Open in Conflicts", districts: "Districts by exposure", summary: "{n} map cells with open cases. Largest cell holds {max}.", note: "Grid cells of about 2 km; no basemap, position is relative." },
  calendar: { title: "Impact calendar", subtitle: "Next 30 days of overlapping works.", starts: "Starts: {n}", active: "Active: {n}", uncoordinated: "Uncoordinated starts: {n}", today: "Today", none: "No activity", summary: "{n} days with active conflicts in the next 30 days.", legend: "Shade = active conflicts · top edge = highest band · dot = start · ! = uncoordinated start" },
  scorecards: {
    title: "Agency scorecards", mine: "My agency scorecard", agency: "Agency", cases: "Cases", open: "Open", overdueAcks: "Overdue acks", overdueResponses: "Overdue responses", agreementRate: "Agreement", medianAckHours: "Median ack (h)", medianResponseHours: "Median response (h)",
    avgRounds: "Avg rounds", resolved: "Resolved", commitmentCompletion: "Commitments", healthScore: "Health", sortBy: "Sort by", compare: "Compare (up to 3)", select: "Select {name}", open2: "Open this agency", insufficient: "Not enough cases",
    benchmark: "National median", benchmarkUnavailable: "Benchmark unavailable: too few agencies.", benchmarkCohort: "Anonymized median of {n} agencies.", yours: "You", median: "Median", note: "Operational indicators. Agencies are never ranked against each other for agency users.",
  },
  outcomes: { title: "Outcomes", empty: "No resolutions in this period.", verification: "Verification success", verificationOf: "{c} of {t} cleared", shift: "Mean amendment shift", shiftDays: "{d} days", national: "Needing national approval", amendments: "Amendments applied: {n}", summary: "{n} resolutions by outcome." },
  digOnce: { title: "Dig-once", realized: "shared trench realized", count: "{n} joint works realized", open: "{n} open opportunities worth {km} km", cta: "View opportunities", caption: "Values are trench length, not monetary savings.", none: "No joint works realized in this period." },
  lists: { districts: "Districts by exposure", longest: "Longest open critical and high", overdueByAgency: "Overdue by agency", none: "Nothing to show.", exposure: "exposure {e}", days: "{n} d" },
  states: { loading: "Loading…", error: "This section could not be loaded.", retry: "Retry", empty: "No coordination activity in this period.", emptyHint: "Try a longer period.", forbidden: "You do not have access to the dashboard.", custom: "Pick both dates to load this period.", insufficient: "Needs at least 5 cases" },
  customize: { title: "Show or hide widgets", reset: "Show all" },
  brief: { title: "Coordination Briefing", scope: "Scope", period: "Period", generated: "Generated {when}", kpis: "Key indicators", signals: "Signals", top: "Top critical and high open cases", scorecards: "Agency scorecards", definitions: "Definitions", freshness: "Figures are computed from current records at the time shown and may be cached for up to 60 seconds.", conflict: "Conflict", band: "Band", dates: "Dates", district: "District", age: "Age", value: "Value" },
  bandsShort: "Band",
};
export type DashCopy = typeof EN;
type Patch = { [K in keyof DashCopy]?: DashCopy[K] extends object ? Partial<DashCopy[K]> : DashCopy[K] };
const merge = (p: Patch): DashCopy => Object.fromEntries(Object.entries(EN).map(([k, v]) => [k, v && typeof v === "object" ? { ...v, ...((p as Record<string, object>)[k] ?? {}) } : (p as Record<string, unknown>)[k] ?? v])) as DashCopy;

const SI = merge({
  title: "සම්බන්ධීකරණ විධාන මධ්‍යස්ථානය", subtitle: "දැන් අවධානය අවශ්‍ය දේ, ගැටුම් ගලා යන ආකාරය, අවදානම සංකේන්ද්‍රණය වන ස්ථාන සහ ආයතන සම්බන්ධීකරණය කරන ආකාරය.", nav: "උපකරණ පුවරුව",
  scope: { national: "ජාතික දසුන", agency: "ආයතන දසුන" },
  range: { label: "කාලය", "7d": "දින 7", "30d": "දින 30", "90d": "දින 90", "12m": "මාස 12", custom: "අභිරුචි", from: "සිට", to: "දක්වා", compare: "පෙර කාලය සමඟ සසඳන්න", previous: "පෙර දින {n} සමඟ", customHelp: "දිනයන් දෙකම තෝරන්න (මාස 24ක් දක්වා)." },
  filters: { agency: "ආයතනය", allAgencies: "සියලු ආයතන", district: "දිස්ත්‍රික්කය", allDistricts: "සියලු දිස්ත්‍රික්ක" },
  updated: { now: "දැන් යාවත්කාලීන කළා", min: "මිනිත්තු {n}කට පෙර", refresh: "නැවුම් කරන්න", stale: "මෙම සංඛ්‍යා ගබඩා කර ඇති අතර මිනිත්තු 5කට වඩා පැරණිය." },
  actions: { export: "CSV අපනයනය", brief: "සාරාංශය", customize: "අභිරුචිකරණය", print: "මුද්‍රණය", back: "උපකරණ පුවරුවට", view: "බලන්න", showAll: "සියල්ල පෙන්වන්න ({n})", open: "විවෘත කරන්න" },
  widgets: { attention: "දැන් ඔබට අවශ්‍ය", signals: "සංඥා", kpis: "ප්‍රධාන දර්ශක", health: "සම්බන්ධීකරණ සෞඛ්‍යය", funnel: "ගැටුම් ගමන", flow: "ගලනය සහ නිරාවරණය", aging: "ඉතිරි වැඩ වයස", map: "මාර්ග ස්පන්දනය", calendar: "බලපෑම් දින දර්ශනය", scorecards: "ආයතන ලකුණු පත්‍ර", outcomes: "ප්‍රතිඵල සහ එක් වරක් කැණීම", lists: "ඉහළ ලැයිස්තු" },
  attention: { needsMyAck: "මගේ පිළිගැනීම අවශ්‍යයි", needsMyResponse: "මගේ ප්‍රතිචාරය අවශ්‍යයි", needsMyApproval: "මගේ අනුමැතිය අවශ්‍යයි", overdue: "කල් ඉක්මවූ", startingSoon: "දින 14ක් තුළ ආරම්භ වේ", allClear: "සියල්ල පැහැදිලියි", title: "දැන් ඔබට අවශ්‍ය" },
  signalsTitle: "සංඥා", noSignals: "දැනට සංඥා නැත.", severity: { info: "තොරතුරු", warning: "අවවාදය", critical: "බරපතල" },
  signal: {
    critical_starting_uncoordinated: "බරපතල හෝ ඉහළ ගැටුම් {count}ක් සම්බන්ධීකරණයක් හෝ විසඳුමක් නොමැතිව දින 7ක් තුළ ආරම්භ වේ.", overdue_acks_cluster: "{agencyName}: පිළිගැනීම් {count}ක් කල් ඉක්මවා ඇත.", overdue_acks_cluster_own: "ඔබේ ආයතනයේ පිළිගැනීම් {count}ක් කල් ඉක්මවා ඇත.",
    stuck_negotiation: "සාකච්ඡා {count}ක් දින {days}ක් හෝ වැඩි කාලයක් අක්‍රියයි.", approvals_overdue: "අනුමැති පියවර {count}ක් කල් ඉක්මවා ඇත.", verification_followup: "සත්‍යාපනයෙන් පසු විසඳුම් {count}කට පසු විපරම අවශ්‍යයි.",
    escalated_unattended: "ඉහළ දැමූ ඉල්ලීම් {count}ක් දින {days}ක් අක්‍රියයි.", risk_accepted_rising: "පිළිගත් අවදානම් {count}ක් දැන් ඉහළ කාණ්ඩයක පවතී.", opportunity_window_closing: "එක් වරක් කැණීමේ අවස්ථා {count}ක් දින {days}ක් තුළ අවසන් වේ.", backlog_aging: "විවෘත ගැටුම්වලින් {percent}% ({count}) දින {days}කට වඩා පැරණිය.",
  },
  kpi: { openConflicts: "විවෘත ගැටුම්", criticalHigh: "බරපතල සහ ඉහළ", medianDaysToResolve: "විසඳීමට මධ්‍යස්ථ දින", agreementRate: "එකඟතා අනුපාතය", ackTimeliness: "පිළිගැනීමේ කාලෝචිතභාවය", responseTimeliness: "ප්‍රතිචාරයේ කාලෝචිතභාවය", digOnceMeters: "එක් වරක් කැණීමේ අගල" },
  def: {
    openConflicts: "ඔබේ විෂය පථයේ තත්ත්වය විවෘත, පිළිගත්, ප්‍රතිචාර බලාපොරොත්තුවෙන්, සාකච්ඡාවේ හෝ ඉහළ දැමූ ගැටුම් වාර්තා (අවස්ථා නොවේ).", criticalHigh: "වත්මන් බරපතලකම් කාණ්ඩය බරපතල හෝ ඉහළ වන විවෘත ගැටුම්.",
    medianDaysToResolve: "කාලය තුළ විසඳූ ගැටුම් සඳහා (විසඳූ දිනය − වාර්තාව සෑදූ දිනය) හි මධ්‍යස්ථය.", agreementRate: "එකඟ වූ ඉල්ලීම් ÷ (එකඟ වූ + එකඟතාවයකින් තොරව වසා දැමූ).",
    ackTimeliness: "නියමිත වේලාවට හෝ පෙර සම්පූර්ණ කළ අවශ්‍ය පිළිගැනීම් ÷ (කාලය තුළ සම්පූර්ණ කළ සියලු අවශ්‍ය පිළිගැනීම් + කාලය අද දිනය ඇතුළත් නම්, නියමිත වේලාව ඉක්මවා තවමත් පොරොත්තුවෙන් ඇති ඒවා).", responseTimeliness: "නියමිත වේලාවට හෝ පෙර දුන් අවශ්‍ය ප්‍රතිචාර ÷ (කාලය තුළ දුන් සියලු අවශ්‍ය ප්‍රතිචාර + කාලය අද දිනය ඇතුළත් නම්, නියමිත වේලාව ඉක්මවා තවමත් පොරොත්තුවෙන් ඇති ඒවා).",
    digOnceMeters: "කාලය තුළ සාක්ෂාත් කළ එක් වරක් කැණීමේ අවස්ථාවල ඇස්තමේන්තුගත හවුල් අගල් දිග. මුදල් නොව දිග පමණි.",
  },
  health: { title: "සම්බන්ධීකරණ සෞඛ්‍යය", caption: "මෙය මෙහෙයුම් දර්ශකයක් මිස කාර්ය සාධන ශ්‍රේණිගත කිරීමක් නොවේ.", insufficient: "මෙම කාලයේ අවම වශයෙන් සිද්ධි {n}ක් අවශ්‍යයි.", grade: { excellent: "විශිෂ්ට", good: "හොඳයි", needs_attention: "අවධානය අවශ්‍යයි", at_risk: "අවදානමේ" }, component: { ackTimeliness: "පිළිගැනීමේ කාලෝචිතභාවය", responseTimeliness: "ප්‍රතිචාරයේ කාලෝචිතභාවය", resolutionProgress: "විසඳුම් ප්‍රගතිය", backlogHealth: "ඉතිරි වැඩ සෞඛ්‍යය", commitmentCompletion: "බැඳීම් සම්පූර්ණ කිරීම" }, excluded: "දත්ත ප්‍රමාණවත් නැත (බැහැර කළා)", waterfall: "ලකුණු ගොඩනැගෙන ආකාරය" },
  funnel: { title: "ගැටුම් ගමන", stage: { recorded: "සටහන් කළා", acknowledged: "පිළිගත්", coordination: "සම්බන්ධීකරණය ආරම්භ", agreed: "එකඟ වූ", resolved: "විසඳූ" }, bottleneck: "බාධකය", noData: "තවම දත්ත නැත" },
  flow: { title: "නව සහ විසඳූ", created: "නව", resolved: "විසඳූ", net: "ශුද්ධ", exposureTitle: "අවදානම් නිරාවරණය", open: "විවෘත", date: "දිනය" },
  aging: { title: "ඉතිරි වැඩ වයස", empty: "විවෘත ගැටුම් නැත." },
  map: { title: "මාර්ග ස්පන්දනය", asOf: "දැනට විවෘත සිද්ධි පෙන්වයි", empty: "විෂය පථයේ විවෘත සිද්ධි නැත.", openMap: "ගැටුම්වල විවෘත කරන්න" },
  calendar: { title: "බලපෑම් දින දර්ශනය", subtitle: "ඉදිරි දින 30හි අතිච්ඡාදන වැඩ.", today: "අද" },
  scorecards: { title: "ආයතන ලකුණු පත්‍ර", mine: "මගේ ආයතන ලකුණු පත්‍රය", agency: "ආයතනය", cases: "සිද්ධි", open: "විවෘත", healthScore: "සෞඛ්‍යය", benchmarkUnavailable: "සංසන්දනය නොමැත: ආයතන ප්‍රමාණවත් නැත." },
  outcomes: { title: "ප්‍රතිඵල", empty: "මෙම කාලයේ විසඳුම් නැත." },
  digOnce: { title: "එක් වරක් කැණීම", realized: "හවුල් අගල සාක්ෂාත් කළා", caption: "අගයන් අගල් දිග මිස මුදල් ඉතිරියක් නොවේ." },
  lists: { districts: "නිරාවරණය අනුව දිස්ත්‍රික්ක", longest: "වැඩිම කාලයක් විවෘත බරපතල සහ ඉහළ", none: "පෙන්වීමට කිසිවක් නැත." },
  states: { loading: "පූරණය වෙමින්…", error: "මෙම කොටස පූරණය කළ නොහැකි විය.", retry: "නැවත උත්සාහ කරන්න", empty: "මෙම කාලයේ සම්බන්ධීකරණ ක්‍රියාකාරකම් නැත.", forbidden: "උපකරණ පුවරුවට ඔබට ප්‍රවේශය නැත." },
  customize: { title: "විජට් පෙන්වන්න හෝ සඟවන්න", reset: "සියල්ල පෙන්වන්න" },
  brief: { title: "සම්බන්ධීකරණ සාරාංශය", kpis: "ප්‍රධාන දර්ශක", signals: "සංඥා", scorecards: "ආයතන ලකුණු පත්‍ර", definitions: "අර්ථ දැක්වීම්" },
});
const TA = merge({
  title: "ஒருங்கிணைப்பு கட்டளை மையம்", subtitle: "இப்போது கவனம் தேவைப்படுவது, முரண்பாடுகள் நகரும் விதம், ஆபத்து குவியும் இடங்கள் மற்றும் முகமைகள் ஒருங்கிணைக்கும் விதம்.", nav: "முகப்புப் பலகை",
  scope: { national: "தேசியப் பார்வை", agency: "முகமைப் பார்வை" },
  range: { label: "காலம்", "7d": "7 நாட்கள்", "30d": "30 நாட்கள்", "90d": "90 நாட்கள்", "12m": "12 மாதங்கள்", custom: "தனிப்பயன்", from: "தொடக்கம்", to: "முடிவு", compare: "முந்தைய காலத்துடன் ஒப்பிடு", previous: "முந்தைய {n} நாட்களுடன்", customHelp: "இரு தேதிகளையும் தேர்ந்தெடுக்கவும் (24 மாதங்கள் வரை)." },
  filters: { agency: "முகமை", allAgencies: "அனைத்து முகமைகள்", district: "மாவட்டம்", allDistricts: "அனைத்து மாவட்டங்கள்" },
  updated: { now: "இப்போது புதுப்பிக்கப்பட்டது", min: "{n} நிமிடங்களுக்கு முன்", refresh: "புதுப்பி", stale: "இந்த எண்கள் தற்காலிகமாகச் சேமிக்கப்பட்டவை; 5 நிமிடங்களுக்கு மேல் பழையவை." },
  actions: { export: "CSV ஏற்றுமதி", brief: "சுருக்க அறிக்கை", customize: "தனிப்பயனாக்கு", print: "அச்சிடு", back: "பலகைக்குத் திரும்பு", view: "காண்க", showAll: "அனைத்தையும் காட்டு ({n})", open: "திற" },
  widgets: { attention: "இப்போது உங்களுக்குத் தேவை", signals: "சமிக்ஞைகள்", kpis: "முக்கிய குறிகாட்டிகள்", health: "ஒருங்கிணைப்பு ஆரோக்கியம்", funnel: "முரண்பாட்டுப் பயணம்", flow: "ஓட்டமும் வெளிப்பாடும்", aging: "நிலுவை வயது", map: "வழித்தட துடிப்பு", calendar: "தாக்க நாட்காட்டி", scorecards: "முகமை மதிப்பெண் அட்டைகள்", outcomes: "முடிவுகளும் ஒருமுறை தோண்டுதலும்", lists: "முதன்மைப் பட்டியல்கள்" },
  attention: { needsMyAck: "எனது ஒப்புகை தேவை", needsMyResponse: "எனது பதில் தேவை", needsMyApproval: "எனது ஒப்புதல் தேவை", overdue: "தாமதமானவை", startingSoon: "14 நாட்களுக்குள் தொடங்குபவை", allClear: "அனைத்தும் தெளிவு", title: "இப்போது உங்களுக்குத் தேவை" },
  signalsTitle: "சமிக்ஞைகள்", noSignals: "தற்போது சமிக்ஞைகள் இல்லை.", severity: { info: "தகவல்", warning: "எச்சரிக்கை", critical: "மிக முக்கியம்" },
  signal: {
    critical_starting_uncoordinated: "ஒருங்கிணைப்பு அல்லது தீர்வு இல்லாமல் {count} மிக முக்கிய அல்லது உயர் முரண்பாடுகள் 7 நாட்களுக்குள் தொடங்குகின்றன.", overdue_acks_cluster: "{agencyName}: {count} ஒப்புகைகள் தாமதம்.", overdue_acks_cluster_own: "உங்கள் முகமையின் {count} ஒப்புகைகள் தாமதம்.",
    stuck_negotiation: "{count} பேச்சுவார்த்தைகளில் {days} நாட்களுக்கு மேல் செயல்பாடு இல்லை.", approvals_overdue: "{count} ஒப்புதல் படிகள் தாமதம்.", verification_followup: "சரிபார்ப்புக்குப் பின் {count} தீர்வுகளுக்குத் தொடர் நடவடிக்கை தேவை.",
    escalated_unattended: "உயர்த்தப்பட்ட {count} கோரிக்கைகளில் {days} நாட்களாகச் செயல்பாடு இல்லை.", risk_accepted_rising: "ஏற்கப்பட்ட {count} ஆபத்துகள் இப்போது உயர் வகையில் உள்ளன.", opportunity_window_closing: "{count} ஒருமுறை தோண்டும் வாய்ப்புகள் {days} நாட்களுக்குள் முடிகின்றன.", backlog_aging: "திறந்த முரண்பாடுகளில் {percent}% ({count}) {days} நாட்களுக்கு மேல் பழையவை.",
  },
  kpi: { openConflicts: "திறந்த முரண்பாடுகள்", criticalHigh: "மிக முக்கிய மற்றும் உயர்", medianDaysToResolve: "தீர்வுக்கான இடைநிலை நாட்கள்", agreementRate: "உடன்பாட்டு விகிதம்", ackTimeliness: "ஒப்புகை நேரம் தவறாமை", responseTimeliness: "பதில் நேரம் தவறாமை", digOnceMeters: "ஒருமுறை தோண்டும் அகழி" },
  def: {
    openConflicts: "உங்கள் வரம்பில் நிலை திறந்த, ஒப்புக்கொள்ளப்பட்ட, பதிலுக்காகக் காத்திருக்கும், பேச்சுவார்த்தையில் அல்லது உயர்த்தப்பட்ட முரண்பாட்டுப் பதிவுகள் (வாய்ப்புகள் அல்ல).", criticalHigh: "தற்போதைய தீவிர வகை மிக முக்கிய அல்லது உயர் என்ற திறந்த முரண்பாடுகள்.",
    medianDaysToResolve: "காலத்தில் தீர்க்கப்பட்ட முரண்பாடுகளுக்கு (தீர்வு தேதி − பதிவு உருவான தேதி) இடைநிலை.", agreementRate: "உடன்பட்ட கோரிக்கைகள் ÷ (உடன்பட்டவை + உடன்பாடின்றி மூடியவை).",
    ackTimeliness: "குறித்த நேரத்தில் அல்லது முன் முடிக்கப்பட்ட தேவையான ஒப்புகைகள் ÷ (காலத்தில் முடிக்கப்பட்ட அனைத்து தேவையான ஒப்புகைகளும் + காலம் இன்றை உள்ளடக்கினால், குறித்த நேரம் கடந்தும் நிலுவையில் உள்ளவையும்).", responseTimeliness: "குறித்த நேரத்தில் அல்லது முன் அளிக்கப்பட்ட தேவையான பதில்கள் ÷ (காலத்தில் அளிக்கப்பட்ட அனைத்து தேவையான பதில்களும் + காலம் இன்றை உள்ளடக்கினால், குறித்த நேரம் கடந்தும் நிலுவையில் உள்ளவையும்).",
    digOnceMeters: "காலத்தில் நிறைவேற்றிய ஒருமுறை தோண்டும் வாய்ப்புகளின் மதிப்பிடப்பட்ட பகிர்ந்த அகழி நீளம். பணம் அல்ல, நீளம் மட்டுமே.",
  },
  health: { title: "ஒருங்கிணைப்பு ஆரோக்கியம்", caption: "இது செயல்பாட்டுக் குறிகாட்டி; செயல்திறன் மதிப்பீடு அல்ல.", insufficient: "இந்தக் காலத்தில் குறைந்தது {n} வழக்குகள் தேவை.", grade: { excellent: "மிகச் சிறப்பு", good: "நன்று", needs_attention: "கவனம் தேவை", at_risk: "ஆபத்தில்" }, component: { ackTimeliness: "ஒப்புகை நேரம் தவறாமை", responseTimeliness: "பதில் நேரம் தவறாமை", resolutionProgress: "தீர்வு முன்னேற்றம்", backlogHealth: "நிலுவை ஆரோக்கியம்", commitmentCompletion: "உறுதிமொழி நிறைவு" }, excluded: "போதிய தரவு இல்லை (நீக்கப்பட்டது)", waterfall: "மதிப்பெண் உருவாகும் விதம்" },
  funnel: { title: "முரண்பாட்டுப் பயணம்", stage: { recorded: "பதிவானது", acknowledged: "ஒப்புக்கொள்ளப்பட்டது", coordination: "ஒருங்கிணைப்பு தொடக்கம்", agreed: "உடன்பாடு", resolved: "தீர்க்கப்பட்டது" }, bottleneck: "தடைப்புள்ளி", noData: "இன்னும் தரவு இல்லை" },
  flow: { title: "புதியவை vs தீர்க்கப்பட்டவை", created: "புதியவை", resolved: "தீர்க்கப்பட்டவை", net: "நிகர", exposureTitle: "ஆபத்து வெளிப்பாடு", open: "திறந்த", date: "தேதி" },
  aging: { title: "நிலுவை வயது", empty: "திறந்த முரண்பாடுகள் இல்லை." },
  map: { title: "வழித்தட துடிப்பு", asOf: "இப்போதைய திறந்த வழக்குகள்", empty: "வரம்பில் திறந்த வழக்குகள் இல்லை.", openMap: "முரண்பாடுகளில் திற" },
  calendar: { title: "தாக்க நாட்காட்டி", subtitle: "அடுத்த 30 நாட்களின் ஒன்றோடொன்று மேவும் பணிகள்.", today: "இன்று" },
  scorecards: { title: "முகமை மதிப்பெண் அட்டைகள்", mine: "எனது முகமை மதிப்பெண் அட்டை", agency: "முகமை", cases: "வழக்குகள்", open: "திறந்த", healthScore: "ஆரோக்கியம்", benchmarkUnavailable: "ஒப்பீடு இல்லை: முகமைகள் போதாது." },
  outcomes: { title: "முடிவுகள்", empty: "இந்தக் காலத்தில் தீர்வுகள் இல்லை." },
  digOnce: { title: "ஒருமுறை தோண்டுதல்", realized: "பகிர்ந்த அகழி நிறைவேறியது", caption: "மதிப்புகள் அகழி நீளம்; பணச் சேமிப்பு அல்ல." },
  lists: { districts: "வெளிப்பாட்டின்படி மாவட்டங்கள்", longest: "நீண்ட காலம் திறந்துள்ள மிக முக்கிய மற்றும் உயர்", none: "காட்ட எதுவும் இல்லை." },
  states: { loading: "ஏற்றுகிறது…", error: "இந்தப் பகுதியை ஏற்ற முடியவில்லை.", retry: "மீண்டும் முயல்க", empty: "இந்தக் காலத்தில் ஒருங்கிணைப்பு செயல்பாடு இல்லை.", forbidden: "முகப்புப் பலகைக்கு உங்களுக்கு அணுகல் இல்லை." },
  customize: { title: "விட்ஜெட்களைக் காட்டு அல்லது மறை", reset: "அனைத்தையும் காட்டு" },
  brief: { title: "ஒருங்கிணைப்புச் சுருக்க அறிக்கை", kpis: "முக்கிய குறிகாட்டிகள்", signals: "சமிக்ஞைகள்", scorecards: "முகமை மதிப்பெண் அட்டைகள்", definitions: "வரையறைகள்" },
});

export function getDashCopy(locale: AuthLocale): DashCopy {
  return locale === "si" ? SI : locale === "ta" ? TA : EN;
}

/** One localized sentence for a signal. A national viewer's agency-cluster signal names the agency; an agency viewer's does not. */
export function signalText(copy: DashCopy, s: { code: string; params: Record<string, number | string> }, national: boolean): string {
  const key = s.code === "overdue_acks_cluster" && !national ? "overdue_acks_cluster_own" : s.code;
  return fmt(copy.signal[key] ?? copy.signal[s.code] ?? s.code.replace(/_/g, " "), s.params);
}

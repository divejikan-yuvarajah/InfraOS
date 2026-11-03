import type { AuthLocale } from "@/lib/auth/types";

/** Step 80 copy (keys: advisor, plans, archetypes, moves, confidence, whyNot). Codes + params come from the server; sentences are composed here. Sinhala and Tamil are drafts that fall back to English per key. */
const EN = {
  tab: "Advisor", title: "Coordination Advisor", subtitle: "Options to resolve this conflict, with the trade-offs made visible. You decide.",
  ribbon: "Suggestions only — nothing is sent or changed until you review and submit.", demoNote: "Demo and seed data only. Not official government data.",
  how: { title: "How scoring works", body: "Each plan is re-scored with the same risk engine as the Conflicts tab. The plan score is a weighted sum of seven components (0–100 each). Data confidence reflects assumptions and coverage; it is not a probability.", weights: "Weights" },
  loading: "Analysing options…", error: "The analysis could not be loaded.", retry: "Retry", forbidden: "You do not have access to this conflict.", failed: "The action could not be completed.", saved: "Saved.",
  header: { back: "Back to conflict", analysed: "Analysed {when}", reanalyse: "Re-analyse", cached: "Cached", coverage: "Coverage", assumptions: "{n} assumptions", storedOnly: "Stored pairs only", truncated: "Search was limited — results may be incomplete", flex: "Declared flexibility is not stored on requests, so it is not used.", readOnly: "This conflict is closed. The advisor is read-only.", viewerOnly: "You can read these suggestions but not act on them." },
  states: { empty: "No better arrangement found within the allowed limits.", emptyHint: "Start coordination, or try variations in the Scenario Lab.", stale: "Conflict data changed — re-analyse." },
  coordinate: { title: "Coordinate now", urgent: "Starts in {n} days", reasons: { starts_soon: "Work starts soon", ack_overdue: "An acknowledgement is overdue" } as Record<string, string>, lead: "Suggested lead", required: "Required", consulted: "Consulted", cta: "Start coordination", slots: "Meeting slots are suggested in the composer." },
  archetype: { fastest: "Fastest", leastDisruption: "Least disruption", lowestRisk: "Lowest risk", fairShare: "Fair share", jointWorks: "Joint works" } as Record<string, string>,
  archetypeHelp: { fastest: "Fewest agencies and steps.", leastDisruption: "Smallest total shift that clears a conflict.", lowestRisk: "Largest risk reduction.", fairShare: "Most even burden between agencies.", jointWorks: "Dig-once opportunity." } as Record<string, string>,
  plan: { score: "Score {s}", rank: "Option {n}", changes: "What changes", impact: "Impact", risk: "Risk {a} → {b}", clears: "Clears {c} of {f}", newC: "{n} new", worsened: "{n} worsened", shift: "{n} shift days", approval: "National approval likely", noApproval: "Agency approval only", coordinate: "Coordinate with", steps: "{n} steps", fits: "Fits before work starts", late: "May not finish before work starts", estimate: "About {n} days to complete", details: "Details", use: "Use this plan", helpful: "Helpful", notHelpful: "Not helpful", dismiss: "Dismiss", why: "Why this", components: "Score components", weight: "weight {w}%", conf: "Data confidence" },
  move: {
    shift_request: "Move {request} by {days} days ({start} → {end})", sequence_pair: "Run {request} after the other work with a {gap}-day gap ({start} → {end})", set_hours: "Switch {request} to {hours} working",
    ask: "Ask {agency} to: ", yours: "Your request", theirs: "Their request", later: "later", earlier: "earlier",
  },
  hours: { day: "day", night: "night", "24h": "24-hour" } as Record<string, string>,
  confidence: { high: "High", medium: "Medium", low: "Low", label: "Data confidence", note: "Not a probability.", points: { assumption_on_other_agency: "Assumes another agency's cooperation", incomplete_inputs: "Some inputs are incomplete", pairs_capped: "Not all stored pairs were evaluated", search_truncated: "The search was cut short", rule_version_mismatch: "Stored scores use an older rule version" } as Record<string, string> },
  approvalReasons: { third_party_new_conflicts: "Creates a new conflict for a third party", third_party_worsened: "Worsens a third party's conflict", critical_severity: "The conflict was critical at detection", long_shift: "A long shift", high_band: "A high-risk band", emergency: "Emergency" } as Record<string, string>,
  mixer: { title: "Priority mixer", help: "Re-ranks the options below on your screen. It never hides a plan.", speed: "Speed", disruption: "Low disruption", risk: "Risk reduction", fairness: "Fairness", reset: "Reset to server order", presets: { balanced: "Balanced", urgent: "Urgent", gentle: "Gentle", fair: "Fair" } as Record<string, string>, formula: "How the mixer ranks", formulaBody: "Mixed score = weighted average of your four sliders, each slider mapping to plan components: Speed = 60% coordination effort + 40% approval burden; Low disruption = 70% disruption + 30% collateral; Risk reduction = 60% risk reduction + 40% clearance; Fairness = fairness.", ranking: "Plan ranking updated: {name} first", mixed: "Mixed {s}", server: "Server order" },
  map: { title: "Trade-off map", x: "Total shift days (disruption)", y: "Risk reduction", size: "Bubble size = agencies to coordinate · dashed ring = national approval", frontier: "Best trade-offs", table: "Data table", pick: "Option {n}: {a} days, risk −{r}", list: "Ranked list" },
  drawer: { title: "Plan details", close: "Close", focus: "Conflicts affected", diff: { cleared: "Cleared", new: "New", worsened: "Worsened", improved: "Improved", unchanged: "Unchanged" } as Record<string, string>, burden: "Burden by agency", days: "{n} d", timeline: "Steps and timing", respond: "Respond within {n} days", approve: "Approvals about {n} days", feasibility: "Feasibility", own: "Your request", assumption: "Assumption — another agency's request", handoff: "Hand off to", forCoordination: "Draft coordination proposal", forResolution: "Start resolution amendment", forLab: "Try in Scenario Lab", notEligible: "Not available: {reason}", reasons: { not_required_party: "your agency is not a required party", not_own_request: "this change is to another agency's request", record_not_open: "the conflict is not open" } as Record<string, string>, before: "Before", after: "After" },
  whyNot: { title: "Why not these?", none: "Nothing was rejected.", codes: { start_in_past: "Moving the start that far back would put it in the past.", no_improvement: "This change would not reduce the risk.", creates_new_high_conflict: "This change creates a new high-risk conflict.", disruption_too_high: "This change shifts work by more than 60 days.", requires_national_approval_only_option: "This is the strongest option but needs national approval." } as Record<string, string>, ownRequest: "Your request", otherRequest: "Another agency's request" },
  opp: { title: "Dig once", trench: "≈ {km} km shared trench", lead: "Suggested lead: {agency}", cta: "Propose joint works", caption: "Trench length only, not money." },
  log: { title: "Decision log", empty: "No decisions yet.", dismissed: "Dismissed: {reason}", restore: "Restore", reasons: { not_feasible: "Not feasible", already_coordinated_offline: "Already coordinated offline", disagree_with_assessment: "Disagree with the assessment", too_disruptive: "Too disruptive", other: "Other" } as Record<string, string>, sheet: "Why dismiss this option?" },
  wizard: { title: "Schedule Advisor", hint: "Add geometry and dates to see suggestions.", none: "No conflicts expected for these dates.", loading: "Checking other works…", error: "Suggestions are unavailable.", offline: "You are offline.", ribbon: "Start-date windows", free: "Conflict-free", conflict: "Conflicts", today: "Today", current: "Your dates", summaryLater: "Moving {n} days later avoids the conflicts.", summaryEarlier: "Moving {n} days earlier avoids the conflicts.", within: "Within your flexibility", beyond: "Beyond your flexibility", use: "Use these dates", undo: "Undo", applied: "Dates updated.", agencies: "You would coordinate with", review: "Better windows available", advisory: "Advisory only — it never blocks Next or Submit.", window: "{from} to {to}", band: "Highest risk" },
  request: { title: "Request Advisor", analyse: "Analyse", fixes: "Moving this request {days} days would resolve {n} of {m} open conflicts.", none: "No single move of this request resolves a conflict.", open: "Open Advisor" },
  entry: { chip: "{n} options available", try: "From Advisor" },
  banner: "Prefilled from Advisor {recNo} — review before sending",
  warn: { pairs_capped: "Only the first stored pairs were evaluated." } as Record<string, string>,
};
export type AdvisorCopy = typeof EN;
type Patch = { [K in keyof AdvisorCopy]?: AdvisorCopy[K] extends object ? Partial<AdvisorCopy[K]> : AdvisorCopy[K] };
const merge = (p: Patch): AdvisorCopy => Object.fromEntries(Object.entries(EN).map(([k, v]) => [k, v && typeof v === "object" ? { ...v, ...((p as Record<string, object>)[k] ?? {}) } : (p as Record<string, unknown>)[k] ?? v])) as AdvisorCopy;

const SI = merge({
  tab: "උපදේශකයා", title: "සම්බන්ධීකරණ උපදේශකයා", subtitle: "මෙම ගැටුම විසඳීමට විකල්ප, ගනුදෙනු පැහැදිලිව පෙන්වමින්. තීරණය ඔබගේය.", ribbon: "යෝජනා පමණි — ඔබ සමාලෝචනය කර ඉදිරිපත් කරන තෙක් කිසිවක් යවා හෝ වෙනස් කර නැත.",
  loading: "විකල්ප විශ්ලේෂණය කරමින්…", error: "විශ්ලේෂණය පූරණය කළ නොහැකි විය.", retry: "නැවත උත්සාහ කරන්න",
  header: { reanalyse: "නැවත විශ්ලේෂණය" }, states: { empty: "අවසර ලත් සීමාවන් තුළ වඩා හොඳ සැකැස්මක් හමු නොවීය." },
  coordinate: { title: "දැන් සම්බන්ධීකරණය කරන්න", cta: "සම්බන්ධීකරණය ආරම්භ කරන්න", required: "අවශ්‍ය", consulted: "උපදෙස් ලබන" },
  archetype: { fastest: "වේගවත්ම", leastDisruption: "අවම බාධා", lowestRisk: "අවම අවදානම", fairShare: "සාධාරණ කොටස", jointWorks: "හවුල් වැඩ" },
  plan: { changes: "වෙනස් වන්නේ", impact: "බලපෑම", details: "විස්තර", use: "මෙම සැලැස්ම භාවිතා කරන්න", helpful: "ප්‍රයෝජනවත්", notHelpful: "ප්‍රයෝජනවත් නැත", dismiss: "ඉවත දමන්න", fits: "වැඩ ආරම්භයට පෙර ගැලපේ", late: "වැඩ ආරම්භයට පෙර අවසන් නොවිය හැක" },
  confidence: { high: "ඉහළ", medium: "මධ්‍යම", low: "අඩු", label: "දත්ත විශ්වාසය", note: "සම්භාවිතාවක් නොවේ." },
  mixer: { title: "ප්‍රමුඛතා මිශ්‍රකය", speed: "වේගය", disruption: "අඩු බාධා", risk: "අවදානම අඩු කිරීම", fairness: "සාධාරණත්වය", reset: "සේවාදායක අනුපිළිවෙලට යළි පිහිටුවන්න" },
  map: { title: "ගනුදෙනු සිතියම", x: "මුළු මාරු දින (බාධා)", y: "අවදානම අඩු කිරීම" },
  drawer: { title: "සැලැස්ම් විස්තර", close: "වසන්න", forCoordination: "සම්බන්ධීකරණ යෝජනාවක් කෙටුම්පත් කරන්න", forResolution: "විසඳුම් සංශෝධනය ආරම්භ කරන්න", forLab: "අවස්ථා විද්‍යාගාරයේ උත්සාහ කරන්න" },
  whyNot: { title: "මේවා නොවන්නේ ඇයි?" }, log: { title: "තීරණ ලොගය", restore: "යළි පිහිටුවන්න" },
  wizard: { title: "කාලසටහන් උපදේශකයා", none: "මෙම දින සඳහා ගැටුම් අපේක්ෂා නොකෙරේ.", use: "මෙම දින භාවිතා කරන්න", undo: "පසුගමනය" },
  request: { title: "ඉල්ලීම් උපදේශකයා", analyse: "විශ්ලේෂණය" }, banner: "උපදේශකයාගෙන් {recNo} පෙර පුරවන ලදී — යැවීමට පෙර සමාලෝචනය කරන්න",
});
const TA = merge({
  tab: "ஆலோசகர்", title: "ஒருங்கிணைப்பு ஆலோசகர்", subtitle: "இந்த முரண்பாட்டைத் தீர்க்க விருப்பங்கள், சமரசங்கள் தெளிவாகத் தெரியும். முடிவு உங்களுடையது.", ribbon: "பரிந்துரைகள் மட்டுமே — நீங்கள் மதிப்பாய்வு செய்து சமர்ப்பிக்கும் வரை எதுவும் அனுப்பப்படவோ மாற்றப்படவோ இல்லை.",
  loading: "விருப்பங்களை ஆய்வு செய்கிறது…", error: "பகுப்பாய்வை ஏற்ற முடியவில்லை.", retry: "மீண்டும் முயல்க",
  header: { reanalyse: "மீண்டும் ஆய்வு செய்" }, states: { empty: "அனுமதிக்கப்பட்ட வரம்புகளுக்குள் சிறந்த ஏற்பாடு கிடைக்கவில்லை." },
  coordinate: { title: "இப்போதே ஒருங்கிணை", cta: "ஒருங்கிணைப்பைத் தொடங்கு", required: "தேவையானவர்", consulted: "ஆலோசிக்கப்படுபவர்" },
  archetype: { fastest: "மிக விரைவான", leastDisruption: "குறைந்த இடையூறு", lowestRisk: "குறைந்த ஆபத்து", fairShare: "நியாயமான பங்கு", jointWorks: "கூட்டுப் பணிகள்" },
  plan: { changes: "மாறுவது", impact: "தாக்கம்", details: "விவரங்கள்", use: "இந்தத் திட்டத்தைப் பயன்படுத்து", helpful: "பயனுள்ளது", notHelpful: "பயனற்றது", dismiss: "நிராகரி", fits: "பணி தொடங்கும் முன் பொருந்தும்", late: "பணி தொடங்கும் முன் முடியாமல் போகலாம்" },
  confidence: { high: "உயர்", medium: "நடுத்தர", low: "குறைவு", label: "தரவு நம்பகத்தன்மை", note: "நிகழ்தகவு அல்ல." },
  mixer: { title: "முன்னுரிமைக் கலவை", speed: "வேகம்", disruption: "குறைந்த இடையூறு", risk: "ஆபத்துக் குறைப்பு", fairness: "நியாயம்", reset: "சேவையக வரிசைக்கு மீட்டமை" },
  map: { title: "சமரச வரைபடம்", x: "மொத்த மாற்ற நாட்கள் (இடையூறு)", y: "ஆபத்துக் குறைப்பு" },
  drawer: { title: "திட்ட விவரங்கள்", close: "மூடு", forCoordination: "ஒருங்கிணைப்பு முன்மொழிவை வரைக", forResolution: "தீர்வுத் திருத்தத்தைத் தொடங்கு", forLab: "சூழ்நிலை ஆய்வகத்தில் முயல்க" },
  whyNot: { title: "இவை ஏன் இல்லை?" }, log: { title: "முடிவுப் பதிவு", restore: "மீட்டமை" },
  wizard: { title: "அட்டவணை ஆலோசகர்", none: "இந்தத் தேதிகளுக்கு முரண்பாடுகள் எதிர்பார்க்கப்படவில்லை.", use: "இந்தத் தேதிகளைப் பயன்படுத்து", undo: "செயல்தவிர்" },
  request: { title: "கோரிக்கை ஆலோசகர்", analyse: "ஆய்வு செய்" }, banner: "ஆலோசகரிடமிருந்து {recNo} முன்பே நிரப்பப்பட்டது — அனுப்பும் முன் மதிப்பாய்வு செய்யவும்",
});
export function getAdvisorCopy(locale: AuthLocale): AdvisorCopy { return locale === "si" ? SI : locale === "ta" ? TA : EN; }

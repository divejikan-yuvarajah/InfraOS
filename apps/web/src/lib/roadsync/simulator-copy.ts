import type { AuthLocale } from "@/lib/auth/types";

/** Step 79 copy. Server sends codes only; sentences are composed here. Sinhala and Tamil are drafts that fall back to English per key. */
const EN = {
  title: "Scenario Lab", subtitle: "Try changes on paper and see how the risk score and nearby conflicts respond. Nothing here is created, sent or applied.",
  demoNote: "Demo and seed data only. Not official government data.", open: "Open Scenario Lab", back: "Back to conflict",
  loading: "Loading…", error: "This could not be loaded.", retry: "Retry", forbidden: "You do not have access to this conflict.", failed: "The simulation could not be completed.", savedOk: "Scenario saved.", limit: "You have reached the saved-scenario limit for this conflict.",
  lever: {
    shift: "Shift dates", hours: "Change working hours", buffer: "Add buffer days", sequence: "Sequence works", traffic: "Traffic measures", cancel: "Hypothetical cancellation", ghost: "Ghost work", replay: "Replay agreed terms",
  } as Record<string, string>,
  help: {
    shift: "Move one request to new dates.", hours: "Switch a request to day, night or 24 h working.", buffer: "Make the later work start this many days after the earlier one ends.", sequence: "Do one work first, then the other after a gap.",
    traffic: "Record measures as commitments. They do not change the risk score.", cancel: "Remove a request to see what clears.", ghost: "Place a hypothetical copy of a request at other dates, same location.", replay: "Apply the dates and hours from an agreed negotiation.",
  } as Record<string, string>,
  f: { request: "Request", first: "First", second: "Second", start: "New start", end: "New end", hours: "Working hours", days: "Days", gap: "Gap (days)", measures: "Measures", source: "Copy of", agreed: "Agreed request", remove: "Remove", add: "Add a lever", none: "No levers yet. Add one to start.", max: "Up to {n} levers.", mine: "Yours", other: "Another agency", assumption: "Assumption only", hoursOpt: { day: "Day", night: "Night", "24h": "24 hours" } as Record<string, string>, noAgreed: "No agreed negotiation to replay.", datesInvalid: "End must be after start." },
  measures: { flaggers: "Flaggers", night_work: "Night work", lane_staging: "Lane staging", detour_signage: "Detour signage", temporary_signals: "Temporary signals", public_notice: "Public notice" } as Record<string, string>,
  run: "Run simulation", running: "Simulating…", baseline: "Baseline", result: "Result",
  verdict: { clears: "Clears this conflict", lowers: "Lowers the risk", none: "No change", raises: "Raises the risk" } as Record<string, string>,
  pair: "This conflict", request: "Everything these requests touch", third: "Nearby conflicts", score: "Score {a} → {b}", riskIndex: "Risk index {a} → {b}", conflictsCount: "Conflicts {a} → {b}", newC: "New: {n}", worsened: "Worsened: {n}", cleared: "Cleared: {n}", ghost: "Ghost work would create {n} conflicts across {p} pairs", ghostNone: "Ghost work creates no new conflicts.",
  kind: { conflict: "Conflict", opportunity: "Opportunity", advisory: "Advisory" } as Record<string, string>,
  warn: { lever_overridden: "A later lever replaced an earlier one on the same request.", replayed_agreed_terms: "Agreed terms were replayed as levers.", traffic_no_score_effect: "Traffic measures are commitments only; they do not change the score.", pairs_capped: "Only the first stored pairs were evaluated." } as Record<string, string>,
  assumptionNote: "This scenario assumes changes to another agency's work. It is for understanding only and cannot be sent to a composer.",
  actionable: "Based on your own requests only", coverage: "Covers stored pairs only.",
  compare: { title: "Compare scenarios", add: "Add to comparison", full: "Comparison is full ({n}).", clear: "Clear", empty: "Run a scenario and add it to compare.", label: "Scenario {n}", metric: "Metric", band: "Band", verdict: "Verdict", pairAfter: "Pair score after", newC: "New conflicts", worsened: "Worsened", cleared: "Cleared", total: "Conflicts after" },
  saved: { title: "Saved scenarios", empty: "No saved scenarios.", save: "Save this scenario", name: "Name", visibility: "Visible to", load: "Load", delete: "Delete", snapshot: "Snapshot from {when}", vis: { private: "Only me", agency: "My agency", national: "National staff" } as Record<string, string>, note: "Saved scenarios keep levers and the scores, bands and counts only." },
};
export type SimCopy = typeof EN;
type Patch = { [K in keyof SimCopy]?: SimCopy[K] extends object ? Partial<SimCopy[K]> : SimCopy[K] };
const merge = (p: Patch): SimCopy => Object.fromEntries(Object.entries(EN).map(([k, v]) => [k, v && typeof v === "object" ? { ...v, ...((p as Record<string, object>)[k] ?? {}) } : (p as Record<string, unknown>)[k] ?? v])) as SimCopy;

const SI = merge({
  title: "අවස්ථා විමර්ශන විද්‍යාගාරය", subtitle: "වෙනස්කම් කඩදාසියේ උත්සාහ කර අවදානම් ලකුණු සහ ආසන්න ගැටුම් ප්‍රතිචාර දක්වන ආකාරය බලන්න. මෙහි කිසිවක් සාදන, යවන හෝ යොදන්නේ නැත.", open: "අවස්ථා විද්‍යාගාරය විවෘත කරන්න", back: "ගැටුමට ආපසු", loading: "පූරණය වෙමින්…", retry: "නැවත උත්සාහ කරන්න",
  lever: { shift: "දින මාරු කරන්න", hours: "වැඩ කරන වේලාව වෙනස් කරන්න", buffer: "ආරක්ෂිත දින එක් කරන්න", sequence: "වැඩ අනුපිළිවෙල", traffic: "ගමනාගමන ක්‍රම", cancel: "උපකල්පිත අවලංගු කිරීම", ghost: "අවතාර වැඩ", replay: "එකඟ වූ නියමයන් නැවත ක්‍රියාත්මක කරන්න" },
  run: "අනුකරණය ක්‍රියාත්මක කරන්න", verdict: { clears: "මෙම ගැටුම පහළ කරයි", lowers: "අවදානම අඩු කරයි", none: "වෙනසක් නැත", raises: "අවදානම ඉහළ දමයි" }, f: { add: "ලීවරයක් එක් කරන්න", remove: "ඉවත් කරන්න", assumption: "උපකල්පනයක් පමණි", mine: "ඔබේ", other: "වෙනත් ආයතනයක්" },
  compare: { title: "අවස්ථා සසඳන්න", add: "සංසන්දනයට එක් කරන්න" }, saved: { title: "සුරකින ලද අවස්ථා", save: "මෙම අවස්ථාව සුරකින්න", load: "පූරණය", delete: "මකන්න", vis: { private: "මා පමණි", agency: "මගේ ආයතනය", national: "ජාතික කාර්ය මණ්ඩලය" } },
});
const TA = merge({
  title: "சூழ்நிலை ஆய்வகம்", subtitle: "மாற்றங்களைக் காகிதத்தில் முயன்று ஆபத்து மதிப்பெண்ணும் அருகிலுள்ள முரண்பாடுகளும் எவ்வாறு மாறுகின்றன எனப் பாருங்கள். இங்கு எதுவும் உருவாக்கப்படுவதோ அனுப்பப்படுவதோ செயல்படுத்தப்படுவதோ இல்லை.", open: "சூழ்நிலை ஆய்வகத்தைத் திற", back: "முரண்பாட்டுக்குத் திரும்பு", loading: "ஏற்றுகிறது…", retry: "மீண்டும் முயல்க",
  lever: { shift: "தேதிகளை மாற்று", hours: "வேலை நேரத்தை மாற்று", buffer: "இடைவெளி நாட்களைச் சேர்", sequence: "பணிகளை வரிசைப்படுத்து", traffic: "போக்குவரத்து நடவடிக்கைகள்", cancel: "அனுமான ரத்து", ghost: "மாதிரிப் பணி", replay: "உடன்பட்ட நிபந்தனைகளை மீள்செயல்" },
  run: "உருவகப்படுத்தலை இயக்கு", verdict: { clears: "இந்த முரண்பாட்டை நீக்கும்", lowers: "ஆபத்தைக் குறைக்கும்", none: "மாற்றமில்லை", raises: "ஆபத்தை உயர்த்தும்" }, f: { add: "நெம்புகோலைச் சேர்", remove: "நீக்கு", assumption: "அனுமானம் மட்டுமே", mine: "உங்களுடையது", other: "மற்றொரு முகமை" },
  compare: { title: "சூழ்நிலைகளை ஒப்பிடு", add: "ஒப்பீட்டில் சேர்" }, saved: { title: "சேமித்த சூழ்நிலைகள்", save: "இந்தச் சூழ்நிலையைச் சேமி", load: "ஏற்று", delete: "நீக்கு", vis: { private: "நான் மட்டும்", agency: "எனது முகமை", national: "தேசியப் பணியாளர்" } },
});
export function getSimCopy(locale: AuthLocale): SimCopy {
  return locale === "si" ? SI : locale === "ta" ? TA : EN;
}

import type { AuthLocale } from "@/lib/auth/types";

export interface RiskCopy {
  tab: string;
  dashboardTitle: string;
  dashboardSub: string;
  header: {
    assessAll: string;
    assessingAll: string;
    exportCsv: string;
    methodology: string;
    lastRun: string;
    neverRun: string;
    running: string;
    scopeNational: string;
    scopeAgency: string;
  };
  honesty: {
    rulePointsTooltip: string;
    advisoryNote: string;
    notPredictionModel: string;
    aiNarrativeDisclaimer: string;
  };
  metrics: {
    totalAssessed: string;
    critical: string;
    high: string;
    moderate: string;
    low: string;
    notAssessable: string;
    stale: string;
    unacknowledged: string;
  };
  charts: {
    finVsPhysTitle: string;
    finVsPhysSub: string;
    parityLine: string;
    financialAhead: string;
    toggleTable: string;
    toggleChart: string;
    portfolioTrendTitle: string;
    portfolioTrendSub: string;
    collectingHistory: string;
    categoryBreakdownTitle: string;
    categoryBreakdownSub: string;
  };
  filters: {
    searchPlaceholder: string;
    agency: string;
    allAgencies: string;
    projectType: string;
    allTypes: string;
    status: string;
    allStatuses: string;
    level: string;
    allLevels: string;
    category: string;
    allCategories: string;
    sufficiency: string;
    allSufficiencies: string;
    resolution: string;
    allResolutions: string;
    staleOnly: string;
    district: string;
    allDistricts: string;
    reset: string;
  };
  table: {
    title: string;
    project: string;
    agency: string;
    level: string;
    categories: string;
    topIndicator: string;
    progress: string;
    assessed: string;
    resolution: string;
    actions: string;
    emptyTitle: string;
    emptySub: string;
    openDrawer: string;
    assessNow: string;
    assessing: string;
    openProject: string;
    openFinance: string;
    openRoadSync: string;
    showingResults: string;
  };
  drawer: {
    title: string;
    assessNow: string;
    rulePoints: string;
    basedOnCategories: string;
    indicators: string;
    recommendations: string;
    missingData: string;
    aiNarrative: string;
    history: string;
    howCalculated: string;
    evidence: string;
    resolutionAction: string;
    unresolvedCount: string;
    reopenedBadge: string;
    regenerate: string;
    generating: string;
    aiUnavailable: string;
  };
  resolutionDialog: {
    title: string;
    sub: string;
    statusLabel: string;
    noteLabel: string;
    notePlaceholder: string;
    noteHelp: string;
    reviewAtLabel: string;
    assignedToLabel: string;
    submit: string;
    cancel: string;
    teamActionNotice: string;
  };
  history: {
    timelineTitle: string;
    compareTitle: string;
    from: string;
    to: string;
    compareBtn: string;
    changes: string;
    noChanges: string;
  };
}

export const RISK_COPY: Record<AuthLocale, RiskCopy> = {
  en: {
    tab: "Risk Intelligence",
    dashboardTitle: "Explainable Risk Intelligence",
    dashboardSub: "Deterministic rule-based baseline monitoring delays, budgets, milestones, and cross-agency corridor conflicts.",
    header: {
      assessAll: "Assess All in Scope",
      assessingAll: "Assessing Portfolio…",
      exportCsv: "Export CSV",
      methodology: "Methodology & Rules",
      lastRun: "Last Scheduled Run",
      neverRun: "No runs recorded",
      running: "Run in progress…",
      scopeNational: "National Scope",
      scopeAgency: "Agency Scope",
    },
    honesty: {
      rulePointsTooltip: "Not a probability. Sum of rule-points triggered by objective evidence thresholds.",
      advisoryNote: "Advisory only — decisions remain with authorised government officers.",
      notPredictionModel: "Rule-based baseline. Not a prediction model. No accuracy claim.",
      aiNarrativeDisclaimer: "AI-generated plain-language explanation of the calculated indicators — verify against evidence below.",
    },
    metrics: {
      totalAssessed: "Projects Assessed",
      critical: "Critical Risk",
      high: "High Risk",
      moderate: "Moderate Risk",
      low: "Low Risk",
      notAssessable: "Not Assessable",
      stale: "Stale (> 7d)",
      unacknowledged: "Unacknowledged High+",
    },
    charts: {
      finVsPhysTitle: "Financial vs Physical Progress Map",
      finVsPhysSub: "Identifies early spending anomalies where financial disbursements outpace verified site work.",
      parityLine: "Parity line (Fin % = Phys %)",
      financialAhead: "Financial ahead of physical zone",
      toggleTable: "Switch to Table View",
      toggleChart: "Switch to Scatter View",
      portfolioTrendTitle: "Portfolio Risk Trend",
      portfolioTrendSub: "Weekly distribution of risk severity across active projects.",
      collectingHistory: "Collecting history — requires ≥ 3 weekly snapshots for full trend analysis.",
      categoryBreakdownTitle: "Category Risk Exposure",
      categoryBreakdownSub: "Number of projects flagged with High or Critical indicators per category.",
    },
    filters: {
      searchPlaceholder: "Search by project code, title, or contractor…",
      agency: "Agency",
      allAgencies: "All Agencies",
      projectType: "Project Type",
      allTypes: "All Types",
      status: "Status",
      allStatuses: "All Statuses",
      level: "Risk Level",
      allLevels: "All Levels",
      category: "Category Flag",
      allCategories: "All Categories",
      sufficiency: "Data Sufficiency",
      allSufficiencies: "All Data States",
      resolution: "Resolution State",
      allResolutions: "All Triage States",
      staleOnly: "Stale Only (>7d)",
      district: "District",
      allDistricts: "All Districts",
      reset: "Reset Filters",
    },
    table: {
      title: "Monitored Infrastructure Projects",
      project: "Project",
      agency: "Agency",
      level: "Risk Level",
      categories: "Categories",
      topIndicator: "Headline Trigger",
      progress: "Physical / Financial",
      assessed: "Last Assessed",
      resolution: "Resolution",
      actions: "Actions",
      emptyTitle: "No projects match the selected filters",
      emptySub: "Try widening your filter selections or refreshing the portfolio.",
      openDrawer: "View Risk Analysis",
      assessNow: "Assess Now",
      assessing: "Evaluating…",
      openProject: "Open Project Record",
      openFinance: "View Finance Workspace",
      openRoadSync: "View RoadSync Conflicts",
      showingResults: "Showing {from}–{to} of {total} projects",
    },
    drawer: {
      title: "Project Risk Intelligence Analysis",
      assessNow: "Assess Now",
      rulePoints: "Rule-points Index",
      basedOnCategories: "Based on {n} of 5 assessable categories",
      indicators: "Triggered Indicators",
      recommendations: "Advisory Recommendations",
      missingData: "Data Gaps & Completeness",
      aiNarrative: "Plain Language Narrative (AI)",
      history: "Assessment History",
      howCalculated: "How Calculated",
      evidence: "Grounding Evidence",
      resolutionAction: "Resolution Status",
      unresolvedCount: "{n} unacknowledged risks",
      reopenedBadge: "Reopened due to escalation",
      regenerate: "Regenerate",
      generating: "Generating verified narrative…",
      aiUnavailable: "AI narrative service unavailable. Deterministic rule explanations remain active.",
    },
    resolutionDialog: {
      title: "Update Risk Triage Status",
      sub: "Acknowledge, track progress, or document resolution. Note: Resolution triage does not modify calculated mathematical risk indicators.",
      statusLabel: "Triage Status",
      noteLabel: "Action Note / Justification",
      notePlaceholder: "Document investigation findings, operational mitigation actions, or justification…",
      noteHelp: "Minimum 12 characters required when marking as Resolved or Dismissed.",
      reviewAtLabel: "Follow-up Revisit Date",
      assignedToLabel: "Assigned Officer",
      submit: "Save Triage Status",
      cancel: "Cancel",
      teamActionNotice: "Team actions are logged for governance audit trails and do not alter underlying rule points.",
    },
    history: {
      timelineTitle: "Assessment Snapshots Timeline",
      compareTitle: "Side-by-side Assessment Diff",
      from: "Baseline Snapshot",
      to: "Comparison Snapshot",
      compareBtn: "Compare Snapshots",
      changes: "Detected Changes",
      noChanges: "No indicator or severity changes detected in this evaluation.",
    },
  },
  si: {
    tab: "අවදානම් බුද්ධිය",
    dashboardTitle: "පැහැදිලි කළ හැකි අවදානම් බුද්ධිය",
    dashboardSub: "ප්‍රමාදයන්, මූල්‍ය වියදම්, සන්ධිස්ථාන සහ ආයතන අතර මාර්ග ගැටුම් නිරීක්ෂණය කරන නීති-පාදක පද්ධතිය.",
    header: {
      assessAll: "සියලු ව්‍යාපෘති තක්සේරු කරන්න",
      assessingAll: "තක්සේරු කරමින්…",
      exportCsv: "CSV අපනයනය",
      methodology: "ක්‍රමවේදය සහ නීති",
      lastRun: "අවසාන සැලසුම්ගත ධාවනය",
      neverRun: "ධාවනයක් සටහන් වී නැත",
      running: "ධාවනය වෙමින් පවතී…",
      scopeNational: "ජාතික විෂය පථය",
      scopeAgency: "ආයතන විෂය පථය",
    },
    honesty: {
      rulePointsTooltip: "සම්භාවිතාවක් නොවේ. වෛෂයික සාක්ෂි සීමාවන් මගින් ක්‍රියාත්මක වූ නීති ලකුණු වල එකතුව.",
      advisoryNote: "උපදේශාත්මක පමණි — තීරණ බලයලත් රාජ්‍ය නිලධාරීන් සතුය.",
      notPredictionModel: "නීති-පාදක මූලික පද්ධතියකි. අනාවැකි ආකෘතියක් නොවේ. නිරවද්‍යතා හිමිකම් නොමැත.",
      aiNarrativeDisclaimer: "ගණනය කළ දර්ශක පිළිබඳ AI විසින් ජනනය කරන ලද පැහැදිලි කිරීම — පහත සාක්ෂි සමඟ සසඳන්න.",
    },
    metrics: {
      totalAssessed: "තක්සේරු කළ ව්‍යාපෘති",
      critical: "අතිශය අවදානම්",
      high: "ඉහළ අවදානම්",
      moderate: "මධ්‍යම අවදානම්",
      low: "අඩු අවදානම්",
      notAssessable: "තක්සේරු කළ නොහැකි",
      stale: "යල් පැන ගිය (> 7දින)",
      unacknowledged: "තහවුරු නොකළ ඉහළ අවදානම්",
    },
    charts: {
      finVsPhysTitle: "මූල්‍ය සහ භෞතික ප්‍රගති සිතියම",
      finVsPhysSub: "භෞතික වැඩට වඩා මූල්‍ය ගෙවීම් ඉක්මවා යන මුල් වියදම් විෂමතා හඳුනා ගනී.",
      parityLine: "සමතුලිතතා රේඛාව (මූල්‍ය % = භෞතික %)",
      financialAhead: "මූල්‍ය වියදම් ඉදිරියෙන් ඇති කලාපය",
      toggleTable: "වගු දසුනට මාරු වන්න",
      toggleChart: "ප්‍රස්තාර දසුනට මාරු වන්න",
      portfolioTrendTitle: "පෝට්ෆෝලියෝ අවදානම් ප්‍රවණතාව",
      portfolioTrendSub: "ක්‍රියාකාරී ව්‍යාපෘතිවල අවදානම් තීව්‍රතාවයේ සතිපතා ව්‍යාප්තිය.",
      collectingHistory: "ඉතිහාස දත්ත රැස් කරමින් — ප්‍රවණතා විශ්ලේෂණය සඳහා සතිපතා දත්ත 3ක් අවශ්‍ය වේ.",
      categoryBreakdownTitle: "ප්‍රවර්ග අවදානම් නිරාවරණය",
      categoryBreakdownSub: "එක් එක් ප්‍රවර්ගය යටතේ ඉහළ හෝ අතිශය අවදානම් දර්ශක සහිත ව්‍යාපෘති ගණන.",
    },
    filters: {
      searchPlaceholder: "ව්‍යාපෘති කේතය, නම හෝ කොන්ත්‍රාත්කරු සොයන්න…",
      agency: "ආයතනය",
      allAgencies: "සියලුම ආයතන",
      projectType: "ව්‍යාපෘති වර්ගය",
      allTypes: "සියලු වර්ග",
      status: "තත්ත්වය",
      allStatuses: "සියලු තත්ත්වයන්",
      level: "අවදානම් මට්ටම",
      allLevels: "සියලු මට්ටම්",
      category: "ප්‍රවර්ගය",
      allCategories: "සියලු ප්‍රවර්ග",
      sufficiency: "දත්ත ප්‍රමාණවත්භාවය",
      allSufficiencies: "සියලු තත්ත්වයන්",
      resolution: "විසඳුම් තත්ත්වය",
      allResolutions: "සියලු විසඳුම්",
      staleOnly: "යල් පැන ගිය පමණි (>7දින)",
      district: "දිස්ත්‍රික්කය",
      allDistricts: "සියලු දිස්ත්‍රික්ක",
      reset: "පෙරහන් යළි සකසන්න",
    },
    table: {
      title: "නිරීක්ෂණය කරන යටිතල පහසුකම් ව්‍යාපෘති",
      project: "ව්‍යාපෘතිය",
      agency: "ආයතනය",
      level: "අවදානම් මට්ටම",
      categories: "ප්‍රවර්ග",
      topIndicator: "ප්‍රධාන හේතුව",
      progress: "භෞතික / මූල්‍ය",
      assessed: "අවසන් තක්සේරුව",
      resolution: "විසඳුම",
      actions: "ක්‍රියාමාර්ග",
      emptyTitle: "තෝරාගත් පෙරහන් වලට ගැළපෙන ව්‍යාපෘති නැත",
      emptySub: "පෙරහන් පුළුල් කිරීමට උත්සාහ කරන්න.",
      openDrawer: "අවදානම් විශ්ලේෂණය බලන්න",
      assessNow: "දැන් තක්සේරු කරන්න",
      assessing: "තක්සේරු කරමින්…",
      openProject: "ව්‍යාපෘති වාර්තාව විවෘත කරන්න",
      openFinance: "මූල්‍ය වැඩබිම බලන්න",
      openRoadSync: "RoadSync ගැටුම් බලන්න",
      showingResults: "ව්‍යාපෘති {total} න් {from}–{to} දක්වා පෙන්වයි",
    },
    drawer: {
      title: "ව්‍යාපෘති අවදානම් බුද්ධි විශ්ලේෂණය",
      assessNow: "දැන් තක්සේරු කරන්න",
      rulePoints: "නීති ලකුණු දර්ශකය",
      basedOnCategories: "තක්සේරු කළ හැකි ප්‍රවර්ග 5 න් {n} ක් මත පදනම්ව",
      indicators: "ක්‍රියාත්මක වූ දර්ශක",
      recommendations: "උපදේශාත්මක නිර්දේශ",
      missingData: "දත්ත හිඩැස් සහ සම්පූර්ණත්වය",
      aiNarrative: "සරල භාෂා පැහැදිලි කිරීම (AI)",
      history: "තක්සේරු ඉතිහාසය",
      howCalculated: "ගණනය කළ ආකාරය",
      evidence: "මූලික සාක්ෂි",
      resolutionAction: "විසඳුම් තත්ත්වය",
      unresolvedCount: "තහවුරු නොකළ අවදානම් {n}",
      reopenedBadge: "උග්‍රවීම හේතුවෙන් යළි විවෘත විය",
      regenerate: "යළි ජනනය කරන්න",
      generating: "තහවුරු කළ විස්තරය ජනනය කරමින්…",
      aiUnavailable: "AI සේවාව ක්‍රියා විරහිතයි. නීති-පාදක පැහැදිලි කිරීම් ක්‍රියාත්මකයි.",
    },
    resolutionDialog: {
      title: "අවදානම් තත්ත්වය යාවත්කාලීන කරන්න",
      sub: "ක්‍රියාමාර්ග සටහන් කරන්න. සටහන: විසඳුම් තත්ත්වය ගණනය කළ අවදානම් ලකුණු වෙනස් නොකරයි.",
      statusLabel: "තත්ත්වය",
      noteLabel: "ක්‍රියාමාර්ග සටහන / සාධාරණීකරණය",
      notePlaceholder: "විමර්ශන සොයාගැනීම් හෝ ක්‍රියාමාර්ග සටහන් කරන්න…",
      noteHelp: "විසඳූ හෝ බැහැර කළ ලෙස සටහන් කිරීමේදී අවම වශයෙන් අක්ෂර 12 ක් අවශ්‍ය වේ.",
      reviewAtLabel: "යළි සලකා බැලීමේ දිනය",
      assignedToLabel: "පැවරුණු නිලධාරියා",
      submit: "තත්ත්වය සුරකින්න",
      cancel: "අවලංගු කරන්න",
      teamActionNotice: "කණ්ඩායම් ක්‍රියාමාර්ග විගණන ලොගය සඳහා සටහන් වන අතර අවදානම් ලකුණු වෙනස් නොකරයි.",
    },
    history: {
      timelineTitle: "තක්සේරු ඉතිහාස කාලරේඛාව",
      compareTitle: "තක්සේරු සංසන්දනය",
      from: "මූලික තක්සේරුව",
      to: "සංසන්දනාත්මක තක්සේරුව",
      compareBtn: "සංසන්දනය කරන්න",
      changes: "හඳුනාගත් වෙනස්කම්",
      noChanges: "මෙම තක්සේරුවේ කිසිදු වෙනසක් හඳුනාගෙන නොමැත.",
    },
  },
  ta: {
    tab: "இடர் நுண்ணறிவு",
    dashboardTitle: "விளக்கக்கூடிய இடர் நுண்ணறிவு",
    dashboardSub: "தாமதங்கள், வரவுசெலவு செலவுகள், மைல்கற்கள் மற்றும் முகமை இடையேயான முரண்பாடுகளைக் கண்காணிக்கும் விதிமுறை அடிப்படையிலான அமைப்பு.",
    header: {
      assessAll: "அனைத்து திட்டங்களையும் மதிப்பிடுக",
      assessingAll: "மதிப்பிடப்படுகிறது…",
      exportCsv: "CSV ஏற்றுமதி",
      methodology: "முறையியல் மற்றும் விதிகள்",
      lastRun: "கடைசி திட்டமிடப்பட்ட இயக்கம்",
      neverRun: "இயக்கங்கள் பதிவு செய்யப்படவில்லை",
      running: "இயக்கத்தில் உள்ளது…",
      scopeNational: "தேசிய வரம்பு",
      scopeAgency: "முகமை வரம்பு",
    },
    honesty: {
      rulePointsTooltip: "நிகழ்தகவு அல்ல. புறநிலை ஆதார வரம்புகளால் தூண்டப்பட்ட விதிப் புள்ளிகளின் கூட்டுத்தொகை.",
      advisoryNote: "ஆலோசனை மட்டுமே — முடிவுகள் அங்கீகரிக்கப்பட்ட அரசு அதிகாரிகளிடமே இருக்கும்.",
      notPredictionModel: "விதிமுறை அடிப்படையிலான அடிப்படை அமைப்பு. முன்கணிப்பு மாதிரி அல்ல. துல்லியக் கோரிக்கை இல்லை.",
      aiNarrativeDisclaimer: "கணக்கிடப்பட்ட குறிகாட்டிகள் குறித்த AI விளக்கம் — கீழேயுள்ள ஆதாரங்களுடன் ஒப்பிட்டு சரிபார்க்கவும்.",
    },
    metrics: {
      totalAssessed: "மதிப்பிடப்பட்ட திட்டங்கள்",
      critical: "மிகவும் தீவிர இடர்",
      high: "அதிக இடர்",
      moderate: "மிதமான இடர்",
      low: "குறைந்த இடர்",
      notAssessable: "மதிப்பிட முடியாதவை",
      stale: "பழையவை (> 7 நாட்கள்)",
      unacknowledged: "ஏற்கப்படாத அதிக இடர்கள்",
    },
    charts: {
      finVsPhysTitle: "நிதி மற்றும் கள முன்னேற்ற வரைபடம்",
      finVsPhysSub: "களப் பணிகளை விட நிதிச் செலவுகள் முந்தும் ஆரம்பக்கட்ட செலவு முறைகேடுகளைக் கண்டறிகிறது.",
      parityLine: "சமநிலை கோடு (நிதி % = கள %)",
      financialAhead: "நிதிச் செலவு முன்னிலையில் உள்ள மண்டலம்",
      toggleTable: "அட்டவணைப் பார்வைக்கு மாறு",
      toggleChart: "வரைபடப் பார்வைக்கு மாறு",
      portfolioTrendTitle: "திட்ட இடர் போக்கு",
      portfolioTrendSub: "செயலில் உள்ள திட்டங்களில் வாராந்திர இடர் தீவிர விநியோகம்.",
      collectingHistory: "வரலாற்றுத் தரவு சேகரிக்கப்படுகிறது — போக்கு பகுப்பாய்விற்கு குறைந்தது 3 வாராந்திர தரவுகள் தேவை.",
      categoryBreakdownTitle: "பிரிவு இடர் வெளிப்பாடு",
      categoryBreakdownSub: "ஒவ்வொரு பிரிவிலும் அதிக அல்லது தீவிர இடர் குறிகாட்டிகள் கொண்ட திட்டங்களின் எண்ணிக்கை.",
    },
    filters: {
      searchPlaceholder: "திட்டக் குறியீடு, தலைப்பு அல்லது ஒப்பந்ததாரர் மூலம் தேடுக…",
      agency: "முகமை",
      allAgencies: "அனைத்து முகமைகள்",
      projectType: "திட்ட வகை",
      allTypes: "அனைத்து வகைகள்",
      status: "நிலை",
      allStatuses: "அனைத்து நிலைகளும்",
      level: "இடர் நிலை",
      allLevels: "அனைத்து நிலைகளும்",
      category: "பிரிவு இடர்",
      allCategories: "அனைத்து பிரிவுகளும்",
      sufficiency: "தரவுப் போதுமான தன்மை",
      allSufficiencies: "அனைத்து தரவு நிலைகளும்",
      resolution: "தீர்வு நிலை",
      allResolutions: "அனைத்து தீர்வு நிலைகளும்",
      staleOnly: "பழையவை மட்டும் (>7 நாட்கள்)",
      district: "மாவட்டம்",
      allDistricts: "அனைத்து மாவட்டங்களும்",
      reset: "வடிகட்டிகளை மீட்டமை",
    },
    table: {
      title: "கண்காணிக்கப்படும் உள்கட்டமைப்பு திட்டங்கள்",
      project: "திட்டம்",
      agency: "முகமை",
      level: "இடர் நிலை",
      categories: "பிரிவுகள்",
      topIndicator: "முக்கிய காரணம்",
      progress: "களம் / நிதி",
      assessed: "கடைசி மதிப்பீடு",
      resolution: "தீர்வு",
      actions: "செயல்கள்",
      emptyTitle: "தேர்ந்தெடுக்கப்பட்ட வடிகட்டிகளுக்கு பொருந்தும் திட்டங்கள் இல்லை",
      emptySub: "வடிகட்டிகளை தளர்த்தி மீண்டும் முயற்சிக்கவும்.",
      openDrawer: "இடர் பகுப்பாய்வை காண்க",
      assessNow: "இப்போது மதிப்பிடுக",
      assessing: "மதிப்பிடப்படுகிறது…",
      openProject: "திட்ட பதிவை திறக்க",
      openFinance: "நிதி பணியிடத்தை காண்க",
      openRoadSync: "RoadSync முரண்பாடுகளை காண்க",
      showingResults: "{total} திட்டங்களில் {from}–{to} காட்டப்படுகிறது",
    },
    drawer: {
      title: "திட்ட இடர் நுண்ணறிவு பகுப்பாய்வு",
      assessNow: "இப்போது மதிப்பிடுக",
      rulePoints: "விதிப் புள்ளிகள் குறியீடு",
      basedOnCategories: "மதிப்பிடக்கூடிய 5 பிரிவுகளில் {n} அடிப்படையில்",
      indicators: "தூண்டப்பட்ட குறிகாட்டிகள்",
      recommendations: "ஆலோசனை பரிந்துரைகள்",
      missingData: "தரவு இடைவெளிகள் மற்றும் முழுமை",
      aiNarrative: "எளிய மொழி விளக்கம் (AI)",
      history: "மதிப்பீட்டு வரலாறு",
      howCalculated: "கணக்கிடப்பட்ட முறை",
      evidence: "அடிப்படை ஆதாரங்கள்",
      resolutionAction: "தீர்வு நிலை",
      unresolvedCount: "{n} தீர்க்கப்படாத இடர்கள்",
      reopenedBadge: "தீவிரம் அதிகரித்ததால் மீண்டும் திறக்கப்பட்டது",
      regenerate: "மீண்டும் உருவாக்கு",
      generating: "சரிபார்க்கப்பட்ட விளக்கம் உருவாக்கப்படுகிறது…",
      aiUnavailable: "AI சேவை செயல்படவில்லை. விதிமுறை அடிப்படையிலான விளக்கங்கள் செயலில் உள்ளன.",
    },
    resolutionDialog: {
      title: "இடர் தீர்வு நிலையை புதுப்பிக்குக",
      sub: "நடவடிக்கைகளை பதிவு செய்க. குறிப்பு: தீர்வு நிலை கணக்கிடப்பட்ட கணித இடர் புள்ளிகளை மாற்றாது.",
      statusLabel: "தீர்வு நிலை",
      noteLabel: "நடவடிக்கை குறிப்பு / காரணம்",
      notePlaceholder: "விசாரணை முடிவுகள் அல்லது தணிப்பு நடவடிக்கைகளை பதிவு செய்க…",
      noteHelp: "தீர்க்கப்பட்டது அல்லது தள்ளுபடி செய்யப்பட்டது என குறிக்கும் போது குறைந்தது 12 எழுத்துகள் தேவை.",
      reviewAtLabel: "மறுபரிசீலனை தேதி",
      assignedToLabel: "நியமிக்கப்பட்ட அதிகாரி",
      submit: "நிலையை சேமிக்க",
      cancel: "ரத்து செய்",
      teamActionNotice: "குழு நடவடிக்கைகள் தணிக்கைக்காக பதிவு செய்யப்படுகின்றன, மேலும் அவை அடிப்படை இடர் புள்ளிகளை மாற்றாது.",
    },
    history: {
      timelineTitle: "மதிப்பீட்டு வரலாற்று காலவரிசை",
      compareTitle: "மதிப்பீட்டு ஒப்பீடு",
      from: "அடிப்படை மதிப்பீடு",
      to: "ஒப்பீட்டு மதிப்பீடு",
      compareBtn: "ஒப்பீடு செய்க",
      changes: "கண்டறியப்பட்ட மாற்றங்கள்",
      noChanges: "இந்த மதிப்பீட்டில் எந்த மாற்றமும் கண்டறியப்படவில்லை.",
    },
  },
};

export function getRiskCopy(locale: AuthLocale = "en"): RiskCopy {
  return RISK_COPY[locale] ?? RISK_COPY.en;
}

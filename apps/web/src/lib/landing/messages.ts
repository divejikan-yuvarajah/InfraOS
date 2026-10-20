import type { PublicLocale } from "./locales";

export type PublicLandingCopy = {
  metaTitle: string;
  metaDescription: string;
  skipToMain: string;
  homeLinkLabel: string;
  demoBanner: string;
  languageNavLabel: string;
  primaryNavLabel: string;
  openMenu: string;
  closeMenu: string;
  menuTitle: string;
  nav: {
    home: string;
    problem: string;
    solution: string;
    example: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
    modules: string;
    prototypeNote: string;
    ctaPrimaryLabel: string;
  };
  illustration: {
    title: string;
    description: string;
    pipeline: string;
    resurfacing: string;
    overlap: string;
    caption: string;
    pending: string;
    critical: string;
    resolved: string;
  };
  problem: {
    eyebrow: string;
    title: string;
    intro: string;
    cards: readonly {
      id: string;
      title: string;
      body: string;
      badge: string;
      variant: "critical" | "warning" | "info" | "neutral";
    }[];
  };
  solution: {
    eyebrow: string;
    title: string;
    intro: string;
    flowLabel: string;
    flowSteps: readonly { id: string; title: string; body: string }[];
    contrastTitle: string;
    withoutTitle: string;
    withoutBody: string;
    withoutBadge: string;
    withTitle: string;
    withBody: string;
    withBadge: string;
    caption: string;
    modulesNote: string;
  };
  footerDisclosure: string;
  translationDraftNote: string;
};

const en: PublicLandingCopy = {
  metaTitle: "INFRAOS | Infrastructure coordination demonstration",
  metaDescription:
    "INFRAOS is a university demonstration for coordinating infrastructure projects, schedules and public information. It is not an official government service.",
  skipToMain: "Skip to main content",
  homeLinkLabel: "INFRAOS — Home",
  demoBanner: "University demonstration · not an official government service",
  languageNavLabel: "Languages",
  primaryNavLabel: "Primary",
  openMenu: "Open primary navigation",
  closeMenu: "Close primary navigation",
  menuTitle: "Menu",
  nav: {
    home: "Home",
    problem: "The coordination gap",
    solution: "How INFRAOS works",
    example: "Coordination example",
  },
  hero: {
    eyebrow: "Infrastructure coordination platform",
    title: "Coordinating infrastructure work for better communities.",
    lead:
      "INFRAOS demonstrates how infrastructure projects can be planned, reviewed and coordinated to reduce overlapping road and utility work and support clearer public information.",
    modules:
      "ProjectTrace supports delivery and progress accountability. RoadSync is designed to surface explainable geographic and schedule overlaps for agency review—not autonomous approvals.",
    prototypeNote:
      "University prototype · Demonstration workflows use synthetic data · Not an official government record",
    ctaPrimaryLabel: "How INFRAOS works",
  },
  illustration: {
    title: "Illustrative road coordination scenario",
    description:
      "Two planned works overlap on the same road segment. This drawing is an example, not a live map or a detected government conflict.",
    pipeline: "Pipeline window",
    resurfacing: "Resurfacing window",
    overlap: "Overlap (illustrative)",
    caption: "Illustrative scenario · not live map data or detected conflicts",
    pending: "Pending coordination",
    critical: "Schedule overlap",
    resolved: "Resolution path (intended)",
  },
  problem: {
    eyebrow: "The coordination gap",
    title: "When infrastructure plans live separately, avoidable conflicts follow.",
    intro:
      "A resurfaced road and a planned pipeline can share the same location and work window without a common view. INFRAOS is designed to make those overlaps visible before teams start work.",
    cards: [
      {
        id: "repeated-excavation",
        title: "Repeated excavation",
        body:
          "One utility repairs a corridor shortly after resurfacing because schedules and locations sit in separate plans—not because teams ignore each other.",
        badge: "Schedule overlap",
        variant: "critical",
      },
      {
        id: "schedule-blind-spots",
        title: "Schedule blind spots",
        body:
          "Teams working the same corridor may not see each other's planned work windows when timelines live in different systems or spreadsheets.",
        badge: "Pending coordination",
        variant: "warning",
      },
      {
        id: "fragmented-progress",
        title: "Fragmented project progress",
        body:
          "Milestones, spending, and delivery status can be tracked in disconnected views, making accountability harder for officers and the public.",
        badge: "Informational",
        variant: "info",
      },
      {
        id: "continuity-gap",
        title: "Verification and continuity",
        body:
          "Inspection evidence and later asset maintenance are part of a full lifecycle, but they are difficult to trace when records stay siloed.",
        badge: "Lifecycle gap",
        variant: "neutral",
      },
    ],
  },
  solution: {
    eyebrow: "A shared infrastructure view",
    title: "Plan together. Coordinate earlier. Build with fewer surprises.",
    intro:
      "INFRAOS brings project schedules, locations, and responsibilities into one coordinated workflow. RoadSync can identify planned-work overlaps using geography and dates, while ProjectTrace organizes delivery and progress.",
    flowLabel: "illustrative flow",
    flowSteps: [
      {
        id: "share-plan",
        title: "Share plan",
        body: "Project locations, agencies, and work schedules enter a shared view (ProjectTrace).",
      },
      {
        id: "detect-overlap",
        title: "Detect overlap",
        body:
          "RoadSync applies deterministic geography and date rules to flag proposed overlaps for human review—not as AI-generated truth.",
      },
      {
        id: "coordinate-early",
        title: "Coordinate early",
        body:
          "Agencies review conflicts, adjust windows, and document resolution paths before construction starts.",
      },
    ],
    contrastTitle: "Illustrative before and after coordination view",
    withoutTitle: "Without a shared view",
    withoutBody:
      "Separate lists and dates hide that two works target the same corridor in the same month.",
    withoutBadge: "Overlap risk (illustrative)",
    withTitle: "With coordinated planning",
    withBody:
      "Overlaps surface for review so agencies can adjust schedules before mobilization.",
    withBadge: "Resolution path (intended)",
    caption: "Illustrative scenario · not live detected conflicts or government data",
    modulesNote:
      "InfraMap is intended to add map-based visibility in later product steps. Inspection, risk, and asset modules extend the lifecycle after coordination—without replacing agency decisions.",
  },
  footerDisclosure:
    "INFRAOS is a university-developed infrastructure coordination demonstration. Project information shown for demonstration may be synthetic and does not represent official government records.",
  translationDraftNote:
    "Sinhala and Tamil text on this public site is an unverified draft pending native-speaker review.",
};

const si: PublicLandingCopy = {
  ...en,
  metaTitle: "INFRAOS | යටිතල පහසුකම් සම්බන්ධීකරණ ආදර්ශනය",
  metaDescription:
    "INFRAOS යනු යටිතල පහසුකම් ව්‍යාපෘති, කාලසටහන් සහ මහජන තොරතුරු සම්බන්ධීකරණය සඳහා විශ්වවිද්‍යාල ආදර්ශනයකි. මෙය නිල රජයේ සේවාවක් නොවේ.",
  skipToMain: "ප්‍රධාන අන්තර්ගතයට යන්න",
  homeLinkLabel: "INFRAOS — මුල් පිටුව",
  demoBanner: "විශ්වවිද්‍යාල ආදර්ශනය · නිල රජයේ සේවාවක් නොවේ",
  languageNavLabel: "භාෂා",
  primaryNavLabel: "ප්‍රධාන",
  openMenu: "ප්‍රධාන සංචාලනය විවෘත කරන්න",
  closeMenu: "ප්‍රධාන සංචාලනය වසන්න",
  menuTitle: "මෙනුව",
  nav: {
    home: "මුල් පිටුව",
    problem: "සම්බන්ධීකරණ පරතරය",
    solution: "INFRAOS ක්‍රියා කරන ආකාරය",
    example: "සම්බන්ධීකරණ උදාහරණය",
  },
  hero: {
    eyebrow: "යටිතල පහසුකම් සම්බන්ධීකරණ වේදිකාව",
    title: "ප්‍රජාවන් සඳහා යටිතල පහසුකම් වැඩ සම්බන්ධීකරණය.",
    lead:
      "මාර්ග සහ උපයෝගිතා වැඩ අතිච්ඡාදනය අඩු කිරීමට සහ පැහැදිලි මහජන තොරතුරු සඳහා ව්‍යාපෘති සැලසුම් කිරීම, සමාලෝචනය කිරීම සහ සම්බන්ධීකරණය කිරීම INFRAOS පෙන්වයි.",
    modules:
      "ProjectTrace බෙදාහැරීම සහ ප්‍රගතිය වගකීම් සහිතව තබයි. RoadSync භූගෝලය සහ කාලසටහන් අතිච්ඡාදන පැහැදිලි කළ හැකි ලෙස පෙන්වීමට නිර්මාණය කර ඇත — ස්වයංක්‍රීය අනුමැතියක් නොවේ.",
    prototypeNote:
      "විශ්වවිද්‍යාල මූලාකෘතිය · ආදර්ශන දත්ත කෘත්‍රිමයි · නිල රජයේ වාර්තාවක් නොවේ",
    ctaPrimaryLabel: "INFRAOS ක්‍රියා කරන ආකාරය",
  },
  illustration: {
    ...en.illustration,
    title: "ආදර්ශන මාර්ග සම්බන්ධීකරණ දර්ශනය",
    description:
      "එකම මාර්ග කොටසක වැඩ දෙකක් අතිච්ඡාදනය වේ. මෙය උදාහරණ චිත්‍රයකි — සජීවී සිතියමක් හෝ රජයේ හඳුනාගත් ගැටුමක් නොවේ.",
    pipeline: "නල මාර්ග කවුළුව",
    resurfacing: "නැවත ඇල්ලීමේ කවුළුව",
    overlap: "අතිච්ඡාදනය (උදාහරණ)",
    caption: "උදාහරණ දර්ශනය · සජීවී සිතියම් දත්ත හෝ හඳුනාගත් ගැටුම් නොවේ",
    pending: "සම්බන්ධීකරණය බලාපොරොත්තුවෙන්",
    critical: "කාලසටහන් අතිච්ඡාදනය",
    resolved: "විසඳුම් මාර්ගය (අපේක්ෂිත)",
  },
  problem: {
    eyebrow: "සම්බන්ධීකරණ පරතරය",
    title: "සැලසුම් වෙන වෙනම තිබෙන විට, වළක්වා ගත හැකි ගැටුම් ඇති වේ.",
    intro:
      "නැවත ඇල්ලූ මාර්ගයක් සහ සැලසුම් කළ නල මාර්ගයක් එකම ස්ථානයේ සහ කාලයේ වැඩ කළ හැක. INFRAOS එම අතිච්ඡාදන වැඩ ආරම්භයට පෙර පෙනෙන ලෙස නිර්මාණය කර ඇත.",
    cards: [
      {
        id: "repeated-excavation",
        title: "නැවත නැවත කැණීම",
        body: "වෙන වෙනම සැලසුම් නිසා මාර්ගය ඇල්ලූ විගසම උපයෝගිතාවක් නැවත කැණීමට සිදු විය හැක.",
        badge: "කාලසටහන් අතිච්ඡාදනය",
        variant: "critical",
      },
      {
        id: "schedule-blind-spots",
        title: "කාලසටහන් අන්ධ ලක්ෂ්‍ය",
        body: "එකම මාර්ගයේ කණ්ඩායම්වලට අනෙක් අයගේ වැඩ කවුළු නොපෙනී යා හැක.",
        badge: "සම්බන්ධීකරණය බලාපොරොත්තුවෙන්",
        variant: "warning",
      },
      {
        id: "fragmented-progress",
        title: "ඛණ්ඩනය වූ ප්‍රගතිය",
        body: "සන්ධිස්ථාන, වියදම් සහ බෙදාහැරීම වෙන වෙනම තිබෙන විට වගවීම අපහසු වේ.",
        badge: "තොරතුරු",
        variant: "info",
      },
      {
        id: "continuity-gap",
        title: "සත්‍යාපනය සහ අඛණ්ඩතාව",
        body: "පරීක්ෂණ සාක්ෂි සහ පසුව නඩත්තුව එක ජීවන චක්‍රයක කොටස් වුවත් වාර්තා වෙන් වූ විට සොයා ගැනීම අපහසුය.",
        badge: "ජීවන චක්‍ර පරතරය",
        variant: "neutral",
      },
    ],
  },
  solution: {
    ...en.solution,
    eyebrow: "හවුල් යටිතල පහසුකම් දසුන",
    title: "එකට සැලසුම් කරන්න. කලින් සම්බන්ධීකරණය කරන්න.",
    intro:
      "INFRAOS ව්‍යාපෘති කාලසටහන්, ස්ථාන සහ වගකීම් එක ක්‍රියාවලියකට ගෙන එයි. RoadSync භූගෝලය සහ දිනයන්ගෙන් අතිච්ඡාදන හඳුනා ගැනීමට නිර්මාණය කර ඇත. ProjectTrace බෙදාහැරීම සහ ප්‍රගතිය සංවිධානය කරයි.",
    flowLabel: "උදාහරණ ප්‍රවාහය",
    flowSteps: [
      {
        id: "share-plan",
        title: "සැලැස්ම බෙදා ගන්න",
        body: "ව්‍යාපෘති ස්ථාන, ආයතන සහ වැඩ කාලසටහන් හවුල් දසුනකට ඇතුළත් වේ (ProjectTrace).",
      },
      {
        id: "detect-overlap",
        title: "අතිච්ඡාදනය හඳුනන්න",
        body:
          "RoadSync නියත භූගෝල සහ දින නීති යොදා යෝජිත අතිච්ඡාදන මිනිස් සමාලෝචනයට යොමු කරයි — AI සත්‍යයක් ලෙස නොවේ.",
      },
      {
        id: "coordinate-early",
        title: "කලින් සම්බන්ධීකරණය",
        body: "ආයතන ගැටුම් සමාලෝචනය කර, කවුළු සකසා, ඉදිකිරීමට පෙර විසඳුම් මාර්ගය ලියා තබයි.",
      },
    ],
    contrastTitle: "සම්බන්ධීකරණයට පෙර සහ පසු උදාහරණ දසුන",
    withoutTitle: "හවුල් දසුනක් නැතිව",
    withoutBody: "වෙන වෙනම ලැයිස්තු නිසා එකම මාර්ගයේ වැඩ දෙකක් සැඟවේ.",
    withoutBadge: "අතිච්ඡාදන අවදානම (උදාහරණ)",
    withTitle: "සම්බන්ධීකරණ සැලසුම් සමඟ",
    withBody: "අතිච්ඡාදන සමාලෝචනයට පෙනේ, එවිට කාලසටහන් කලින් සකස් කළ හැක.",
    withBadge: "විසඳුම් මාර්ගය (අපේක්ෂිත)",
    caption: "උදාහරණ දර්ශනය · සජීවී රජයේ දත්ත නොවේ",
    modulesNote:
      "InfraMap පසු පියවරක සිතියම් දෘශ්‍යතාව සඳහා අපේක්ෂිතය. පරීක්ෂණ, අවදානම සහ වත්කම් මොඩියුල ආයතනික තීරණ ප්‍රතිස්ථාපනය නොකරයි.",
  },
  footerDisclosure:
    "INFRAOS යනු විශ්වවිද්‍යාලයක් විසින් සංවර්ධනය කළ යටිතල පහසුකම් සම්බන්ධීකරණ ආදර්ශනයකි. පෙන්වන ව්‍යාපෘති තොරතුරු කෘත්‍රිම විය හැකි අතර නිල රජයේ වාර්තා නොවේ.",
  translationDraftNote:
    "මෙම පිටුවේ සිංහල පෙළ ස්වදේශික සමාලෝචනයක් බලාපොරොත්තුවෙන් සිටින තහවුරු නොකළ කෙටුම්පතකි.",
};

const ta: PublicLandingCopy = {
  ...en,
  metaTitle: "INFRAOS | உள்கட்டமைப்பு ஒருங்கிணைப்பு செயல்விளக்கம்",
  metaDescription:
    "INFRAOS என்பது உள்கட்டமைப்பு திட்டங்கள், அட்டவணைகள் மற்றும் பொதுத் தகவலை ஒருங்கிணைக்கும் பல்கலைக்கழக செயல்விளக்கம். இது அதிகாரப்பூர்வ அரசு சேவை அல்ல.",
  skipToMain: "முதன்மை உள்ளடக்கத்திற்கு செல்லவும்",
  homeLinkLabel: "INFRAOS — முகப்பு",
  demoBanner: "பல்கலைக்கழக செயல்விளக்கம் · அதிகாரப்பூர்வ அரசு சேவை அல்ல",
  languageNavLabel: "மொழிகள்",
  primaryNavLabel: "முதன்மை",
  openMenu: "முதன்மை வழிசெலுத்தலை திறக்கவும்",
  closeMenu: "முதன்மை வழிசெலுத்தலை மூடவும்",
  menuTitle: "பட்டி",
  nav: {
    home: "முகப்பு",
    problem: "ஒருங்கிணைப்பு இடைவெளி",
    solution: "INFRAOS எவ்வாறு செயல்படுகிறது",
    example: "ஒருங்கிணைப்பு எடுத்துக்காட்டு",
  },
  hero: {
    eyebrow: "உள்கட்டமைப்பு ஒருங்கிணைப்பு தளம்",
    title: "சமூகங்களுக்காக உள்கட்டமைப்பு பணிகளை ஒருங்கிணைத்தல்.",
    lead:
      "சாலை மற்றும் பயன்பாட்டுப் பணிகள் ஒன்றுடன் ஒன்று மோதாமல் திட்டங்களை திட்டமிட, மதிப்பாய்வு செய்ய மற்றும் ஒருங்கிணைக்க INFRAOS காட்டுகிறது.",
    modules:
      "ProjectTrace விநியோகத்தையும் முன்னேற்றத்தையும் பொறுப்புடன் வைக்கிறது. RoadSync புவியியல் மற்றும் அட்டவணை ஒன்றுசேர்வுகளை விளக்கக்கூடிய முறையில் காட்ட வடிவமைக்கப்பட்டுள்ளது — தானியங்கி அனுமதி அல்ல.",
    prototypeNote:
      "பல்கலைக்கழக முன்மாதிரி · செயல்விளக்கத் தரவு செயற்கையானது · அதிகாரப்பூர்வ அரசு பதிவு அல்ல",
    ctaPrimaryLabel: "INFRAOS எவ்வாறு செயல்படுகிறது",
  },
  illustration: {
    ...en.illustration,
    title: "எடுத்துக்காட்டு சாலை ஒருங்கிணைப்பு காட்சி",
    description:
      "ஒரே சாலைப் பகுதியில் இரண்டு திட்டமிட்ட பணிகள் ஒன்றுசேர்கின்றன. இது எடுத்துக்காட்டு வரைபடம் — நேரடி வரைபடமோ அரசு கண்டறிந்த மோதலோ அல்ல.",
    pipeline: "குழாய் பணிச் சாளரம்",
    resurfacing: "மறுபாவு சாளரம்",
    overlap: "ஒன்றுசேர்வு (எடுத்துக்காட்டு)",
    caption: "எடுத்துக்காட்டு காட்சி · நேரடி வரைபடத் தரவு அல்ல",
    pending: "ஒருங்கிணைப்பு நிலுவையில்",
    critical: "அட்டவணை ஒன்றுசேர்வு",
    resolved: "தீர்வு வழி (எதிர்பார்ப்பு)",
  },
  problem: {
    eyebrow: "ஒருங்கிணைப்பு இடைவெளி",
    title: "திட்டங்கள் தனித்தனியாக இருக்கும்போது தவிர்க்கக்கூடிய மோதல்கள் ஏற்படும்.",
    intro:
      "மறுபாவு செய்யப்பட்ட சாலையும் திட்டமிட்ட குழாய் பணியும் ஒரே இடத்திலும் நேரத்திலும் இருக்கலாம். INFRAOS அந்த ஒன்றுசேர்வுகளை பணி தொடங்கும் முன் காட்ட வடிவமைக்கப்பட்டுள்ளது.",
    cards: [
      {
        id: "repeated-excavation",
        title: "மீண்டும் மீண்டும் தோண்டல்",
        body: "தனி திட்டங்களால் சாலை பாவப்பட்ட உடனே ஒரு பயன்பாடு மீண்டும் தோண்ட வேண்டியிருக்கலாம்.",
        badge: "அட்டவணை ஒன்றுசேர்வு",
        variant: "critical",
      },
      {
        id: "schedule-blind-spots",
        title: "அட்டவணை குருட்டுப் புள்ளிகள்",
        body: "ஒரே பாதையில் பணிபுரியும் குழுக்கள் மற்றவரின் பணிச் சாளரங்களைக் காணாமல் போகலாம்.",
        badge: "ஒருங்கிணைப்பு நிலுவையில்",
        variant: "warning",
      },
      {
        id: "fragmented-progress",
        title: "துண்டான முன்னேற்றம்",
        body: "மைல்கற்கள், செலவு மற்றும் விநியோகம் தனித்தனியாக இருக்கும்போது பொறுப்பு கடினமாகும்.",
        badge: "தகவல்",
        variant: "info",
      },
      {
        id: "continuity-gap",
        title: "சரிபார்ப்பும் தொடர்ச்சியும்",
        body: "ஆய்வுச் சான்றுகளும் பின்னர் பராமரிப்பும் ஒரே வாழ்க்கைச் சுழற்சியின் பகுதிகள், ஆனால் பதிவுகள் பிரிந்தால் கண்டுபிடிப்பது கடினம்.",
        badge: "வாழ்க்கைச் சுழற்சி இடைவெளி",
        variant: "neutral",
      },
    ],
  },
  solution: {
    ...en.solution,
    eyebrow: "பகிரப்பட்ட உள்கட்டமைப்பு பார்வை",
    title: "ஒன்றாக திட்டமிடுங்கள். முன்கூட்டியே ஒருங்கிணைக்கவும்.",
    intro:
      "INFRAOS திட்ட அட்டவணைகள், இடங்கள் மற்றும் பொறுப்புகளை ஒரே பணிப்போக்கில் கொண்டுவருகிறது. RoadSync புவியியல் மற்றும் தேதிகளால் ஒன்றுசேர்வுகளை காட்ட வடிவமைக்கப்பட்டுள்ளது. ProjectTrace விநியோகத்தையும் முன்னேற்றத்தையும் ஒழுங்குபடுத்துகிறது.",
    flowLabel: "எடுத்துக்காட்டு ஓட்டம்",
    flowSteps: [
      {
        id: "share-plan",
        title: "திட்டத்தைப் பகிரவும்",
        body: "திட்ட இடங்கள், நிறுவனங்கள் மற்றும் பணி அட்டவணைகள் பகிரப்பட்ட பார்வையில் நுழைகின்றன (ProjectTrace).",
      },
      {
        id: "detect-overlap",
        title: "ஒன்றுசேர்வைக் கண்டறியவும்",
        body:
          "RoadSync நிர்ணய புவியியல் மற்றும் தேதி விதிகளால் முன்மொழியப்பட்ட ஒன்றுசேர்வுகளை மனித மதிப்பாய்வுக்கு அனுப்புகிறது — AI உண்மையாக அல்ல.",
      },
      {
        id: "coordinate-early",
        title: "முன்கூட்டிய ஒருங்கிணைப்பு",
        body: "நிறுவனங்கள் மோதல்களை மதிப்பாய்வு செய்து, சாளரங்களை மாற்றி, கட்டுமானத்திற்கு முன் தீர்வு வழியைப் பதிவு செய்கின்றன.",
      },
    ],
    contrastTitle: "ஒருங்கிணைப்புக்கு முன் மற்றும் பின் எடுத்துக்காட்டு",
    withoutTitle: "பகிரப்பட்ட பார்வை இல்லாமல்",
    withoutBody: "தனி பட்டியல்கள் ஒரே பாதையில் இரண்டு பணிகளை மறைக்கின்றன.",
    withoutBadge: "ஒன்றுசேர்வு அபாயம் (எடுத்துக்காட்டு)",
    withTitle: "ஒருங்கிணைந்த திட்டத்துடன்",
    withBody: "ஒன்றுசேர்வுகள் மதிப்பாய்வுக்குத் தெரிகின்றன, அட்டவணைகளை முன்கூட்டியே மாற்றலாம்.",
    withBadge: "தீர்வு வழி (எதிர்பார்ப்பு)",
    caption: "எடுத்துக்காட்டு காட்சி · நேரடி அரசுத் தரவு அல்ல",
    modulesNote:
      "InfraMap பிந்தைய படியில் வரைபடக் காட்சிக்காக எதிர்பார்க்கப்படுகிறது. ஆய்வு, இடர் மற்றும் சொத்து தொகுதிகள் நிறுவன முடிவுகளை மாற்றாது.",
  },
  footerDisclosure:
    "INFRAOS ஒரு பல்கலைக்கழகத்தால் உருவாக்கப்பட்ட உள்கட்டமைப்பு ஒருங்கிணைப்பு செயல்விளக்கம். காட்டப்படும் திட்டத் தகவல் செயற்கையாக இருக்கலாம்; அது அதிகாரப்பூர்வ அரசுப் பதிவு அல்ல.",
  translationDraftNote:
    "இந்தப் பக்கத்தின் தமிழ் உரை தாய்மொழி மதிப்பாய்வுக்காக காத்திருக்கும் சரிபார்க்கப்படாத வரைவு.",
};

const COPY: Record<PublicLocale, PublicLandingCopy> = { en, si, ta };

export function getPublicCopy(locale: PublicLocale): PublicLandingCopy {
  return COPY[locale];
}

export function publicCopyKeys(copy: PublicLandingCopy): string[] {
  const keys: string[] = [];
  const walk = (value: unknown, prefix: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${prefix}[${index}]`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        walk(child, prefix ? `${prefix}.${key}` : key);
      }
      return;
    }
    keys.push(prefix);
  };
  walk(copy, "");
  return keys;
}

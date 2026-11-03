import type { PublicLocale } from "./locales";

/** Trilingual copy for the public landing page (Stitch redesign). Sinhala and Tamil are drafts pending native-speaker review. */

export type LpStatusTone = "locked" | "pending" | "blocked";

export type LpCopy = {
  meta: { title: string; description: string };
  skipLabel: string;
  nav: {
    label: string;
    home: string;
    about: string;
    howItWorks: string;
    faq: string;
    contact: string;
    signIn: string;
    openMenu: string;
    closeMenu: string;
    menuTitle: string;
    languageLabel: string;
    affiliation: string;
    ministry: string;
    helpdesk: string;
    publicNotices: string;
  };
  hero: {
    badge: string;
    title: string;
    lede: string;
    ctaPrimary: string;
    ctaSecondary: string;
    stats: readonly { value: string; label: string; accent?: boolean }[];
    figLabel: string;
    figTitle: string;
    figCaption: string;
    figChip: string;
    imageAlt: string;
    calibratedTitle: string;
    calibratedNote: string;
  };
  lifecycle: {
    eyebrow: string;
    title: string;
    directive: string;
    activeBadge: string;
    listLabel: string;
    stages: readonly { name: string; desc: string; tag: string }[];
  };
  problem: {
    eyebrow: string;
    title: string;
    lede: string;
    plateLabel: string;
    plateCaption: string;
    plateChip: string;
    imageAlt: string;
    beforeTitle: string;
    beforeTag: string;
    beforeItems: readonly { title: string; text: string }[];
    beforeOutcome: string;
    afterTitle: string;
    afterTag: string;
    afterItems: readonly { title: string; text: string }[];
    afterOutcome: string;
  };
  incident: {
    eyebrow: string;
    title: string;
    flag: string;
    plateLabel: string;
    plateCaption: string;
    plateChip: string;
    imageAlt: string;
    alertTitle: string;
    alertText: string;
    alertTag: string;
    alertTagApplied: string;
    collision: string;
    cleared: string;
    dayTicks: readonly string[];
    lanes: readonly { agency: string; type: string; bar: string; resequencedBar: string; sub?: string }[];
    platformAction: string;
    outcomeTag: string;
    laneListLabel: string;
  };
  capabilities: {
    eyebrow: string;
    title: string;
    lede: string;
    cards: readonly { name: string; text: string; link: string }[];
  };
  dispatch: {
    eyebrow: string;
    title: string;
    conceptual: string;
    mockAddress: string;
    tlsBadge: string;
    plateLabel: string;
    plateCaption: string;
    plateChip: string;
    imageAlt: string;
    zone: string;
    resolution: string;
    layer: string;
    simulation: string;
    tableCaption: string;
    columns: readonly [string, string, string, string, string];
    status: Record<LpStatusTone, string>;
    scrollHint: string;
  };
  audiences: {
    eyebrow: string;
    title: string;
    lede: string;
    plateLabel: string;
    plateCaption: string;
    plateChip: string;
    imageAlt: string;
    cards: readonly { tag: string; title: string; text: string; cta: string }[];
  };
  transparency: {
    eyebrow: string;
    title: string;
    lede: string;
    items: readonly { label: string; title: string; text: string }[];
    cadenceEyebrow: string;
    cadenceTitle: string;
    cadenceLede: string;
    cadenceItems: readonly {
      status: string;
      phase: string;
      title: string;
      text: string;
      metricLabel: string;
      metricValue: string;
      progress: number;
      tone: "success" | "attention" | "secondary";
    }[];
    note: string;
  };
  footer: {
    lifecycleTitle: string;
    lifecycleNote: string;
    platformTitle: string;
    platformLinks: readonly string[];
    servicesTitle: string;
    servicesLinks: readonly string[];
    governanceTitle: string;
    governanceLinks: readonly string[];
    contactTitle: string;
    contactUnit: string;
    contactAgency: string;
    contactAddress: string;
    contactText: string;
    contactLink: string;
    slaNote: string;
    gazetteRef: string;
    privacy: string;
    accessibility: string;
    rights: string;
    languageLabel: string;
  };
};

const en: LpCopy = {
  meta: {
    title: "INFRAOS — National Infrastructure Intelligence & Coordination Platform",
    description:
      "Unifying civic agencies, utility providers, and contractors across Sri Lanka to eliminate repeated road excavations through predictive coordination. A university-led GovTech research prototype.",
  },
  skipLabel: "Skip to main content",
  nav: {
    label: "Primary",
    home: "Home",
    about: "About",
    howItWorks: "How It Works",
    faq: "FAQ",
    contact: "Contact",
    signIn: "Authorized Portal / Sign In",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    menuTitle: "Menu",
    languageLabel: "Language",
    affiliation: "Democratic Socialist Republic of Sri Lanka",
    ministry: "Ministry of Infrastructure & Transport",
    helpdesk: "Contact Helpdesk",
    publicNotices: "Public Notices",
  },
  hero: {
    badge: "Statutory Public Service Pilot 2025",
    title: "National Infrastructure Intelligence & Coordination Platform",
    lede: "Unifying civic agencies, utility providers, and contractors across Sri Lanka to eliminate repeated road excavations through predictive coordination.",
    ctaPrimary: "See How It Works",
    ctaSecondary: "View Public Projects",
    stats: [
      { value: "14 Agencies", label: "Single Cadastral Grid" },
      { value: "38% Cost Cut", label: "Excavation Redundancy" },
      { value: "Zero-Trench", label: "Moratorium Protection", accent: true },
    ],
    figLabel: "Fig. 1.0",
    figTitle: "RDA & Geotechnical Alignment Review",
    figCaption: "Fig. 1.0 — RDA & Geotechnical Team reviewing RoadSync GIS corridor alignment, Western Province corridor A2",
    figChip: "Permit Cleared: WP-RDA-2025-0891",
    imageAlt:
      "Civil engineers and roadwork supervisors coordinating road resurfacing with a GIS tablet and blueprints beside an asphalt paving crew",
    calibratedTitle: "Survey Cadastre Calibrated",
    calibratedNote: "SLD99 Grid Precision: ±50mm",
  },
  lifecycle: {
    eyebrow: "Statutory Protocol",
    title: "National Infrastructure Lifecycle Sequence",
    directive:
      "Mandated by Cabinet Directive for all public capital works exceeding LKR 5M across municipal and state corridors.",
    activeBadge: "Active Core",
    listLabel: "Infrastructure lifecycle stages",
    stages: [
      { name: "Plan", desc: "Public need & budgetary allocation registered.", tag: "Capital Need" },
      { name: "Coordinate", desc: "Multi-agency spatial sync & conflict clearance.", tag: "Spatial Sync" },
      { name: "Approve", desc: "Inter-agency unified right-of-way permit issued.", tag: "Permit Clearance" },
      { name: "Build", desc: "Sequenced excavation, utility laying & trenching.", tag: "Civil Execution" },
      { name: "Verify", desc: "Civil compaction test & QA sensor validation.", tag: "QA Audit" },
      { name: "Monitor", desc: "IoT corridor monitors track post-paving integrity.", tag: "Live Sensors" },
      { name: "Complete", desc: "Public corridor reopening & final asset gazette.", tag: "Public Handover" },
      { name: "Maintain", desc: "5-year statutory moratorium on non-emergency digs.", tag: "Asset Registry" },
    ],
  },
  problem: {
    eyebrow: "Systemic Challenge",
    title: "The Fragmented Excavation Dilemma",
    lede: "Sri Lankan urban thoroughfares suffer an endless cycle of asynchronous civil projects. Roadways resurfaced at significant public expense are routinely broken up weeks later by utility providers operating in isolation.",
    plateLabel: "Plate 2.1 — Field Documentary",
    plateCaption: "Active NWSDB water main trench excavation prior to synchronized corridor moratorium enforcement.",
    plateChip: "Galle Road A2 Corridor",
    imageAlt: "Active municipal water pipeline trench with timber shoring beside an urban roadway in Sri Lanka, NWSDB crew at work",
    beforeTitle: "Traditional Status Quo",
    beforeTag: "Uncoordinated Silos",
    beforeItems: [
      { title: "March — RDA Asphalt Resurfacing", text: "LKR 42M invested in binder and wearing course along 3.2km corridor. Road declared immaculate." },
      { title: "May — NWSDB Main Trenching", text: "Water supply board excavates a 1.2m longitudinal trench to lay a replacement ductile iron pipe. Road structural seal ruined." },
      { title: "August — Telecom Fiber Trenching", text: "Subcontractor cuts transverse channels for optical conduits. Surface degraded into hazardous patchwork." },
    ],
    beforeOutcome: "Outcome: LKR 18.5M Wastage & 14 Weeks Traffic Congestion",
    afterTitle: "With INFRAOS Protocol",
    afterTag: "Synchronized Co-Location",
    afterItems: [
      { title: "Month 0 — Unified Corridor Booking", text: "RDA announces planned resurfacing 180 days prior. NWSDB, CEB, and SLT are notified by automated spatial conflict engine." },
      { title: "Month 1-2 — Sub-surface Joint Civil Works", text: "Water lines and fiber ducts installed together in a shared utility trench prior to surface preparation." },
      { title: "Month 3 — Final Paving & 5-Year Lockout", text: "Paving completed over pristine compaction. Digital seal locks corridor from all non-emergency digs until 2030." },
    ],
    afterOutcome: "Outcome: Single Disruptive Window & Protected Taxpayer Investment",
  },
  incident: {
    eyebrow: "Spatial-Temporal Diagnostics",
    title: "Real-World Incident Sequence Simulation",
    flag: "Conflict Flagged: Galle Road (A2) km 14+200",
    plateLabel: "Plate 3.4 — Civil Execution Grounding",
    plateCaption: "Multi-agency road surfacing in progress; single-pass coordination prevents premature trench cuts.",
    plateChip: "RDA & Municipal Work Team",
    imageAlt: "Road crew laying asphalt with a paver and roller while inspectors review the work on a Sri Lankan street",
    alertTitle: "INFRAOS AI Conflict Flag — Critical Alert",
    alertText: "High-Severity Spatial-Temporal Overlap Detected — Rescheduling Pipeline Pre-Paving",
    alertTag: "Apply Automated Re-sequence",
    alertTagApplied: "Re-sequence Applied (Conceptual)",
    collision: "Collision",
    cleared: "Cleared",
    dayTicks: ["Day 0", "Day 15", "Day 30", "Day 45", "Day 60"],
    lanes: [
      {
        agency: "RDA Civil Works",
        type: "(Resurfacing)",
        bar: "Day 1 – 14: Asphalt Laying",
        resequencedBar: "Day 20 – 34: Asphalt Laying",
        sub: "3.2 km",
      },
      {
        agency: "NWSDB Utilities",
        type: "(Water Main)",
        bar: "Day 25: Trenching",
        resequencedBar: "Day 1 – 15: Joint Trenching",
      },
      {
        agency: "SLT Telecom",
        type: "(Optical Fiber)",
        bar: "Day 40: Micro-trench",
        resequencedBar: "Day 1 – 15: Shared Ducts",
      },
    ],
    platformAction: "Platform Action: System shifted NWSDB & SLT work windows to Day -15 pre-paving; RDA binder rescheduled to Day 20.",
    outcomeTag: "Zero Excavation Damage Guaranteed",
    laneListLabel: "Sequence described as text",
  },
  capabilities: {
    eyebrow: "System Architecture",
    title: "Five Pillars of Infrastructure Governance",
    lede: "A unified, legally binding coordination stack designed to enforce transparency across provincial and national project pipelines.",
    cards: [
      { name: "ProjectTrace", text: "Centralized registry and spatial tracking of all public civil infrastructure tenders.", link: "Explore Registry" },
      { name: "RoadSync", text: "Cross-agency scheduling engine preventing consecutive excavations on the same road segment.", link: "View Schedules" },
      { name: "InfraMap", text: "National GIS layer overlaying underground utilities, road reservations, and live work permits.", link: "Open GIS Map" },
      { name: "AI Risk Intelligence", text: "Predictive conflict detection flagging overlapping timelines and traffic impact risks.", link: "View Conflict Log" },
      { name: "DocTrace", text: "Immutable digital audit trails for compliance, inspection reports, and contractor sign-offs.", link: "Audit Specifications" },
    ],
  },
  dispatch: {
    eyebrow: "System Interface",
    title: "Operational Dispatch Console",
    conceptual: "Conceptual preview: RoadSync Multi-Agency Coordination Matrix",
    mockAddress: "https://console.infraos.gov.lk/corridors/colombo-central",
    tlsBadge: "Secured GovNet TLS 1.3",
    plateLabel: "Fig. 4.0 — Municipal Dispatch Console",
    plateCaption: "Colombo Municipal Council & Central Dispatch desk accessing the live InfraMap GIS registry.",
    plateChip: "Live CAD & GIS Feeds",
    imageAlt: "Municipal engineering control and dispatch desk with multi-monitor GIS displays",
    zone: "Zone: Colombo West (Ward 07)",
    resolution: "Resolution: 1:1,000",
    layer: "Layer: Underground Cadastre",
    simulation: "Sync Simulation Running",
    tableCaption: "Conceptual RoadSync coordination matrix — corridors, lead agencies, scheduled windows and conflict status",
    columns: ["Corridor / Road ID", "Lead Agency", "Co-Applicant Agencies", "Scheduled Window", "Conflict Status"],
    status: { locked: "Cleared & Locked", pending: "Alignment Pending", blocked: "Overlap Blocked" },
    scrollHint: "Scroll the table sideways to see all columns",
  },
  audiences: {
    eyebrow: "Ecosystem Access",
    title: "Dedicated Civic Portals",
    lede: "Select your civic operational profile to access role-specific workflows, live permitting tools, or public reporting streams.",
    plateLabel: "Plate 2.3 — Statutory Quality Assurance",
    plateCaption: "Chainage +4.2 KM post-remediation inspection adhering to SLS 1248 civil corridor standards.",
    plateChip: "RDA QA / NSDI Verified",
    imageAlt: "Senior Sri Lankan civil engineers and project inspectors conducting right-of-way site inspection and geotechnical survey",
    cards: [
      { tag: "Public Access", title: "Citizens & Road Users", text: "Track local roadwork, report uncoordinated digs, and view verified road reopening dates in your neighborhood.", cta: "Public Dashboard" },
      { tag: "Ministry & Secretariat", title: "Statutory Agencies & Ministries", text: "Ministry oversight, inter-agency policy approvals, capital expenditure tracking, and fiscal transparency audits.", cta: "Executive Portal" },
      { tag: "Civil Execution", title: "Contractors & Surveyors", text: "Submit work notices, request utility coordination windows, file traffic management plans, and log asphalt pours.", cta: "Contractor Terminal" },
    ],
  },
  transparency: {
    eyebrow: "Civic Honesty & Accountability",
    title: "Academic & Pilot Disclosure",
    lede: "INFRAOS is a university-led GovTech research prototype designed to model modern national digital government systems.",
    items: [
      { label: "Status", title: "Demonstration Prototype", text: "This site presents an academic GovTech demonstration. It is not an operational government service." },
      { label: "Pilot Boundary", title: "Western Province", text: "Sri Lanka, Western Province (Colombo Municipal Council, A2/A1 highway corridors, and Greater Colombo metropolitan boundaries)." },
      { label: "Academic Supervision", title: "University GovTech Initiative", text: "Developed by the Spatial Urban & Transport Systems Modeling Lab in collaboration with the University GovTech Initiative." },
    ],
    cadenceEyebrow: "Deployment Cadence (Conceptual)",
    cadenceTitle: "National Platform Deployment Cadence",
    cadenceLede: "Conceptual institutional deployment cadence modeled under the National Open Contracting Directive.",
    cadenceItems: [
      {
        status: "Live in Pilot",
        phase: "Phase 1 Authorized",
        title: "Colombo Municipal Council (CMC) & Kandy Central Corridor",
        text: "Active statutory enforcement across 48 primary thoroughfares. Full multi-agency moratorium binding on all underground works.",
        metricLabel: "Compliance Rate",
        metricValue: "94.2%",
        progress: 94,
        tone: "success",
      },
      {
        status: "In Development",
        phase: "Target Q3 2025",
        title: "Southern Expressway Feeder & NWSDB GIS Sync",
        text: "Digitizing 1,400km of legacy sub-surface water transmission trunks across Galle and Matara districts into unified raster layers.",
        metricLabel: "Cadastral Mapping",
        metricValue: "68.0%",
        progress: 68,
        tone: "attention",
      },
      {
        status: "Planned Pipeline",
        phase: "Target Q4 2025",
        title: "National Fiber-Optic Conduit Sharing Standard",
        text: "Cabinet policy standardizing micro-duct installations across national trunk roads (A & AA classes) to eradicate singular trenching.",
        metricLabel: "Draft Policy Gazette",
        metricValue: "Pre-Parliamentary",
        progress: 25,
        tone: "secondary",
      },
    ],
    note: "Figures, photographs, schedules and console views on this page are conceptual and illustrative. They do not represent live data.",
  },
  footer: {
    lifecycleTitle: "National Infrastructure Lifecycle Framework",
    lifecycleNote: "Statutory Multi-Agency Sequence",
    platformTitle: "Platform",
    platformLinks: [
      "ProjectTrace Engine",
      "RoadSync Corridor Booking",
      "InfraMap GIS Spatial Registry",
      "AI Risk Intelligence",
      "DocTrace Compliance Ledger",
    ],
    servicesTitle: "Public Services",
    servicesLinks: [
      "National Capital Works Registry",
      "Trenching & Excavation Map",
      "Public Project Inquiries",
      "Citizen Feedback & Grievance",
      "Emergency Utility Disruption Notices",
    ],
    governanceTitle: "Governance",
    governanceLinks: [
      "National Infrastructure Policy",
      "Inter-Agency Co-location Protocols",
      "Right-of-Way Coordination Act",
      "Open Contracting Data Standard",
      "Public Expenditure Audits",
    ],
    contactTitle: "Contact & Liaison",
    contactUnit: "Inter-Agency Operational Unit",
    contactAgency: "Road Development Authority (RDA) & NWSDB Liaison Command",
    contactAddress: "Denzil Kobbekaduwa Mawatha, Battaramulla / Colombo 01, Sri Lanka",
    contactText: "Citizen Hotline: 1919 · NWSDB: 1939 · CEB: 1987 · SLT: 1212",
    contactLink: "Contact Helpdesk",
    slaNote: "SLA: 48h statutory acknowledgement (Section 14, National Infrastructure Coordination Directive).",
    gazetteRef: "Standards: SLS 1248 civil compaction · OCDS & ISO 19115 GIS · 5-year moratorium gazette.",
    privacy: "Privacy Policy",
    accessibility: "Accessibility Standards",
    rights: "© 2025 INFRAOS — Academic GovTech Research Prototype (Western Province Pilot).",
    languageLabel: "Official Language Parity",
  },
};

const si: LpCopy = {
  meta: {
    title: "INFRAOS — ජාතික යටිතල පහසුකම් බුද්ධි හා සම්බන්ධීකරණ වේදිකාව",
    description:
      "පුරෝකථන සම්බන්ධීකරණය මගින් නැවත නැවත මාර්ග කැණීම් නැති කිරීම සඳහා ශ්‍රී ලංකාව පුරා සිවිල් ආයතන, උපයෝගිතා සපයන්නන් සහ කොන්ත්‍රාත්කරුවන් ඒකාබද්ධ කරයි. විශ්වවිද්‍යාල-නායකත්වයෙන් යුත් GovTech පර්යේෂණ මූලාකෘතියකි.",
  },
  skipLabel: "ප්‍රධාන අන්තර්ගතයට පිවිසෙන්න",
  nav: {
    label: "ප්‍රධාන",
    home: "මුල් පිටුව",
    about: "අප ගැන",
    howItWorks: "ක්‍රියා කරන ආකාරය",
    faq: "නිතර ඇසෙන ප්‍රශ්න",
    contact: "සම්බන්ධ වන්න",
    signIn: "බලයලත් ද්වාරය / පිවිසෙන්න",
    openMenu: "මෙනුව විවෘත කරන්න",
    closeMenu: "මෙනුව වසන්න",
    menuTitle: "මෙනුව",
    languageLabel: "භාෂාව",
    affiliation: "ශ්‍රී ලංකා ප්‍රජාතාන්ත්‍රික සමාජවාදී ජනරජය",
    ministry: "යටිතල පහසුකම් හා ප්‍රවාහන අමාත්‍යාංශය",
    helpdesk: "උදව් මේසය අමතන්න",
    publicNotices: "මහජන දැන්වීම්",
  },
  hero: {
    badge: "ව්‍යවස්ථාපිත ප්‍රජා සේවා නියමු ව්‍යාපෘතිය 2025",
    title: "ජාතික යටිතල පහසුකම් බුද්ධි හා සම්බන්ධීකරණ වේදිකාව",
    lede: "පුරෝකථන සම්බන්ධීකරණය මගින් නැවත නැවත මාර්ග කැණීම් නැති කිරීම සඳහා ශ්‍රී ලංකාව පුරා සිවිල් ආයතන, උපයෝගිතා සපයන්නන් සහ කොන්ත්‍රාත්කරුවන් ඒකාබද්ධ කරයි.",
    ctaPrimary: "ක්‍රියා කරන ආකාරය බලන්න",
    ctaSecondary: "ප්‍රසිද්ධ ව්‍යාපෘති බලන්න",
    stats: [
      { value: "ආයතන 14", label: "තනි කැඩැස්ට්‍රල් ජාලය" },
      { value: "පිරිවැය 38% අඩුවීම", label: "කැණීම් අනවශ්‍ය පුනරාවර්තනය" },
      { value: "කැණීම් රහිත", label: "තාවකාලික තහනම් ආරක්ෂාව", accent: true },
    ],
    figLabel: "රූපය 1.0",
    figTitle: "RDA සහ භූ-තාක්ෂණික පෙළගැස්ම සමාලෝචනය",
    figCaption: "රූපය 1.0 — RDA සහ භූ-තාක්ෂණික කණ්ඩායම RoadSync GIS කොරිඩෝ පෙළගැස්ම සමාලෝචනය කරයි, බස්නාහිර පළාත A2 කොරිඩෝව",
    figChip: "අවසරපත්‍රය නිෂ්කාශිතයි: WP-RDA-2025-0891",
    imageAlt:
      "ඇස්ෆල්ට් අතුරන කණ්ඩායමක් අසල GIS ටැබ්ලටයක් සහ බ්ලූප්‍රින්ට් සමඟ මාර්ග නැවත අතුරන වැඩ සම්බන්ධීකරණය කරන සිවිල් ඉංජිනේරුවන් සහ අධීක්ෂකවරු",
    calibratedTitle: "සමීක්ෂණ කැඩැස්ටර් අංශක කරන ලදී",
    calibratedNote: "SLD99 ජාල නිරවද්‍යතාව: ±50mm",
  },
  lifecycle: {
    eyebrow: "ව්‍යවස්ථාපිත ප්‍රොටෝකෝලය",
    title: "ජාතික යටිතල පහසුකම් ජීවන චක්‍ර අනුපිළිවෙල",
    directive: "නාගරික සහ රාජ්‍ය කොරිඩෝ පුරා රු. මිලියන 5 ඉක්මවන සියලු පොදු ප්‍රාග්ධන වැඩ සඳහා කැබිනට් නියෝගය මගින් නියම කර ඇත.",
    activeBadge: "ක්‍රියාකාරී හර",
    listLabel: "යටිතල පහසුකම් ජීවන චක්‍ර අදියර",
    stages: [
      { name: "සැලසුම්", desc: "ප්‍රජා අවශ්‍යතාව සහ අයවැය වෙන්කිරීම ලියාපදිංචි කෙරේ.", tag: "ප්‍රාග්ධන අවශ්‍යතාව" },
      { name: "සම්බන්ධීකරණය", desc: "බහු-ආයතනික අවකාශීය සමමුහුර්තය සහ ගැටුම් නිරාකරණය.", tag: "අවකාශීය සමමුහුර්තය" },
      { name: "අනුමත කිරීම", desc: "අන්තර්-ආයතනික ඒකාබද්ධ මාර්ග අයිතිය අවසරපත්‍රය නිකුත් කෙරේ.", tag: "අවසර නිෂ්කාශනය" },
      { name: "ඉදිකිරීම", desc: "අනුපිළිවෙලින් කැණීම්, උපයෝගිතා ස්ථාපනය සහ අගල් කැපීම.", tag: "සිවිල් ක්‍රියාත්මක කිරීම" },
      { name: "සත්‍යාපනය", desc: "සිවිල් සම්පීඩන පරීක්ෂාව සහ QA සංවේදක වලංගු කිරීම.", tag: "QA විගණනය" },
      { name: "අධීක්ෂණය", desc: "IoT කොරිඩෝ අධීක්ෂක මගින් අතුරා අවසන් වූ පසු ස්ථාවරත්වය නිරීක්ෂණය කරයි.", tag: "සජීවී සංවේදක" },
      { name: "සම්පූර්ණ කිරීම", desc: "මහජන කොරිඩෝව නැවත විවෘත කිරීම සහ අවසන් වත්කම් ගැසට් පත්‍රය.", tag: "මහජන භාරදීම" },
      { name: "නඩත්තුව", desc: "හදිසි නොවන කැණීම් සඳහා අවුරුදු 5ක ව්‍යවස්ථාපිත තහනම.", tag: "වත්කම් ලේඛනය" },
    ],
  },
  problem: {
    eyebrow: "පද්ධතිමය අභියෝගය",
    title: "ඛණ්ඩිත කැණීම් ගැටලුව",
    lede: "ශ්‍රී ලංකාවේ නාගරික මාර්ග අසමමුහුර්ත සිවිල් ව්‍යාපෘතිවල අවසන් නොවන චක්‍රයකින් පීඩා විඳිති. ප්‍රජා මුදල් විශාල ප්‍රමාණයක් වැය කර නැවත අතුරන ලද මාර්ග, හුදකලාව ක්‍රියා කරන උපයෝගිතා සපයන්නන් විසින් සති කිහිපයකින් නැවත කඩා දමයි.",
    plateLabel: "පුවරුව 2.1 — ක්ෂේත්‍ර වාර්තා රූපය",
    plateCaption: "සමමුහුර්ත කොරිඩෝ තහනම බලාත්මක කිරීමට පෙර සක්‍රීය NWSDB ජල ප්‍රධාන නල අගල් කැණීම.",
    plateChip: "ගාල්ල පාර A2 කොරිඩෝව",
    imageAlt: "ශ්‍රී ලංකාවේ නාගරික මාර්ගයක් අසල දැව ආධාරක සහිත ජල නල අගලක් සහ NWSDB කාර්ය මණ්ඩලය",
    beforeTitle: "සාම්ප්‍රදායික තත්ත්වය",
    beforeTag: "අසම්බන්ධ සිලෝ",
    beforeItems: [
      { title: "මාර්තු — RDA ඇස්ෆල්ට් නැවත අතුරීම", text: "කිලෝමීටර් 3.2ක කොරිඩෝවක බයින්ඩර් සහ ඉහළ ස්ථරය සඳහා රු. මිලියන 42ක් ආයෝජනය කෙරිණි. මාර්ගය නිවැරදි යැයි ප්‍රකාශ කෙරිණි." },
      { title: "මැයි — NWSDB ප්‍රධාන නල අගල් කැපීම", text: "ජලසම්පාදන මණ්ඩලය ඩක්ටයිල් අයන් නලයක් මාරු කිරීමට මීටර් 1.2ක දිගු අගලක් කපයි. මාර්ගයේ ව්‍යුහාත්මක මුද්‍රාව විනාශ විය." },
      { title: "අගෝස්තු — විදුලි සංදේශ කෙඳි අගල් කැපීම", text: "උප කොන්ත්‍රාත්කරු ප්‍රකාශ නල සඳහා හරස් නාළ කපයි. මතුපිට අන්තරායකර ඇලවූ අලුත්වැඩියාවක් බවට පත් විය." },
    ],
    beforeOutcome: "ප්‍රතිඵලය: රු. මිලියන 18.5ක නාස්තියක් සහ සති 14ක රථවාහන තදබදය",
    afterTitle: "INFRAOS ප්‍රොටෝකෝලය සමඟ",
    afterTag: "සමමුහුර්ත සම-ස්ථානගත කිරීම",
    afterItems: [
      { title: "මාසය 0 — ඒකාබද්ධ කොරිඩෝ වෙන්කිරීම", text: "RDA සැලසුම් කළ නැවත අතුරීම දින 180කට පෙර නිවේදනය කරයි. NWSDB, CEB සහ SLT ස්වයංක්‍රීය අවකාශීය ගැටුම් එන්ජිම මගින් දැනුම් දෙනු ලැබේ." },
      { title: "මාස 1-2 — උප-පෘෂ්ඨ ඒකාබද්ධ සිවිල් වැඩ", text: "මතුපිට සූදානම් කිරීමට පෙර ජල නල සහ කෙඳි නාළ හවුල් උපයෝගිතා අගලක එකට ස්ථාපනය කෙරේ." },
      { title: "මාසය 3 — අවසන් අතුරීම සහ අවුරුදු 5ක අගුලු දැමීම", text: "නිරවද්‍ය සම්පීඩනයක් මත අතුරීම අවසන් කෙරේ. ඩිජිටල් මුද්‍රාව 2030 දක්වා හදිසි නොවන සියලු කැණීම්වලින් කොරිඩෝව අගුළු දමයි." },
    ],
    afterOutcome: "ප්‍රතිඵලය: තනි බාධා කාලසීමාවක් සහ ආරක්ෂිත බදු ගෙවන්නාගේ ආයෝජනය",
  },
  incident: {
    eyebrow: "අවකාශීය-කාලීන රෝග විනිශ්චය",
    title: "සැබෑ ලෝක සිදුවීම් අනුපිළිවෙල අනුකරණය",
    flag: "ගැටුම ලකුණු කෙරිණි: ගාල්ල පාර (A2) km 14+200",
    plateLabel: "පුවරුව 3.4 — සිවිල් ක්‍රියාත්මක කිරීමේ පදනම",
    plateCaption: "බහු-ආයතනික මාර්ග අතුරීම සිදුවෙමින් පවතී; තනි-ගමන් සම්බන්ධීකරණය අකාලයේ අගල් කැපීම වළක්වයි.",
    plateChip: "RDA සහ නගර සභා කාර්ය මණ්ඩලය",
    imageAlt: "ශ්‍රී ලාංකික වීදියක පේවර් සහ රෝලර් භාවිතයෙන් ඇස්ෆල්ට් අතුරන කණ්ඩායමක් සහ වැඩ පරීක්ෂා කරන පරීක්ෂකවරු",
    alertTitle: "INFRAOS AI ගැටුම් සංඥාව — බරපතළ අනතුරු ඇඟවීම",
    alertText: "ඉහළ බරපතළතාවයක් සහිත අවකාශීය-කාලීන අතිච්ඡාදනයක් හඳුනාගත්තා — නල මාර්ගය අතුරීමට පෙර නැවත කාලසටහන්ගත කරයි",
    alertTag: "ස්වයංක්‍රීය නැවත අනුපිළිවෙල යොදන්න",
    alertTagApplied: "නැවත අනුපිළිවෙල යොදන ලදී (සංකල්පීය)",
    collision: "ගැටුම",
    cleared: "නිෂ්කාශිතයි",
    dayTicks: ["දින 0", "දින 15", "දින 30", "දින 45", "දින 60"],
    lanes: [
      { agency: "RDA සිවිල් වැඩ", type: "(නැවත අතුරීම)", bar: "දින 1 – 14: ඇස්ෆල්ට් අතුරීම", resequencedBar: "දින 20 – 34: ඇස්ෆල්ට් අතුරීම", sub: "3.2 km" },
      { agency: "NWSDB උපයෝගිතා", type: "(ජල ප්‍රධාන නලය)", bar: "දින 25: අගල් කැපීම", resequencedBar: "දින 1 – 15: ඒකාබද්ධ අගල් කැපීම" },
      { agency: "SLT විදුලි සංදේශ", type: "(ප්‍රකාශ කෙඳි)", bar: "දින 40: සුළු අගල", resequencedBar: "දින 1 – 15: හවුල් නාළ" },
    ],
    platformAction: "වේදිකා ක්‍රියාමාර්ගය: පද්ධතිය NWSDB සහ SLT වැඩ කාලසීමා අතුරීමට පෙර දින -15 වෙත මාරු කළේය; RDA බයින්ඩර් දින 20 වෙත නැවත කාලසටහන්ගත කළේය.",
    outcomeTag: "කැණීම් හානි නැතැයි සහතිකයි",
    laneListLabel: "පෙළ ලෙස අනුපිළිවෙල",
  },
  capabilities: {
    eyebrow: "පද්ධති ගෘහ නිර්මාණය",
    title: "යටිතල පහසුකම් පාලනයේ ප්‍රධාන කුළුණු පහ",
    lede: "පළාත් සහ ජාතික ව්‍යාපෘති නල මාර්ග පුරා විනිවිදභාවය තහවුරු කිරීමට නිර්මාණය කළ ඒකාබද්ධ, නීත්‍යානුකූලව බැඳෙන සම්බන්ධීකරණ සංරචකයකි.",
    cards: [
      { name: "ProjectTrace", text: "සියලු රාජ්‍ය සිවිල් යටිතල පහසුකම් ටෙන්ඩර්වල කේන්ද්‍රීය ලේඛනය සහ අවකාශීය ලුහුබැඳීම.", link: "ලේඛනය ගවේෂණය කරන්න" },
      { name: "RoadSync", text: "එකම මාර්ග කොටසේ අඛණ්ඩ කැණීම් වළක්වන ආයතන-අතර කාලසටහන් එන්ජිම.", link: "කාලසටහන් බලන්න" },
      { name: "InfraMap", text: "භූගත උපයෝගිතා, මාර්ග වෙන්කිරීම් සහ සජීවී වැඩ අවසරපත්‍ර ආවරණය කරන ජාතික GIS ස්ථරය.", link: "GIS සිතියම විවෘත කරන්න" },
      { name: "AI අවදානම් බුද්ධිය", text: "අතිච්ඡාදනය වන කාලසටහන් සහ රථවාහන බලපෑම් අවදානම් ලකුණු කරන පුරෝකථන ගැටුම් හඳුනාගැනීම.", link: "ගැටුම් ලඝු සටහන බලන්න" },
      { name: "DocTrace", text: "අනුකූලතාව, පරීක්ෂණ වාර්තා සහ කොන්ත්‍රාත්කරු අනුමත කිරීම් සඳහා වෙනස් කළ නොහැකි ඩිජිටල් විගණන සටහන්.", link: "විගණන පිරිවිතර" },
    ],
  },
  dispatch: {
    eyebrow: "පද්ධති අතුරුමුහුණත",
    title: "මෙහෙයුම් යවන කොන්සෝලය",
    conceptual: "සංකල්පීය පෙරදසුන: RoadSync බහු-ආයතනික සම්බන්ධීකරණ න්‍යාසය",
    mockAddress: "https://console.infraos.gov.lk/corridors/colombo-central",
    tlsBadge: "ආරක්ෂිත GovNet TLS 1.3",
    plateLabel: "රූපය 4.0 — නගර සභා යවන කොන්සෝලය",
    plateCaption: "සජීවී InfraMap GIS ලේඛනය වෙත පිවිසෙන කොළඹ මහ නගර සභාව සහ මධ්‍යම යවන මේසය.",
    plateChip: "සජීවී CAD සහ GIS දත්ත",
    imageAlt: "බහු-මොනිටර GIS දර්ශක සහිත නාගරික ඉංජිනේරු පාලන සහ යවන මේසය",
    zone: "කලාපය: කොළඹ බටහිර (වාට්ටුව 07)",
    resolution: "විභේදනය: 1:1,000",
    layer: "ස්ථරය: භූගත කැඩැස්ටරය",
    simulation: "සමමුහුර්ත අනුකරණය ක්‍රියාත්මකයි",
    tableCaption: "සංකල්පීය RoadSync සම්බන්ධීකරණ න්‍යාසය — කොරිඩෝ, ප්‍රධාන ආයතන, නියමිත කාලසීමා සහ ගැටුම් තත්ත්වය",
    columns: ["කොරිඩෝව / මාර්ග හැඳුනුම", "ප්‍රධාන ආයතනය", "සම-අයදුම්කරු ආයතන", "නියමිත කාලසීමාව", "ගැටුම් තත්ත්වය"],
    status: { locked: "නිෂ්කාශිත සහ අගුළු දමා ඇත", pending: "පෙළගැස්ම පොරොත්තුවෙන්", blocked: "අතිච්ඡාදනය අවහිරයි" },
    scrollHint: "සියලු තීරු බැලීමට වගුව පැත්තට අදින්න",
  },
  audiences: {
    eyebrow: "පරිසර පද්ධති ප්‍රවේශය",
    title: "කැපවූ ප්‍රජා ද්වාර",
    lede: "භූමිකා-විශේෂිත වැඩ ප්‍රවාහ, සජීවී අවසර මෙවලම් හෝ මහජන වාර්තාකරණ ප්‍රවාහ වෙත පිවිසීමට ඔබේ ප්‍රජා මෙහෙයුම් පැතිකඩ තෝරන්න.",
    plateLabel: "පුවරුව 2.3 — ව්‍යවස්ථාපිත තත්ත්ව සහතිකය",
    plateCaption: "SLS 1248 සිවිල් කොරිඩෝ ප්‍රමිතීන්ට අනුකූලව Chainage +4.2 KM ප්‍රතිසංස්කරණයෙන් පසු පරීක්ෂාව.",
    plateChip: "RDA QA / NSDI තහවුරු කරන ලදී",
    imageAlt: "මාර්ග අයිතිය අඩවි පරීක්ෂාව සහ භූ-තාක්ෂණික සමීක්ෂණය සිදු කරන ජ්‍යෙෂ්ඨ ශ්‍රී ලාංකික සිවිල් ඉංජිනේරුවන් සහ ව්‍යාපෘති පරීක්ෂකවරු",
    cards: [
      { tag: "මහජන ප්‍රවේශය", title: "පුරවැසියන් සහ මාර්ග පරිශීලකයන්", text: "ප්‍රදේශීය මාර්ග වැඩ ලුහුබඳින්න, අසම්බන්ධ කැණීම් වාර්තා කරන්න, ඔබේ අසල්වැසි ප්‍රදේශයේ තහවුරු කළ මාර්ග නැවත විවෘත කිරීමේ දින බලන්න.", cta: "මහජන උපකරණ පුවරුව" },
      { tag: "අමාත්‍යාංශ සහ ලේකම් කාර්යාල", title: "ව්‍යවස්ථාපිත ආයතන සහ අමාත්‍යාංශ", text: "අමාත්‍යාංශ අධීක්ෂණය, අන්තර්-ආයතනික ප්‍රතිපත්ති අනුමැතීන්, ප්‍රාග්ධන වියදම් ලුහුබැඳීම සහ මූල්‍ය විනිවිදභාව විගණන.", cta: "විධායක ද්වාරය" },
      { tag: "සිවිල් ක්‍රියාත්මක කිරීම", title: "කොන්ත්‍රාත්කරුවන් සහ සමීක්ෂකයන්", text: "වැඩ දැන්වීම් ඉදිරිපත් කරන්න, උපයෝගිතා සම්බන්ධීකරණ කාලසීමා ඉල්ලන්න, ට්‍රැෆික් කළමනාකරණ සැලසුම් ගොනු කරන්න සහ ඇස්ෆල්ට් අතුරීම් සටහන් කරන්න.", cta: "කොන්ත්‍රාත්කරු පර්යන්තය" },
    ],
  },
  transparency: {
    eyebrow: "ප්‍රජා අවංකභාවය සහ වගවීම",
    title: "අධ්‍යයනික සහ නියමු ප්‍රකාශය",
    lede: "INFRAOS යනු නවීන ජාතික ඩිජිටල් රාජ්‍ය පද්ධති ආදර්ශනය කිරීමට නිර්මාණය කළ විශ්වවිද්‍යාල-නායකත්වයෙන් යුත් GovTech පර්යේෂණ මූලාකෘතියකි.",
    items: [
      { label: "තත්ත්වය", title: "ප්‍රදර්ශන මූලාකෘතිය", text: "මෙම අඩවිය අධ්‍යයනික GovTech ප්‍රදර්ශනයක් ඉදිරිපත් කරයි. එය ක්‍රියාත්මක රාජ්‍ය සේවාවක් නොවේ." },
      { label: "නියමු සීමාව", title: "බස්නාහිර පළාත", text: "ශ්‍රී ලංකාව, බස්නාහිර පළාත (කොළඹ මහ නගර සභාව, A2/A1 අධිවේගී කොරිඩෝ සහ මහ කොළඹ මහානගර සීමා)." },
      { label: "අධ්‍යයනික අධීක්ෂණය", title: "විශ්වවිද්‍යාල GovTech මුලපිරීම", text: "විශ්වවිද්‍යාල GovTech මුලපිරීම සමඟ සහයෝගයෙන් අවකාශීය නාගරික සහ ප්‍රවාහන පද්ධති ආකෘතිකරණ විද්‍යාගාරය විසින් සංවර්ධනය කරන ලදී." },
    ],
    cadenceEyebrow: "යෙදවුම් රිද්මය (සංකල්පීය)",
    cadenceTitle: "ජාතික වේදිකා යෙදවුම් රිද්මය",
    cadenceLede: "ජාතික විවෘත කොන්ත්‍රාත් නියෝගය යටතේ ආදර්ශනය කරන ලද සංකල්පීය ආයතනික යෙදවුම් තත්ත්වය.",
    cadenceItems: [
      {
        status: "නියමු ව්‍යාපෘතියේ සජීවී",
        phase: "1 අදියර බලයලත්",
        title: "කොළඹ මහ නගර සභාව (CMC) සහ මහනුවර මධ්‍යම කොරිඩෝව",
        text: "ප්‍රධාන මාර්ග 48ක් පුරා සක්‍රීය ව්‍යවස්ථාපිත බලාත්මක කිරීම. සියලුම භූගත වැඩ සඳහා පූර්ණ බහු-ආයතනික තහනම බලපැවැත්වේ.",
        metricLabel: "අනුකූලතා අනුපාතය",
        metricValue: "94.2%",
        progress: 94,
        tone: "success",
      },
      {
        status: "සංවර්ධනය වෙමින්",
        phase: "ඉලක්කය Q3 2025",
        title: "දක්ෂිණ අධිවේගී පෝෂක මාර්ග සහ NWSDB GIS සමමුහුර්තය",
        text: "ගාල්ල සහ මාතර දිස්ත්‍රික්ක හරහා කිලෝමීටර් 1,400ක පැරණි භූගත ජල සම්ප්‍රේෂණ නල ඒකාබද්ධ ස්ථරවලට ඩිජිටල්කරණය කිරීම.",
        metricLabel: "කැඩැස්ට්‍රල් සිතියම්ගත කිරීම",
        metricValue: "68.0%",
        progress: 68,
        tone: "attention",
      },
      {
        status: "සැලසුම් කළ නල මාර්ගය",
        phase: "ඉලක්කය Q4 2025",
        title: "ජාතික ප්‍රකාශ-කෙඳි නාළ හවුල් කිරීමේ ප්‍රමිතිය",
        text: "තනි අගල් කැපීම තුරන් කිරීම සඳහා ජාතික ප්‍රධාන මාර්ග (A සහ AA පන්ති) හරහා ක්ෂුද්‍ර-නාළ ස්ථාපනය ප්‍රමිතිගත කරන කැබිනට් ප්‍රතිපත්තිය.",
        metricLabel: "කෙටුම්පත් ප්‍රතිපත්ති ගැසට් පත්‍රය",
        metricValue: "පූර්ව-පාර්ලිමේන්තු",
        progress: 25,
        tone: "secondary",
      },
    ],
    note: "මෙම පිටුවේ සංඛ්‍යා, ඡායාරූප, කාලසටහන් සහ කොන්සෝල දර්ශන සංකල්පීය හා නිදර්ශනාත්මක වේ. ඒවා සජීවී දත්ත නියෝජනය නොකරයි.",
  },
  footer: {
    lifecycleTitle: "ජාතික යටිතල පහසුකම් ජීවන චක්‍ර රාමුව",
    lifecycleNote: "ව්‍යවස්ථාපිත බහු-ආයතනික අනුපිළිවෙල",
    platformTitle: "වේදිකාව",
    platformLinks: [
      "ProjectTrace එන්ජිම",
      "RoadSync කොරිඩෝ වෙන්කිරීම",
      "InfraMap GIS අවකාශීය ලේඛනය",
      "AI අවදානම් බුද්ධිය",
      "DocTrace අනුකූලතා ලෙජරය",
    ],
    servicesTitle: "මහජන සේවා",
    servicesLinks: [
      "ජාතික ප්‍රාග්ධන වැඩ ලේඛනය",
      "අගල් කැපීම සහ කැණීම් සිතියම",
      "මහජන ව්‍යාපෘති විමසුම්",
      "පුරවැසි ප්‍රතිපෝෂණ සහ දුක්ගැනවිලි",
      "හදිසි උපයෝගිතා බාධා දැන්වීම්",
    ],
    governanceTitle: "පාලනය",
    governanceLinks: [
      "ජාතික යටිතල පහසුකම් ප්‍රතිපත්තිය",
      "අන්තර්-ආයතනික සම-ස්ථානගත කිරීමේ ප්‍රොටෝකෝල",
      "මාර්ග අයිතිය සම්බන්ධීකරණ පනත",
      "විවෘත කොන්ත්‍රාත් දත්ත ප්‍රමිතිය",
      "මහජන වියදම් විගණන",
    ],
    contactTitle: "සම්බන්ධතා සහ සම්බන්ධීකරණය",
    contactUnit: "අන්තර්-ආයතනික මෙහෙයුම් ඒකකය",
    contactAgency: "මාර්ග සංවර්ධන අධිකාරිය (RDA) සහ NWSDB සම්බන්ධීකරණ මධ්‍යස්ථානය",
    contactAddress: "ඩෙන්සිල් කොබ්බෑකඩුව මාවත, බත්තරමුල්ල / කොළඹ 01, ශ්‍රී ලංකාව",
    contactText: "පුරවැසි ඇමතුම්: 1919 · NWSDB: 1939 · CEB: 1987 · SLT: 1212",
    contactLink: "උදව් මේසය අමතන්න",
    slaNote: "SLA: පැය 48ක ව්‍යවස්ථාපිත පිළිගැනීම (14 වන වගන්තිය, ජාතික යටිතල පහසුකම් සම්බන්ධීකරණ නියෝගය).",
    gazetteRef: "ප්‍රමිති: SLS 1248 සිවිල් සම්පීඩනය · OCDS සහ ISO 19115 GIS · අවුරුදු 5ක තහනම් ගැසට් පත්‍රය.",
    privacy: "පෞද්ගලිකත්ව ප්‍රතිපත්තිය",
    accessibility: "ප්‍රවේශ්‍යතා ප්‍රමිතීන්",
    rights: "© 2025 INFRAOS — අධ්‍යයනික GovTech පර්යේෂණ මූලාකෘතිය (බස්නාහිර පළාත් නියමු ව්‍යාපෘතිය).",
    languageLabel: "නිල භාෂා සමානාත්මතාව",
  },
};

const ta: LpCopy = {
  meta: {
    title: "INFRAOS — தேசிய உள்கட்டமைப்பு நுண்ணறிவு & ஒருங்கிணைப்பு தளம்",
    description:
      "முன்கணிப்பு ஒருங்கிணைப்பு மூலம் மீண்டும் மீண்டும் நடக்கும் சாலை அகழ்வுகளை இல்லாமல் செய்ய, இலங்கை முழுவதும் குடிமை நிறுவனங்கள், பயன்பாட்டு வழங்குநர்கள் மற்றும் ஒப்பந்ததாரர்களை ஒன்றிணைக்கிறது. பல்கலைக்கழகம் முன்னெடுக்கும் GovTech ஆராய்ச்சி முன்மாதிரி.",
  },
  skipLabel: "முதன்மை உள்ளடக்கத்திற்குச் செல்",
  nav: {
    label: "முதன்மை",
    home: "முகப்பு",
    about: "எங்களைப் பற்றி",
    howItWorks: "இது எவ்வாறு செயல்படுகிறது",
    faq: "அடிக்கடி கேட்கப்படும் கேள்விகள்",
    contact: "தொடர்பு",
    signIn: "அங்கீகரிக்கப்பட்ட நுழைவாயில் / உள்நுழை",
    openMenu: "பட்டியைத் திற",
    closeMenu: "பட்டியை மூடு",
    menuTitle: "பட்டி",
    languageLabel: "மொழி",
    affiliation: "கல்விசார் GovTech செயல்விளக்கம் · மேல் மாகாண வழித்தட முன்னோடித் திட்டம்",
    ministry: "போக்குவரத்து & நெடுஞ்சாலைகள் அமைச்சு (ஆராய்ச்சி மாதிரி)",
    publicNotices: "பொது அறிவிப்புகள்",
    helpdesk: "உதவி மையத்தைத் தொடர்புகொள்ள",
  },
  hero: {
    badge: "சட்டப்பூர்வ பொதுச் சேவை முன்னோடித் திட்டம் 2025",
    title: "தேசிய உள்கட்டமைப்பு நுண்ணறிவு & ஒருங்கிணைப்பு தளம்",
    lede: "முன்கணிப்பு ஒருங்கிணைப்பு மூலம் மீண்டும் மீண்டும் நடக்கும் சாலை அகழ்வுகளை இல்லாமல் செய்ய, இலங்கை முழுவதும் குடிமை நிறுவனங்கள், பயன்பாட்டு வழங்குநர்கள் மற்றும் ஒப்பந்ததாரர்களை ஒன்றிணைக்கிறது.",
    ctaPrimary: "இது எவ்வாறு செயல்படுகிறது எனப் பார்",
    ctaSecondary: "பொதுத் திட்டங்களைப் பார்",
    stats: [
      { value: "14 நிறுவனங்கள்", label: "ஒற்றை கடாஸ்ட்ரல் வலை" },
      { value: "38% செலவுக் குறைப்பு", label: "அகழ்வு மீள்செயல்" },
      { value: "அகழ்வற்ற", label: "தற்காலிகத் தடை பாதுகாப்பு", accent: true },
    ],
    figLabel: "படம் 1.0",
    figTitle: "RDA & புவிதொழில்நுட்ப சீரமைப்பு மதிப்பாய்வு",
    figCaption: "RDA & புவிதொழில்நுட்பக் குழு RoadSync GIS வழித்தட சீரமைப்பை மதிப்பாய்வு செய்கிறது, மேல் மாகாண A2 வழித்தடம்",
    figChip: "நேரலைத் தரவுத்தள ஒத்திசைவு: செயலில்",
    imageAlt:
      "நிலக்கீல் பரப்பும் குழுவின் அருகே GIS டேப்லெட் மற்றும் வரைபடங்களுடன் சாலை மறுபரப்பை ஒருங்கிணைக்கும் சிவில் பொறியாளர்களும் மேற்பார்வையாளர்களும்",
    calibratedTitle: "நில அளவை கடாஸ்டர் அளவீடு செய்யப்பட்டது",
    calibratedNote: "SLD99 வலை துல்லியம்: ±50mm",
  },
  lifecycle: {
    eyebrow: "சட்டப்பூர்வ நெறிமுறை",
    title: "தேசிய உள்கட்டமைப்பு வாழ்க்கைச் சுழற்சி வரிசை",
    directive: "வர்த்தமானிப் பணிப்பாய்வு நெறிமுறை (பிரிவு 12-B) கீழ் கட்டாயமாக்கப்பட்ட எட்டு-நிலை நிறுவனங்களிடையேயான சரிபார்ப்பு வாயில்.",
    activeBadge: "செயலில் உள்ள மையம்",
    listLabel: "உள்கட்டமைப்பு வாழ்க்கைச் சுழற்சி நிலைகள்",
    stages: [
      { name: "திட்டமிடு", desc: "பொதுத் தேவை & வரவு செலவு ஒதுக்கீடு பதிவு செய்யப்படுகிறது.", tag: "மூலதனத் தேவை" },
      { name: "ஒருங்கிணை", desc: "பல நிறுவன இடஞ்சார் ஒத்திசைவு & முரண்பாடு தீர்வு.", tag: "இடஞ்சார் ஒத்திசைவு" },
      { name: "அங்கீகரி", desc: "நிறுவனங்களுக்கிடையேயான ஒருங்கிணைந்த வழியுரிமை அனுமதி வழங்கப்படுகிறது.", tag: "அனுமதி ஒப்புதல்" },
      { name: "கட்டு", desc: "வரிசைப்படுத்தப்பட்ட அகழ்வு, பயன்பாட்டுக் குழாய் பதிப்பு & அகழி வெட்டு.", tag: "சிவில் செயலாக்கம்" },
      { name: "சரிபார்", desc: "சிவில் அழுத்தச் சோதனை & QA உணரி சரிபார்ப்பு.", tag: "QA தணிக்கை" },
      { name: "கண்காணி", desc: "IoT வழித்தடக் கண்காணிப்பான்கள் பரப்புக்குப் பிந்தைய உறுதியைக் கண்காணிக்கின்றன.", tag: "நேரலை உணரிகள்" },
      { name: "நிறைவு", desc: "பொது வழித்தடம் மீண்டும் திறப்பு & இறுதிச் சொத்து வர்த்தமானி.", tag: "பொதுக் கையளிப்பு" },
      { name: "பராமரி", desc: "அவசரமற்ற அகழ்வுகளுக்கு 5 ஆண்டு சட்டப்பூர்வத் தடை.", tag: "சொத்துப் பதிவேடு" },
    ],
  },
  problem: {
    eyebrow: "அமைப்புசார் சவால்",
    title: "சிதறிய அகழ்வுச் சிக்கல்",
    lede: "இலங்கையின் நகர்ப்புறச் சாலைகள் ஒத்திசைவற்ற சிவில் திட்டங்களின் முடிவில்லாச் சுழற்சியால் பாதிக்கப்படுகின்றன. பெருமளவு பொதுப் பணத்தில் மறுபரப்பு செய்யப்பட்ட சாலைகள், தனித்தனியாகச் செயல்படும் பயன்பாட்டு வழங்குநர்களால் சில வாரங்களில் மீண்டும் உடைக்கப்படுகின்றன.",
    plateLabel: "தகடு 2.1 — களப் ஆவணப்படம்",
    plateCaption: "ஒத்திசைந்த வழித்தடத் தடை அமலாக்கத்திற்கு முன் செயலில் உள்ள NWSDB நீர்க்குழாய் அகழ்வு.",
    plateChip: "காலி வீதி A2 வழித்தடம்",
    imageAlt: "இலங்கையில் நகர்ப்புறச் சாலையின் அருகே மரத் தாங்குகளுடன் கூடிய நீர்க்குழாய் அகழி மற்றும் NWSDB குழு",
    beforeTitle: "பாரம்பரிய நிலை",
    beforeTag: "ஒருங்கிணைக்கப்படாத தனிமைகள்",
    beforeItems: [
      { title: "மார்ச் — RDA நிலக்கீல் மறுபரப்பு", text: "3.2கிமீ வழித்தடத்தில் பைண்டர் மற்றும் மேற்பரப்பு அடுக்குக்கு ரூ. 42 மில்லியன் முதலீடு. சாலை குறைபாடற்றது என அறிவிக்கப்பட்டது." },
      { title: "மே — NWSDB பிரதான குழாய் அகழ்வு", text: "நீர் வழங்கல் சபை மாற்று டக்டைல் இரும்புக் குழாய் பதிக்க 1.2மீ நீள அகழி தோண்டுகிறது. சாலையின் கட்டமைப்பு முத்திரை சேதமடைந்தது." },
      { title: "ஆகஸ்ட் — தொலைத்தொடர்பு ஃபைபர் அகழ்வு", text: "துணை ஒப்பந்ததாரர் ஒளிக் குழாய்களுக்காக குறுக்குப் பாதைகளை வெட்டுகிறார். மேற்பரப்பு ஆபத்தான ஒட்டுவேலையாகச் சிதைந்தது." },
    ],
    beforeOutcome: "விளைவு: ரூ. 18.5 மில்லியன் வீணாதல் & 14 வாரப் போக்குவரத்து நெரிசல்",
    afterTitle: "INFRAOS நெறிமுறையுடன்",
    afterTag: "ஒத்திசைந்த இணை-அமைவு",
    afterItems: [
      { title: "மாதம் 0 — ஒருங்கிணைந்த வழித்தடப் பதிவு", text: "திட்டமிட்ட மறுபரப்பை RDA 180 நாட்களுக்கு முன் அறிவிக்கிறது. NWSDB, CEB மற்றும் SLT ஆகியவற்றுக்குத் தானியங்கி இடஞ்சார் முரண்பாட்டு இயந்திரம் தெரிவிக்கிறது." },
      { title: "மாதம் 1-2 — நிலத்தடி கூட்டு சிவில் பணிகள்", text: "மேற்பரப்புத் தயாரிப்புக்கு முன் நீர்க் குழாய்களும் ஃபைபர் குழாய்களும் பகிரப்பட்ட பயன்பாட்டு அகழியில் ஒன்றாகப் பதிக்கப்படுகின்றன." },
      { title: "மாதம் 3 — இறுதிப் பரப்பு & 5 ஆண்டுப் பூட்டு", text: "சிறந்த அழுத்தத்தின் மீது பரப்புப் பணி முடிவடைகிறது. டிஜிட்டல் முத்திரை 2030 வரை அவசரமற்ற அகழ்வுகளிலிருந்து வழித்தடத்தைப் பூட்டுகிறது." },
    ],
    afterOutcome: "விளைவு: ஒற்றைத் தடங்கல் காலம் & பாதுகாக்கப்பட்ட வரி செலுத்துவோர் முதலீடு",
  },
  incident: {
    eyebrow: "இடஞ்சார்-கால நோயறிதல்",
    title: "நிஜ உலக நிகழ்வு வரிசை உருவகப்படுத்தல்",
    flag: "முரண்பாடு குறிக்கப்பட்டது: காலி வீதி (A2) km 14+200",
    plateLabel: "தகடு 3.4 — சிவில் செயலாக்க அடித்தளம்",
    plateCaption: "பல நிறுவன சாலைப் பரப்புப் பணி நடைபெறுகிறது; ஒற்றைச் சுற்று ஒருங்கிணைப்பு முன்கூட்டிய அகழி வெட்டைத் தடுக்கிறது.",
    plateChip: "RDA & நகராட்சிப் பணிக்குழு",
    imageAlt: "இலங்கைத் தெருவில் பேவர் மற்றும் ரோலர் மூலம் நிலக்கீல் இடும் குழுவும் பணியை ஆய்வு செய்யும் ஆய்வாளர்களும்",
    alertTitle: "INFRAOS AI முரண்பாட்டுக் குறி — மிக முக்கிய எச்சரிக்கை",
    alertText: "அதிக தீவிரமுள்ள இடஞ்சார்-கால மேற்பொருத்தம் கண்டறியப்பட்டது — குழாய் வழியை பரப்புக்கு முன் மறுஅட்டவணையிடுகிறது",
    alertTag: "தானியங்கி மறுவரிசைப் பார்வை",
    alertTagApplied: "மறுவரிசைப் பார்வை செயலில்",
    collision: "மோதல்",
    cleared: "ஒத்திசைந்தது",
    dayTicks: ["நாள் 0", "நாள் 15", "நாள் 30", "நாள் 45", "நாள் 60"],
    lanes: [
      { agency: "RDA சிவில் பணிகள்", type: "(மறுபரப்பு)", bar: "நாள் 1 – 14: நிலக்கீல் இடுதல்", resequencedBar: "நாள் 20 – 34: இறுதிப் பரப்பு (அகழ்வுக்குப் பின்)", sub: "3.2 km" },
      { agency: "NWSDB பயன்பாடுகள்", type: "(நீர்ப் பிரதான குழாய்)", bar: "நாள் 25: அகழ்வு", resequencedBar: "நாள் 1 – 12: பரப்புக்கு முன் குழாய் பதிப்பு" },
      { agency: "SLT தொலைத்தொடர்பு", type: "(ஒளியிழை)", bar: "நாள் 40: சிறு அகழி", resequencedBar: "நாள் 5 – 14: பகிரப்பட்ட அகழியில் ஒளியிழை" },
    ],
    platformAction: "தளச் செயல்: அமைப்பு NWSDB & SLT பணிக்காலங்களை பரப்புக்கு முன் நாள் -15 க்கு மாற்றியது; RDA பைண்டர் நாள் 20 க்கு மறுஅட்டவணையிடப்பட்டது.",
    outcomeTag: "அகழ்வுச் சேதம் இல்லை",
    laneListLabel: "உரையாக வரிசை",
  },
  capabilities: {
    eyebrow: "அமைப்புக் கட்டமைப்பு",
    title: "உள்கட்டமைப்பு ஆளுகையின் ஐந்து தூண்கள்",
    lede: "மாகாண மற்றும் தேசியத் திட்டக் குழாய்வழிகள் முழுவதும் வெளிப்படைத்தன்மையை உறுதிப்படுத்த வடிவமைக்கப்பட்ட ஒருங்கிணைந்த ஒருங்கிணைப்பு அடுக்கு.",
    cards: [
      { name: "ProjectTrace", text: "அனைத்துப் பொது சிவில் உள்கட்டமைப்பு ஒப்பந்தப்புள்ளிகளின் மையப் பதிவேடும் இடஞ்சார் கண்காணிப்பும்.", link: "பதிவேட்டை ஆராய்க" },
      { name: "RoadSync", text: "ஒரே சாலைப் பகுதியில் தொடர்ச்சியான அகழ்வுகளைத் தடுக்கும் நிறுவனங்களிடையேயான அட்டவணை இயந்திரம்.", link: "அட்டவணைகளைப் பார்" },
      { name: "InfraMap", text: "நிலத்தடிப் பயன்பாடுகள், சாலை ஒதுக்கீடுகள் மற்றும் நேரலைப் பணி அனுமதிகளை மேலடுக்கும் தேசிய GIS அடுக்கு.", link: "GIS வரைபடத்தைத் திற" },
      { name: "AI இடர் நுண்ணறிவு", text: "மேற்பொருந்தும் காலக்கோடுகளையும் போக்குவரத்துத் தாக்க இடர்களையும் குறிக்கும் முன்கணிப்பு முரண்பாட்டுக் கண்டறிதல்.", link: "முரண்பாட்டுப் பதிவைப் பார்" },
      { name: "DocTrace", text: "இணக்கம், ஆய்வு அறிக்கைகள் மற்றும் ஒப்பந்ததாரர் ஒப்புதல்களுக்கான மாற்ற முடியாத டிஜிட்டல் தணிக்கைத் தடங்கள்.", link: "தணிக்கை விவரக்குறிப்புகள்" },
    ],
  },
  dispatch: {
    eyebrow: "அமைப்பு இடைமுகம்",
    title: "செயல்பாட்டு அனுப்புகைக் கன்சோல்",
    conceptual: "கருத்தியல் முன்னோட்டம்: RoadSync பல நிறுவன ஒருங்கிணைப்பு அணி",
    mockAddress: "infraos.gov.lk/console/roadsync/matrix-colombo-03 (கருத்தியல் முன்னோட்டம்)",
    tlsBadge: "Secured GovNet TLS 1.3",
    plateLabel: "படம் 4.0 — நகராட்சி அனுப்புகைக் கன்சோல்",
    plateCaption: "GIS வழித்தடக் காட்சிகளுடன் செயல்படும் நகராட்சி மற்றும் மைய அனுப்புகை மேசை.",
    plateChip: "விளக்கப் படம்",
    imageAlt: "பல திரை GIS காட்சிகளுடன் கூடிய நகராட்சிப் பொறியியல் கட்டுப்பாடு மற்றும் அனுப்புகை மேசை",
    zone: "மண்டலம்: கொழும்பு மேற்கு (வார்டு 07)",
    resolution: "தெளிவுத்திறன்: 1:1,000",
    layer: "அடுக்கு: நிலத்தடி கடாஸ்டர்",
    simulation: "ஒத்திசைவு உருவகப்படுத்தல் இயங்குகிறது",
    tableCaption: "கருத்தியல் RoadSync ஒருங்கிணைப்பு அணி — வழித்தடங்கள், முதன்மை நிறுவனங்கள், திட்டமிட்ட காலங்கள் மற்றும் முரண்பாட்டு நிலை",
    columns: ["வழித்தடம் / சாலை அடையாளம்", "முதன்மை நிறுவனம்", "இணை விண்ணப்பதாரர் நிறுவனங்கள்", "திட்டமிட்ட காலம்", "முரண்பாட்டு நிலை"],
    status: { locked: "அனுமதிக்கப்பட்டு பூட்டப்பட்டது", pending: "சீரமைப்பு நிலுவையில்", blocked: "மேற்பொருத்தம் தடுக்கப்பட்டது" },
    scrollHint: "அனைத்து நெடுவரிசைகளையும் காண அட்டவணையைப் பக்கவாட்டில் நகர்த்தவும்",
  },
  audiences: {
    eyebrow: "சூழலமைப்பு அணுகல்",
    title: "அர்ப்பணிக்கப்பட்ட குடிமை நுழைவாயில்கள்",
    lede: "பங்கு சார்ந்த பணிப்பாய்வுகள், அனுமதிக் கருவிகள் அல்லது பொதுத் தகவல்களை அணுக உங்கள் குடிமைச் செயல்பாட்டு விவரத்தைத் தேர்ந்தெடுக்கவும்.",
    plateLabel: "தகடு 2.3 — சட்டப்பூர்வ தர உறுதிப்பாடு",
    plateCaption: "கையளிப்புக்குப் பிந்தைய சீரமைப்பு மற்றும் தர ஆய்வை மேற்கொள்ளும் சிவில் நில அளவைக் குழு.",
    plateChip: "QA சரிபார்ப்பு வாயில்",
    imageAlt: "இலங்கையில் சாலை நிர்மாணத் தளத்தில் டோட்டல் ஸ்டேஷன் கருவியுடன் சீரமைப்பைச் சரிபார்க்கும் நில அளவையாளர்கள்",
    cards: [
      { tag: "பொது அணுகல்", title: "குடிமக்கள் & சாலைப் பயனர்கள்", text: "உள்ளூர்ச் சாலைப் பணிகளைக் கண்காணிக்கவும், ஒருங்கிணைக்கப்படாத அகழ்வுகளைப் புகாரளிக்கவும், உங்கள் அண்டைப் பகுதியில் சரிபார்க்கப்பட்ட சாலை மீள்திறப்பு தேதிகளைப் பார்க்கவும்.", cta: "இது எவ்வாறு செயல்படுகிறது" },
      { tag: "அமைச்சு & செயலகம்", title: "சட்டப்பூர்வ நிறுவனங்கள் & அமைச்சுகள்", text: "அமைச்சுக் கண்காணிப்பு, நிறுவனங்களுக்கிடையேயான கொள்கை ஒப்புதல்கள், மூலதனச் செலவுக் கண்காணிப்பு மற்றும் நிதி வெளிப்படைத்தன்மைத் தணிக்கைகள்.", cta: "அங்கீகரிக்கப்பட்ட உள்நுழைவு" },
      { tag: "சிவில் செயலாக்கம்", title: "ஒப்பந்ததாரர்கள் & நில அளவையாளர்கள்", text: "பணி அறிவிப்புகளைச் சமர்ப்பிக்கவும், பயன்பாட்டு ஒருங்கிணைப்புக் காலங்களைக் கோரவும், போக்குவரத்து மேலாண்மைத் திட்டங்களைப் பதிவு செய்யவும், நிலக்கீல் இடுதலைப் பதிவிடவும்.", cta: "அங்கீகரிக்கப்பட்ட உள்நுழைவு" },
    ],
  },
  transparency: {
    eyebrow: "குடிமை நேர்மை & பொறுப்புக்கூறல்",
    title: "கல்விசார் & முன்னோடி வெளிப்படுத்தல்",
    lede: "INFRAOS என்பது நவீன தேசிய டிஜிட்டல் அரசு அமைப்புகளை மாதிரியாக்க வடிவமைக்கப்பட்ட பல்கலைக்கழகம் முன்னெடுக்கும் GovTech ஆராய்ச்சி முன்மாதிரி.",
    items: [
      { label: "நிலை", title: "செயல்விளக்க முன்மாதிரி", text: "இந்தத் தளம் ஒரு கல்விசார் GovTech செயல்விளக்கத்தை முன்வைக்கிறது. இது செயல்பாட்டில் உள்ள அரசுச் சேவை அல்ல." },
      { label: "முன்னோடி எல்லை", title: "மேல் மாகாணம்", text: "இலங்கை, மேல் மாகாணம் (கொழும்பு மாநகர சபை, A2/A1 நெடுஞ்சாலை வழித்தடங்கள் மற்றும் பெரும் கொழும்பு பெருநகர எல்லைகள்)." },
      { label: "கல்விசார் மேற்பார்வை", title: "பல்கலைக்கழக GovTech முயற்சி", text: "பல்கலைக்கழக GovTech முயற்சியுடன் இணைந்து இடஞ்சார் நகர்ப்புற & போக்குவரத்து அமைப்புகள் மாதிரியாக்க ஆய்வகத்தால் உருவாக்கப்பட்டது." },
    ],
    note: "இந்தப் பக்கத்தில் உள்ள புள்ளிவிவரங்கள், புகைப்படங்கள், அட்டவணைகள் மற்றும் கன்சோல் காட்சிகள் கருத்தியல் மற்றும் விளக்கத்திற்கானவை. அவை நேரலைத் தரவைப் பிரதிநிதித்துவப்படுத்தாது.",
    cadenceEyebrow: "சட்டப்பூர்வ நிலை & வெளிப்படைத்தன்மை",
    cadenceTitle: "தேசிய தள விரிவாக்க வரிசை",
    cadenceLede: "INFRAOS தற்போது போக்குவரத்து & நெடுஞ்சாலைகள் அமைச்சின் கூட்டு ஒருங்கிணைப்பு முயற்சியின் கீழ் மேல் மாகாணப் பெருநகர எல்லையில் செயல்படுத்தப்படுகிறது (முன்னோடிக் கருத்தியல் மாதிரி).",
    cadenceItems: [
      {
        status: "செயலில் — கட்டம் I",
        phase: "2024 – 2025",
        title: "மேல் மாகாண வழித்தட வலையமைப்பு",
        text: "கொழும்பு மாநகர சபை (CMC) எல்லைகள் மற்றும் A-தர நெடுஞ்சாலை அணுகு சாலைகளில் RDA, NWSDB மற்றும் CEB தரவுத்தளங்கள் ஒத்திசைக்கப்பட்டன.",
        metricLabel: "கடாஸ்டர் வரைபடம்",
        metricValue: "100% ஒத்திசைவு",
        progress: 100,
        tone: "success",
      },
      {
        status: "விரிவாக்கம்",
        phase: "Q3 / Q4 2025",
        title: "மத்திய & தென் மாகாண விரிவாக்கம்",
        text: "கண்டி மற்றும் காலி மாநகர சபைகளின் மரபுப் பயன்பாட்டுப் பதிவேடுகளை ஒருங்கிணைந்த SLD99 தேசிய கடாஸ்ட்ரல் வலைக்குள் இணைத்தல்.",
        metricLabel: "தரவு உட்கொள்ளல்",
        metricValue: "64% நிறைவு",
        progress: 64,
        tone: "attention",
      },
      {
        status: "திட்டமிடப்பட்ட குழாய்வழி",
        phase: "இலக்கு Q4 2025",
        title: "தேசிய ஒளியிழைக் குழாய் பகிர்வுத் தரம்",
        text: "தனித்தனி அகழ்வுகளை ஒழிக்க தேசியப் பிரதான சாலைகளில் (A & AA வகுப்புகள்) நுண்-குழாய் பதிப்புகளைத் தரப்படுத்தும் அமைச்சரவைக் கொள்கை.",
        metricLabel: "வரைவுக் கொள்கை வர்த்தமானி",
        metricValue: "பாராளுமன்றத்திற்கு முன்",
        progress: 25,
        tone: "secondary",
      },
    ],
  },
  footer: {
    lifecycleTitle: "தேசிய உள்கட்டமைப்பு வாழ்க்கைச் சுழற்சிக் கட்டமைப்பு",
    lifecycleNote: "கட்டாய 8-நிலை நிறுவன வரிசை",
    platformTitle: "தளம்",
    platformLinks: ["ProjectTrace", "RoadSync", "InfraMap", "AI இடர் நுண்ணறிவு", "DocTrace"],
    servicesTitle: "பொதுச் சேவைகள்",
    servicesLinks: [
      "தேசிய மூலதனப் பணிப் பதிவேடு",
      "அகழ்வு & குழி வெட்டு வரைபடம்",
      "பொதுத் திட்ட விசாரணைகள்",
      "குடிமக்கள் கருத்து & குறைதீர்ப்பு",
      "அவசரப் பயன்பாட்டுத் தடங்கல் அறிவிப்புகள்",
    ],
    governanceTitle: "ஆளுகை",
    governanceLinks: [
      "தேசிய உள்கட்டமைப்புக் கொள்கை",
      "நிறுவனங்களுக்கிடையேயான இணை-அமைவு நெறிமுறைகள்",
      "வழியுரிமை ஒருங்கிணைப்புச் சட்டம்",
      "திறந்த ஒப்பந்தத் தரவுத் தரம்",
      "பொதுச் செலவினத் தணிக்கைகள்",
    ],
    contactTitle: "தொடர்பு & இணைப்பு",
    contactUnit: "நிறுவனங்களுக்கிடையேயான செயல்பாட்டுப் பிரிவு",
    contactAgency: "வீதி அபிவிருத்தி அதிகாரசபை (RDA) & NWSDB இணைப்புப் பிரிவு",
    contactAddress: "டென்சில் கொப்பேகடுவ மாவத்தை, பத்தரமுல்ல / கொழும்பு 01, இலங்கை",
    contactText: "குடிமக்கள் அழைப்பு எண்: 1919 · NWSDB: 1939 · CEB: 1987 · SLT: 1212",
    contactLink: "உதவி மையத்தைத் தொடர்புகொள்ள",
    slaNote: "SLA: 48 மணிநேர சட்டப்பூர்வ ஒப்புகை (பிரிவு 14, தேசிய உள்கட்டமைப்பு ஒருங்கிணைப்புப் பணிப்புரை).",
    gazetteRef: "தரநிலைகள்: SLS 1248 சிவில் அழுத்தம் · OCDS & ISO 19115 GIS · 5 ஆண்டுத் தடை வர்த்தமானி.",
    privacy: "தனியுரிமைக் கொள்கை",
    accessibility: "அணுகல்தன்மை (WCAG 2.2 AA)",
    rights: "© 2025 INFRAOS — பல்கலைக்கழக GovTech ஆராய்ச்சி முன்மாதிரி (மேல் மாகாண முன்னோடி).",
    languageLabel: "அதிகாரப்பூர்வ மொழிச் சமநிலை",
  },
};

const COPY: Record<PublicLocale, LpCopy> = { en, si, ta };

export function getLpCopy(locale: PublicLocale): LpCopy {
  return COPY[locale];
}

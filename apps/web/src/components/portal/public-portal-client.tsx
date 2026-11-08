"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { AuthLocale } from "@/lib/auth/types";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

type CorridorProjectRow = {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  agencyCode: "RDA" | "NWSDB" | "CEB" | "CMC" | "UDA";
  agencyBadgeStyle: string;
  district: string;
  commuterAdvisory: string;
  advisoryColor: "orange" | "red" | "emerald";
  capitalAllocation: string;
  disbursedPct: number;
  completionTarget: string;
  statusTag: string;
};

const CORRIDOR_PROJECTS: CorridorProjectRow[] = [
  {
    id: "rda-2026-bl-04",
    code: "PRJ-RDA-2026-BL04",
    title: "Baseline Road Phase III Flyover & Grade Separation",
    subtitle: "CH 04+150 to CH 06+800 · Piling & Pier Head Construction",
    agencyCode: "RDA",
    agencyBadgeStyle: "bg-[#d7e3f6] text-[#101c29]",
    district: "Colombo 09 (Dematagoda)",
    commuterAdvisory: "2 Lanes Restricted · Use Orugodawatta Bypass",
    advisoryColor: "orange",
    capitalAllocation: "LKR 1,850,000,000",
    disbursedPct: 72,
    completionTarget: "14 Nov 2026",
    statusTag: "On-Schedule",
  },
  {
    id: "nwsdb-2026-md-11",
    code: "PRJ-NWSDB-2026-MD11",
    title: "Greater Colombo Water Rehabilitation — Marine Drive Feeder",
    subtitle: "CH 01+200 to CH 02+450 · High-Density Polyethylene Pipe Relaying",
    agencyCode: "NWSDB",
    agencyBadgeStyle: "bg-[#e1e8fd] text-[#141b2b]",
    district: "Colombo 03 (Kollupitiya)",
    commuterAdvisory: "Night Trenching (22:00–05:00) · Steel Plates by Day",
    advisoryColor: "red",
    capitalAllocation: "LKR 640,000,000",
    disbursedPct: 45,
    completionTarget: "30 Aug 2026",
    statusTag: "Joint Trenching",
  },
  {
    id: "ceb-2026-hr-08",
    code: "PRJ-CEB-2026-HR08",
    title: "High Level Road (A004) Underground 33kV Grid Ducting",
    subtitle: "CH 08+400 to CH 11+200 · Joint SLT-Mobitel Optical Conduit",
    agencyCode: "CEB",
    agencyBadgeStyle: "bg-[#dce2f7] text-[#141b2b]",
    district: "Nugegoda — Maharagama",
    commuterAdvisory: "All Lanes Restored · Pedestrian Walkway Paving",
    advisoryColor: "emerald",
    capitalAllocation: "LKR 920,000,000",
    disbursedPct: 94,
    completionTarget: "18 May 2026",
    statusTag: "Final Surfacing",
  },
  {
    id: "cmc-2026-sw-02",
    code: "PRJ-CMC-2026-SW02",
    title: "Town Hall & Horton Place Stormwater Retention Micro-Tunnel",
    subtitle: "CH 00+300 to CH 01+750 · Automated Flood Sluice Integration",
    agencyCode: "CMC",
    agencyBadgeStyle: "bg-[#ffdbce] text-[#380d00]",
    district: "Colombo 07 (Cinnamon Gardens)",
    commuterAdvisory: "Eastbound Contraflow Active · Heavy Vehicle Advisory",
    advisoryColor: "orange",
    capitalAllocation: "LKR 780,000,000",
    disbursedPct: 68,
    completionTarget: "22 Sep 2026",
    statusTag: "On-Schedule",
  },
];

const PORTAL_COPY: Record<
  AuthLocale,
  {
    badge: string;
    title: string;
    subtitle: string;
    smsBtn: string;
    exportBtn: string;
    kpi1Title: string;
    kpi2Title: string;
    kpi3Title: string;
    kpi4Title: string;
    observatoryTitle: string;
    trackerTitle: string;
    reportTitle: string;
    submitReport: string;
  }
> = {
  en: {
    badge: "PUBLIC ACCOUNTABILITY LEDGER · OPEN ACCESS",
    title: "Citizen Infrastructure Transparency & Commuter Advisory Portal",
    subtitle:
      "Real-time visibility into national road works, multi-utility trenching schedules, public capital expenditure, and verified commuter disruption advisories across Sri Lanka.",
    smsBtn: "Corridor SMS Alerts",
    exportBtn: "Download Public Report",
    kpi1Title: "Active Public Works",
    kpi2Title: "Capital Invested (FY26)",
    kpi3Title: "Active Disruption Advisories",
    kpi4Title: "Commuter Transit Savings",
    observatoryTitle: "Public Infrastructure Observatory & Commuter Disruption Map",
    trackerTitle: "Corridor Accountability & Statutory Capital Tracker",
    reportTitle: "Citizen Oversight & Incident Report",
    submitReport: "Submit Verified Public Report",
  },
  si: {
    badge: "මහජන වගවීමේ ලෙජරය · විවෘත ප්‍රවේශය",
    title: "පුරවැසි යටිතල පහසුකම් විනිවිදභාවය සහ මගී උපදේශන ද්වාරය",
    subtitle:
      "ශ්‍රී ලංකාව පුරා ක්‍රියාත්මක වන ජාතික මාර්ග සංවර්ධන, උපයෝගිතා කැණීම් කාලසටහන්, මහජන ප්‍රාග්ධන වියදම් සහ රථවාහන උපදේශන පිළිබඳ සජීවී තොරතුරු.",
    smsBtn: "SMS උපදේශන සේවාව",
    exportBtn: "මහජන වාර්තාව බාගන්න",
    kpi1Title: "සක්‍රිය මහජන ව්‍යාපෘති",
    kpi2Title: "ආයෝජිත ප්‍රාග්ධනය (FY26)",
    kpi3Title: "සක්‍රිය මාර්ග බාධා නිවේදන",
    kpi4Title: "මගී කාල ඉතිරිය",
    observatoryTitle: "මහජන යටිතල පහසුකම් නිරීක්ෂණාගාරය සහ මගී සිතියම",
    trackerTitle: "කොරිඩෝවේ වගවීම සහ ව්‍යවස්ථාපිත ප්‍රාග්ධන ලුහුබැඳීම",
    reportTitle: "පුරවැසි නිරීක්ෂණ සහ සිදුවීම් වාර්තා කිරීම",
    submitReport: "තහවුරු කළ මහජන වාර්තාව යොමු කරන්න",
  },
  ta: {
    badge: "பொதுப் பொறுப்புக்கூறல் பதிவேடு · திறந்த அணுகல்",
    title: "குடிமக்கள் உள்கட்டமைப்பு வெளிப்படைத்தன்மை மற்றும் பயணிகள் ஆலோசனை தளம்",
    subtitle:
      "இலங்கை முழுவதும் நடைபெறும் தேசிய வீதிப் பணிகள், பயன்பாட்டு அகழ்வு அட்டவணைகள், பொது மூலதனச் செலவினங்கள் மற்றும் போக்குவரத்து ஆலோசனைகளின் நேரடித் தகவல்கள்.",
    smsBtn: "SMS எச்சரிக்கைகள்",
    exportBtn: "பொது அறிக்கையைப் பதிவிறக்குக",
    kpi1Title: "செயலில் உள்ள பொதுப் பணிகள்",
    kpi2Title: "முதலீடு செய்யப்பட்ட மூலதனம் (FY26)",
    kpi3Title: "போக்குவரத்து இடையூறு அறிவிப்புகள்",
    kpi4Title: "பயணிகள் நேர சேமிப்பு",
    observatoryTitle: "பொது உள்கட்டமைப்பு கண்காணிப்பகம் மற்றும் பயணிகள் வரைபடம்",
    trackerTitle: "வழித்தடப் பொறுப்புக்கூறல் மற்றும் மூலதனக் கண்காணிப்பு",
    reportTitle: "குடிமக்கள் கண்காணிப்பு மற்றும் நிகழ்வு அறிக்கை",
    submitReport: "சரிபார்க்கப்பட்ட பொது அறிக்கையைச் சமர்ப்பிக்கவும்",
  },
};

export function PublicPortalClient() {
  const [locale, setLocale] = useWorkspaceLocale();
  const copy = PORTAL_COPY[locale] ?? PORTAL_COPY.en;

  const [mapMode, setMapMode] = useState<"GIS_LIVE" | "DETOUR_TOPOLOGY">("GIS_LIVE");
  const [agencyFilter, setAgencyFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCorridorId, setSelectedCorridorId] = useState<string>(CORRIDOR_PROJECTS[0].id);

  // Citizen incident report form state
  const [incidentCorridor, setIncidentCorridor] = useState(
    "Baseline Road (A001) — Dematagoda Flyover",
  );
  const [hazardType, setHazardType] = useState<
    "OPEN_TRENCH" | "UNMARKED_DETOUR" | "WATER_BURST" | "DELAY_QUERY"
  >("OPEN_TRENCH");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  // SMS Modal state
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsPhone, setSmsPhone] = useState("");
  const [smsCorridor, setSmsCorridor] = useState("Baseline Road (A001)");
  const [smsConfirmed, setSmsConfirmed] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    return CORRIDOR_PROJECTS.filter((row) => {
      if (agencyFilter !== "ALL" && row.agencyCode !== agencyFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          row.title.toLowerCase().includes(q) ||
          row.code.toLowerCase().includes(q) ||
          row.district.toLowerCase().includes(q) ||
          row.agencyCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [agencyFilter, searchQuery]);

  const activeCorridor = useMemo(
    () =>
      CORRIDOR_PROJECTS.find((c) => c.id === selectedCorridorId) ?? CORRIDOR_PROJECTS[0],
    [selectedCorridorId],
  );

  const handleSubmitIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentDescription.trim()) return;
    const refId = `CIT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    setSubmittedRef(refId);
    setIncidentDescription("");
  };

  const handleExportPublicReport = () => {
    const reportPayload = {
      generatedAt: new Date().toISOString(),
      portal: "INFRAOS Citizen Infrastructure Transparency Portal (CORE-02.15)",
      summary: {
        activePublicWorks: 42,
        capitalInvestedLkr: "4.82B",
        activeDisruptionAdvisories: 7,
        commuterTransitSavingsPct: 38,
      },
      corridors: CORRIDOR_PROJECTS,
    };
    const blob = new Blob([JSON.stringify(reportPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `infraos-citizen-transparency-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubscribeSms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsPhone.trim()) return;
    setSmsConfirmed(
      `SMS commuter advisories activated for ${smsCorridor} on ${smsPhone}.`,
    );
    setSmsPhone("");
  };

  return (
    <div className="min-h-screen bg-[#f9f9ff] text-[#141b2b] flex flex-col">
      {/* Top Civic Transparency Header Bar */}
      <header className="sticky top-0 z-40 h-[70px] bg-white border-b border-[#c4c6cc]/40 px-4 sm:px-8 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#14202d] text-white flex items-center justify-center font-bold text-sm tracking-wider">
              IO
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-wider uppercase text-[#14202d] leading-none">
                INFRAOS
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#535f6f] mt-0.5">
                Public Transparency Portal
              </span>
            </div>
          </Link>
          <span className="hidden md:inline-block text-[#c4c6cc]">|</span>
          <div className="hidden md:flex items-center gap-1.5 text-xs text-[#44474c]">
            <span>Civic Command</span>
            <span className="text-[#74777c]">›</span>
            <span className="font-semibold text-[#141b2b]">National Infrastructure</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Trilingual Switcher */}
          <div
            className="flex items-center text-xs font-semibold text-[#44474c] border border-[#c4c6cc]/60 rounded px-1.5 py-1 bg-[#f1f3ff]"
            role="group"
            aria-label="Language switcher"
          >
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                locale === "en" ? "bg-[#14202d] text-white font-bold" : "hover:text-[#141b2b]"
              }`}
            >
              EN
            </button>
            <span className="text-[#c4c6cc]">|</span>
            <button
              type="button"
              onClick={() => setLocale("si")}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                locale === "si" ? "bg-[#14202d] text-white font-bold" : "hover:text-[#141b2b]"
              }`}
            >
              සිංහල
            </button>
            <span className="text-[#c4c6cc]">|</span>
            <button
              type="button"
              onClick={() => setLocale("ta")}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                locale === "ta" ? "bg-[#14202d] text-white font-bold" : "hover:text-[#141b2b]"
              }`}
            >
              தமிழ்
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-[#f1f3ff] rounded border border-[#c4c6cc]/40 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span className="font-semibold text-[11px] text-[#141b2b]">Telemetry: Synced</span>
          </div>

          <Link
            href="/dashboard"
            className="h-9 px-3.5 rounded-lg bg-[#14202d] text-white text-xs font-semibold hover:bg-[#293040] transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">shield_person</span>
            <span>Staff Workspace</span>
          </Link>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-6 flex flex-col gap-6">
        {/* Top Transparency Banner & Public Header */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-[#c4c6cc]/40">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#ffdbce] text-[#380d00] font-bold text-[11px] uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#a83900]" />
                {copy.badge}
              </span>
              <span className="text-xs text-[#44474c] font-mono">
                GAZETTE REF: LK-INFRA-2026-PUB · UPDATED 14 MINS AGO
              </span>
            </div>
            <h1 className="text-2xl sm:text-[32px] sm:leading-[40px] font-bold text-[#141b2b] tracking-tight">
              {copy.title}
            </h1>
            <p className="text-sm text-[#44474c] max-w-3xl">{copy.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setSmsConfirmed(null);
                setSmsModalOpen(true);
              }}
              className="h-10 px-3.5 bg-white border border-[#c4c6cc]/60 hover:bg-[#e9edff] text-[#141b2b] rounded-lg font-semibold text-xs flex items-center gap-2 transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px] text-[#a83900]">
                notifications_active
              </span>
              <span>{copy.smsBtn}</span>
            </button>
            <button
              type="button"
              onClick={handleExportPublicReport}
              className="h-10 px-4 bg-[#a83900] hover:bg-[#fd5a00] text-white rounded-lg font-semibold text-xs flex items-center gap-2 transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>{copy.exportBtn}</span>
            </button>
          </div>
        </section>

        {/* 4-Card Public KPI Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-[#c4c6cc]/40 shadow-2xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#44474c]">
                {copy.kpi1Title}
              </span>
              <span className="w-8 h-8 rounded-lg bg-[#f1f3ff] flex items-center justify-center text-[#141b2b]">
                <span className="material-symbols-outlined text-[18px]">construction</span>
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[32px] leading-[40px] font-bold text-[#141b2b] font-mono">
                  42
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  9 Districts
                </span>
              </div>
              <p className="text-xs text-[#44474c] mt-1">
                18 National Highways · 14 Water Mains · 10 Power Grid
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#c4c6cc]/40 shadow-2xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#44474c]">
                {copy.kpi2Title}
              </span>
              <span className="w-8 h-8 rounded-lg bg-[#f1f3ff] flex items-center justify-center text-[#a83900]">
                <span className="material-symbols-outlined text-[18px]">account_balance</span>
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[32px] leading-[40px] font-bold text-[#141b2b] font-mono">
                  LKR 4.82B
                </span>
                <span className="text-xs font-semibold text-[#141b2b] bg-[#e1e8fd] px-1.5 py-0.5 rounded">
                  68.4% Disbursed
                </span>
              </div>
              <p className="text-xs text-[#44474c] mt-1">
                Audited against Physical Milestone Completion Certificates
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#c4c6cc]/40 shadow-2xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#44474c]">
                {copy.kpi3Title}
              </span>
              <span className="w-8 h-8 rounded-lg bg-[#ffdad6]/50 flex items-center justify-center text-[#ba1a1a]">
                <span className="material-symbols-outlined text-[18px]">traffic</span>
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[32px] leading-[40px] font-bold text-[#ba1a1a] font-mono">
                  07
                </span>
                <span className="text-xs font-semibold text-[#93000a] bg-[#ffdad6] px-1.5 py-0.5 rounded">
                  2 Lane Closures
                </span>
              </div>
              <p className="text-xs text-[#44474c] mt-1">
                Verified police diversion routes active in Colombo &amp; Kandy
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#c4c6cc]/40 shadow-2xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#44474c]">
                {copy.kpi4Title}
              </span>
              <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                <span className="material-symbols-outlined text-[18px]">eco</span>
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[32px] leading-[40px] font-bold text-[#141b2b] font-mono">
                  -38%
                </span>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                  RoadSync Co-Trenching
                </span>
              </div>
              <p className="text-xs text-[#44474c] mt-1">
                14 repeat road excavations prevented via multi-agency bundling
              </p>
            </div>
          </div>
        </section>

        {/* Hero Row: Interactive Public GIS Corridor Observatory + Live Commuter Advisories */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 bg-[#14202d] text-[#d7e3f6] rounded-lg border border-[#c4c6cc]/20 shadow-md overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[#c4c6cc]/15 flex flex-wrap items-center justify-between gap-2 bg-[#14202d]">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#fd5a00] animate-pulse" />
                <h2 className="text-base font-semibold text-white">{copy.observatoryTitle}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#e1e8fd]/15 text-[11px] font-mono text-[#bbc8d9]">
                  GRID: WESTERN PROVINCE (WP-01)
                </span>
                <div className="flex items-center bg-[#000712]/40 rounded p-0.5 border border-[#c4c6cc]/20 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setMapMode("GIS_LIVE")}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      mapMode === "GIS_LIVE"
                        ? "bg-[#a83900] text-white"
                        : "text-[#bbc8d9] hover:text-white"
                    }`}
                  >
                    GIS LIVE
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapMode("DETOUR_TOPOLOGY")}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      mapMode === "DETOUR_TOPOLOGY"
                        ? "bg-[#a83900] text-white"
                        : "text-[#bbc8d9] hover:text-white"
                    }`}
                  >
                    DETOUR TOPOLOGY
                  </button>
                </div>
              </div>
            </div>

            {/* Vector GIS Canvas Simulation */}
            <div className="relative h-[340px] w-full bg-[#0d1620] overflow-hidden select-none">
              <div
                className="absolute inset-0 opacity-15"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #3c4856 1px, transparent 1px), linear-gradient(to bottom, #3c4856 1px, transparent 1px)",
                  backgroundSize: "36px 36px",
                }}
              />
              <svg
                className="absolute inset-0 w-full h-full"
                preserveAspectRatio="none"
                viewBox="0 0 800 340"
              >
                <path
                  d="M 0,0 L 140,0 L 165,120 L 150,240 L 180,340 L 0,340 Z"
                  fill="#081018"
                />
                <path
                  d="M 140,0 L 165,120 L 150,240 L 180,340"
                  fill="none"
                  stroke="#1e3a5f"
                  strokeWidth="3"
                />
                {/* Marine Drive Corridor */}
                <path
                  d="M 165,30 L 185,150 L 175,290"
                  fill="none"
                  stroke="#38bdf8"
                  strokeDasharray="6 4"
                  strokeWidth="4"
                />
                {/* Galle Road A002 */}
                <path
                  d="M 210,20 L 235,160 L 225,320"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4"
                />
                {/* Baseline Road A001 */}
                <path
                  d="M 420,15 L 410,145 L 435,260 L 450,330"
                  fill="none"
                  stroke="#fd5a00"
                  strokeWidth="6"
                />
                {/* High Level Road A004 */}
                <path
                  d="M 235,160 L 410,145 L 620,190 L 760,230"
                  fill="none"
                  stroke="#eab308"
                  strokeWidth="4"
                />
                {/* Detour Loop */}
                {mapMode === "DETOUR_TOPOLOGY" ? (
                  <path
                    d="M 410,100 C 510,110 520,210 435,230"
                    fill="none"
                    stroke="#22d3ee"
                    strokeDasharray="5 3"
                    strokeWidth="4"
                  />
                ) : (
                  <path
                    d="M 410,100 C 480,115 485,195 435,220"
                    fill="none"
                    stroke="#38bdf8"
                    strokeDasharray="4 4"
                    strokeWidth="2.5"
                  />
                )}
                <circle
                  cx="415"
                  cy="150"
                  fill="#fd5a00"
                  fillOpacity="0.25"
                  r="18"
                />
                <circle
                  cx="415"
                  cy="150"
                  fill="#fd5a00"
                  r="6"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <circle
                  cx="180"
                  cy="165"
                  fill="#ef4444"
                  fillOpacity="0.25"
                  r="14"
                />
                <circle
                  cx="180"
                  cy="165"
                  fill="#ef4444"
                  r="5"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <circle
                  cx="560"
                  cy="178"
                  fill="#10b981"
                  r="5"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              </svg>

              {/* Floating Callout 1: Baseline Road */}
              <button
                type="button"
                onClick={() => setSelectedCorridorId("rda-2026-bl-04")}
                className="text-left absolute top-6 left-[44%] bg-[#14202d]/95 backdrop-blur-md border border-[#fd5a00]/60 rounded-lg p-3 shadow-xl max-w-[270px] hover:border-white transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="px-1.5 py-0.5 rounded bg-[#a83900] text-white text-[10px] font-bold uppercase">
                    LANE CLOSURE · CH 04+200
                  </span>
                  <span className="text-[10px] font-mono text-[#bbc8d9]">RDA / NWSDB</span>
                </div>
                <p className="text-xs font-semibold text-white">
                  Baseline Rd Flyover Piling &amp; 600mm Main
                </p>
                <p className="text-[11px] text-[#bbc8d9] mt-0.5">
                  Detour via Dematagoda Canal Rd (+6 min transit). Reopens: 18 Nov 2026.
                </p>
              </button>

              {/* Floating Callout 2: Marine Drive */}
              <button
                type="button"
                onClick={() => setSelectedCorridorId("nwsdb-2026-md-11")}
                className="text-left absolute bottom-14 left-[18%] bg-[#14202d]/95 backdrop-blur-md border border-sky-400/50 rounded-lg p-2.5 shadow-xl max-w-[230px] hover:border-white transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold uppercase">
                    NIGHT WORKS ONLY
                  </span>
                  <span className="text-[10px] font-mono text-[#bbc8d9]">CEB / CMC</span>
                </div>
                <p className="text-xs font-semibold text-white">
                  Marine Drive Underground Ducting
                </p>
                <p className="text-[11px] text-[#bbc8d9]">
                  22:00 – 05:00 hrs · Daytime lanes clear
                </p>
              </button>

              {/* Map Legend Footer */}
              <div className="absolute bottom-3 right-3 left-3 flex flex-wrap items-center justify-between gap-2 bg-[#000712]/80 backdrop-blur-xs px-3 py-2 rounded border border-[#c4c6cc]/20 text-[11px]">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex items-center gap-1.5 text-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#fd5a00]" /> Active Trenching / Diversion
                  </span>
                  <span className="flex items-center gap-1.5 text-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Verified Detour Corridor
                  </span>
                  <span className="flex items-center gap-1.5 text-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Clear / Resurfaced
                  </span>
                </div>
                <span className="font-mono text-[#bbc8d9]">
                  FOCUS: {activeCorridor.code} · {activeCorridor.district}
                </span>
              </div>
            </div>
          </div>

          {/* Right 4 Columns: Active Commuter Disruption & Detour Bulletins */}
          <div className="xl:col-span-4 bg-white rounded-lg border border-[#c4c6cc]/40 shadow-2xs flex flex-col justify-between p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-[#c4c6cc]/30 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#a83900]">
                    LIVE COMMUTER BULLETINS
                  </span>
                  <h2 className="text-base font-semibold text-[#141b2b]">
                    Verified Traffic &amp; Utility Advisories
                  </h2>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#ffdad6] text-[#93000a] text-[11px] font-bold">
                  3 Priority
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#f1f3ff] border-l-4 border-[#a83900] flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#141b2b]">
                    ADV-WP-094 · BASELINE RD (A001)
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#ffdbce] text-[#380d00] text-[10px] font-bold uppercase">
                    Heavy Delay
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#141b2b]">
                  Dematagoda Flyover Pier P4 Concrete Pour &amp; NWSDB Valve Chamber
                </p>
                <p className="text-xs text-[#44474c]">
                  Northbound outer lane closed CH 04+150 to 04+600. Heavy vehicles diverted via Orugodawatta — Ambatale Low Level Rd.
                </p>
                <div className="flex items-center justify-between pt-1 text-[11px] text-[#44474c] font-mono">
                  <span>Agencies: RDA + NWSDB</span>
                  <span className="text-[#a83900] font-bold">Clearance: 18 Nov 2026</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#f1f3ff] border-l-4 border-[#ba1a1a] flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#141b2b]">
                    ADV-WP-102 · KOLLUPITIYA JUNCTION
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#ffdad6] text-[#93000a] text-[10px] font-bold uppercase">
                    Water Interruption
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#141b2b]">
                  Scheduled 8-Hour Low-Pressure Window for Cross-Connection
                </p>
                <p className="text-xs text-[#44474c]">
                  Saturday 22:00 to Sunday 06:00 across Ward 24 &amp; Bambalapitiya West due to 450mm ductile iron main commissioning.
                </p>
                <div className="flex items-center justify-between pt-1 text-[11px] text-[#44474c] font-mono">
                  <span>Lead: NWSDB Western Central</span>
                  <span>Bowser Hotline: 1939</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#f1f3ff] border-l-4 border-emerald-600 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#141b2b]">
                    ADV-CP-041 · KANDY PERADENIYA RD
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-bold uppercase">
                    Restored Early
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#141b2b]">
                  Asphalt Wearing Course Completed 4 Days Ahead of Schedule
                </p>
                <p className="text-xs text-[#44474c]">
                  All 4 lanes reopened to public transit following joint CEB 33kV underground cable burial and NBRO slope certification.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Row: Public Works Capital Ledger (8 Cols) + Citizen Feedback & Moratorium Registry (4 Cols) */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* 8 Columns: Public Works Capital & Milestone Accountability Ledger */}
          <div className="xl:col-span-8 bg-white rounded-lg border border-[#c4c6cc]/40 shadow-2xs p-4 sm:p-6 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#c4c6cc]/30 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#44474c]">
                  OPEN CONTRACT &amp; BUDGET LEDGER
                </span>
                <h2 className="text-lg font-semibold text-[#141b2b]">{copy.trackerTitle}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search corridor or district..."
                  aria-label="Search public corridors"
                  className="h-8 px-2.5 bg-[#f1f3ff] border border-[#c4c6cc]/50 rounded text-xs text-[#141b2b] placeholder:text-[#74777c]"
                />
                <select
                  aria-label="Filter by Lead Agency"
                  value={agencyFilter}
                  onChange={(e) => setAgencyFilter(e.target.value)}
                  className="h-8 px-2.5 bg-[#f1f3ff] border border-[#c4c6cc]/50 rounded text-xs text-[#141b2b] font-semibold"
                >
                  <option value="ALL">All Agencies (RDA, NWSDB, CEB, CMC)</option>
                  <option value="RDA">Road Development Authority (RDA)</option>
                  <option value="NWSDB">National Water Supply (NWSDB)</option>
                  <option value="CEB">Ceylon Electricity Board (CEB)</option>
                  <option value="CMC">Colombo Municipal Council (CMC)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#c4c6cc]/40 text-[11px] font-bold uppercase tracking-wider text-[#44474c] bg-[#f1f3ff]/60">
                    <th className="py-2.5 px-3">Corridor &amp; Project Scope</th>
                    <th className="py-2.5 px-3">Lead Agency</th>
                    <th className="py-2.5 px-3">Commuter Advisory</th>
                    <th className="py-2.5 px-3">Capital Allocation</th>
                    <th className="py-2.5 px-3">Completion Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c4c6cc]/25 text-sm">
                  {filteredProjects.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedCorridorId(row.id)}
                      className={`cursor-pointer transition-colors ${
                        selectedCorridorId === row.id
                          ? "bg-[#e9edff]/60"
                          : "hover:bg-[#f1f3ff]/50"
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#141b2b]">{row.title}</div>
                        <div className="text-xs text-[#44474c] font-mono">
                          {row.subtitle}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[11px] ${row.agencyBadgeStyle}`}
                        >
                          {row.agencyCode}
                        </span>
                        <div className="text-[11px] text-[#44474c] mt-0.5">{row.district}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            row.advisoryColor === "orange"
                              ? "text-[#a83900]"
                              : row.advisoryColor === "red"
                                ? "text-[#ba1a1a]"
                                : "text-emerald-700"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              row.advisoryColor === "orange"
                                ? "bg-[#a83900]"
                                : row.advisoryColor === "red"
                                  ? "bg-[#ba1a1a]"
                                  : "bg-emerald-600"
                            }`}
                          />
                          {row.commuterAdvisory}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <div className="font-semibold text-[#141b2b]">
                          {row.capitalAllocation}
                        </div>
                        <div className="w-28 h-1.5 bg-[#dce2f7] rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full ${
                              row.disbursedPct >= 90 ? "bg-emerald-600" : "bg-[#a83900]"
                            }`}
                            style={{ width: `${row.disbursedPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[#44474c]">
                          {row.disbursedPct}% Certified Physical
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs">
                        <div className="font-bold text-[#141b2b]">{row.completionTarget}</div>
                        <span className="text-[11px] text-emerald-700">{row.statusTag}</span>
                      </td>
                    </tr>
                  ))}
                  {filteredProjects.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-[#44474c]">
                        No public corridors match the selected filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4 Columns: Citizen Corridor Incident Report & Excavation Moratorium Shield */}
          <div className="xl:col-span-4 flex flex-col gap-4">
            <div className="bg-white rounded-lg border border-[#c4c6cc]/40 shadow-2xs p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-[#c4c6cc]/30 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#a83900] text-[20px]">
                    campaign
                  </span>
                  <h2 className="text-base font-semibold text-[#141b2b]">{copy.reportTitle}</h2>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#e9edff] text-[#44474c]">
                  SLA: 24h Triage
                </span>
              </div>
              <p className="text-xs text-[#44474c]">
                Report unbarricaded trenches, road surface settlement, or signage hazards directly to the Regional Inspector Queue.
              </p>

              {submittedRef && (
                <div
                  role="status"
                  className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex flex-col gap-1"
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>Public Oversight Dossier Logged: {submittedRef}</span>
                    <button
                      type="button"
                      onClick={() => setSubmittedRef(null)}
                      className="text-emerald-700 underline text-[11px]"
                    >
                      New Report
                    </button>
                  </div>
                  <p>
                    Routed to the Regional Field Inspector Queue for {incidentCorridor}.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmitIncident} className="flex flex-col gap-2.5">
                <div>
                  <label
                    htmlFor="citizen-corridor-select"
                    className="block text-[11px] font-bold text-[#141b2b] uppercase mb-1"
                  >
                    Affected Corridor / Location
                  </label>
                  <select
                    id="citizen-corridor-select"
                    value={incidentCorridor}
                    onChange={(e) => setIncidentCorridor(e.target.value)}
                    className="w-full h-9 px-2.5 bg-[#f1f3ff] border border-[#c4c6cc]/50 rounded text-xs text-[#141b2b]"
                  >
                    <option>Baseline Road (A001) — Dematagoda Flyover</option>
                    <option>Marine Drive — Kollupitiya Trenching Zone</option>
                    <option>High Level Road (A004) — Nugegoda Segment</option>
                    <option>Town Hall — Horton Place Stormwater Corridor</option>
                  </select>
                </div>

                <div>
                  <span className="block text-[11px] font-bold text-[#141b2b] uppercase mb-1">
                    Observation / Hazard Category
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <label className="flex items-center gap-1.5 p-2 rounded border border-[#c4c6cc]/50 bg-[#f1f3ff] cursor-pointer">
                      <input
                        type="radio"
                        name="hazard"
                        checked={hazardType === "OPEN_TRENCH"}
                        onChange={() => setHazardType("OPEN_TRENCH")}
                        className="accent-[#a83900]"
                      />
                      <span className="font-semibold text-xs">Open Trench Hazard</span>
                    </label>
                    <label className="flex items-center gap-1.5 p-2 rounded border border-[#c4c6cc]/50 bg-[#f1f3ff] cursor-pointer">
                      <input
                        type="radio"
                        name="hazard"
                        checked={hazardType === "UNMARKED_DETOUR"}
                        onChange={() => setHazardType("UNMARKED_DETOUR")}
                        className="accent-[#a83900]"
                      />
                      <span className="font-semibold text-xs">Unmarked Detour</span>
                    </label>
                    <label className="flex items-center gap-1.5 p-2 rounded border border-[#c4c6cc]/50 bg-[#f1f3ff] cursor-pointer">
                      <input
                        type="radio"
                        name="hazard"
                        checked={hazardType === "WATER_BURST"}
                        onChange={() => setHazardType("WATER_BURST")}
                        className="accent-[#a83900]"
                      />
                      <span className="font-semibold text-xs">Water / Utility Burst</span>
                    </label>
                    <label className="flex items-center gap-1.5 p-2 rounded border border-[#c4c6cc]/50 bg-[#f1f3ff] cursor-pointer">
                      <input
                        type="radio"
                        name="hazard"
                        checked={hazardType === "DELAY_QUERY"}
                        onChange={() => setHazardType("DELAY_QUERY")}
                        className="accent-[#a83900]"
                      />
                      <span className="font-semibold text-xs">Delay Inquiry</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="citizen-observation-input"
                    className="block text-[11px] font-bold text-[#141b2b] uppercase mb-1"
                  >
                    Observation Details
                  </label>
                  <textarea
                    id="citizen-observation-input"
                    rows={2}
                    value={incidentDescription}
                    onChange={(e) => setIncidentDescription(e.target.value)}
                    placeholder="Describe exact chainage landmark, missing steel plate, or traffic obstruction..."
                    className="w-full p-2.5 bg-[#f1f3ff] border border-[#c4c6cc]/50 rounded text-xs text-[#141b2b] placeholder:text-[#74777c]"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="citizen-contact-input"
                    className="block text-[11px] font-bold text-[#141b2b] uppercase mb-1"
                  >
                    SMS Notification Number (Optional)
                  </label>
                  <input
                    id="citizen-contact-input"
                    type="tel"
                    value={reporterContact}
                    onChange={(e) => setReporterContact(e.target.value)}
                    placeholder="+94 77 XXX XXXX"
                    className="w-full h-8 px-2.5 bg-[#f1f3ff] border border-[#c4c6cc]/50 rounded text-xs text-[#141b2b]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-9 bg-[#14202d] hover:bg-[#000712] text-white rounded font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  <span>{copy.submitReport}</span>
                </button>
              </form>
            </div>

            {/* RoadSync Dig-Once Moratorium Protection Card */}
            <div className="bg-[#14202d] text-[#d7e3f6] rounded-lg p-4 flex flex-col gap-2 border border-[#c4c6cc]/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#ffdbce]">
                  DIG-ONCE PAVEMENT MORATORIUM
                </span>
                <span className="material-symbols-outlined text-[18px] text-emerald-400">
                  verified_user
                </span>
              </div>
              <p className="text-sm font-semibold text-white">
                36-Month Newly Paved Road Protection Active
              </p>
              <p className="text-xs text-[#bbc8d9]">
                Newly resurfaced corridors (Galle Rd CH 00+000–05+200 &amp; Kandy Peradeniya Rd) are locked under statutory excavation moratorium until 2029.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* SMS Alert Subscription Modal */}
      {smsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#c4c6cc] max-w-md w-full p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#141b2b]">
                Subscribe to Corridor SMS Alerts
              </h3>
              <button
                type="button"
                onClick={() => setSmsModalOpen(false)}
                className="text-[#44474c] hover:text-[#141b2b]"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#44474c]">
              Receive instant trilingual SMS advisories when lane closures, night trenching, or water supply interruptions are scheduled on your commute corridor.
            </p>
            {smsConfirmed ? (
              <div className="p-3 rounded bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-medium">
                {smsConfirmed}
              </div>
            ) : (
              <form onSubmit={handleSubscribeSms} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-xs font-bold text-[#141b2b]">
                  Select Commute Corridor
                  <select
                    value={smsCorridor}
                    onChange={(e) => setSmsCorridor(e.target.value)}
                    className="h-9 px-2.5 rounded border border-[#c4c6cc] bg-[#f1f3ff] text-xs font-normal"
                  >
                    <option>Baseline Road (A001)</option>
                    <option>Marine Drive — Kollupitiya</option>
                    <option>High Level Road (A004)</option>
                    <option>Galle Road (A002)</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-[#141b2b]">
                  Mobile Number (+94)
                  <input
                    type="tel"
                    required
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                    placeholder="+94 77 123 4567"
                    className="h-9 px-2.5 rounded border border-[#c4c6cc] bg-[#f1f3ff] text-xs font-mono font-normal"
                  />
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSmsModalOpen(false)}
                    className="h-9 px-4 rounded bg-[#e9edff] text-[#141b2b] text-xs font-semibold"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="h-9 px-4 rounded bg-[#a83900] text-white text-xs font-semibold hover:bg-[#fd5a00]"
                  >
                    Activate SMS Alerts
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


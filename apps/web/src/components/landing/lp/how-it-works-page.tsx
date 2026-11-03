import {
  ArrowRightIcon,
  CheckCircle2Icon,
  FileCheckIcon,
  LockIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { getLpLinks } from "@/lib/landing/lp-data";
import type { PublicLocale } from "@/lib/landing/locales";
import { getPublicCopy } from "@/lib/landing/messages";
import { LpSubpageShell } from "./lp-subpage-shell";

interface HowItWorksPageProps {
  locale: PublicLocale;
}

interface StageSpec {
  num: string;
  id: string;
  shortTitle: string;
  badgeLabel: string;
  leadTime: string;
  leadTimeColor: string;
  impactBadge: string;
  title: string;
  description: string;
  actions: string[];
  outputs: Array<{ code: string; label: string; highlight?: boolean }>;
  plateImage?: {
    src: string;
    alt: string;
    plateCode: string;
    caption: string;
  };
}

const STAGES: StageSpec[] = [
  {
    num: "01",
    id: "step-01",
    shortTitle: "Plan",
    badgeLabel: "STAGE 01 · PLAN",
    leadTime: "Lead Time: -180 Days",
    leadTimeColor: "#FF5B00",
    impactBadge: "Impact: Eliminates Duplicate Budget Allocations",
    title: "Forward Capital Works Registration",
    description:
      "Every participating agency (RDA, NWSDB, CEB, SLT, and Municipal Councils) submits its multi-year capital works program into the unified GIS corridor registry at least six months prior to tender issuance.",
    actions: [
      "Upload corridor center-line GeoJSON and trench envelope polygons.",
      "Specify target depth profile, carriageway footprint, and fiscal quarter.",
      "Declare statutory priority tier (National Highway, Arterial, Urban Collector).",
    ],
    outputs: [
      { code: "GIS-REG-01", label: "Corridor Footprint Geometry" },
      { code: "CAP-BUD-02", label: "Provisional Capital Schedule" },
      { code: "PRI-CLS-03", label: "Statutory Corridor Classification" },
    ],
  },
  {
    num: "02",
    id: "step-02",
    shortTitle: "Coordinate",
    badgeLabel: "STAGE 02 · COORDINATE",
    leadTime: "Lead Time: -120 Days",
    leadTimeColor: "#FF5B00",
    impactBadge: "Impact: Detects 100% of Spatial & Temporal Clashes",
    title: "Automated RoadSync Spatial Clash Detection",
    description:
      "The RoadSync engine cross-references all submitted excavation envelopes across space and time. When two or more utilities target the same road segment within a 5-year window, the system issues a mandatory Co-Deployment Directive.",
    actions: [
      "Run 3D subterranean buffer intersection checks across all utility layers.",
      "Open a multi-agency Joint Trenching Docket and notify Chief Engineers.",
      "Sequence underground wet utilities (water/sewer) ahead of dry utilities and final asphalt surfacing.",
    ],
    outputs: [
      { code: "CLASH-RPT-04", label: "Automated Conflict Matrix", highlight: true },
      { code: "SYNC-DOC-05", label: "Joint Corridor Work Window" },
      { code: "SEQ-ORD-06", label: "Sub-Surface Execution Order" },
    ],
  },
  {
    num: "03",
    id: "step-03",
    shortTitle: "Approve",
    badgeLabel: "STAGE 03 · APPROVE",
    leadTime: "Lead Time: -45 Days",
    leadTimeColor: "#64748B",
    impactBadge: "Impact: Cuts Permit Lead Time by 64%",
    title: "Multi-Agency Digital Wayleave & Statutory Clearance",
    description:
      "Replaces paper circulars with a single cryptographic sign-off chain. Road authority engineers, utility directors, and traffic police review the synchronized engineering drawing package and attach binding SLA conditions.",
    actions: [
      "Verify compliance with SLS 1248 vertical and horizontal utility separation standards.",
      "Approve traffic diversion plans and night-work noise mitigation schedules.",
      "Issue unified Digital Excavation Permit with QR-verifiable site credentials.",
    ],
    outputs: [
      { code: "PRM-WAY-07", label: "Unified Digital Wayleave Permit", highlight: true },
      { code: "TRF-TMP-08", label: "Police Traffic Management Clearance" },
      { code: "SLA-BND-09", label: "Reinstatement Performance Bond" },
    ],
  },
  {
    num: "04",
    id: "step-04",
    shortTitle: "Build",
    badgeLabel: "STAGE 04 · BUILD",
    leadTime: "Lead Time: T-Zero (Execution)",
    leadTimeColor: "#111827",
    impactBadge: "Impact: Single Trench Opening Across All Agencies",
    title: "Synchronized Civil Execution & Trench Sharing",
    description:
      "Field contractors mobilize under a unified site command. Sub-base excavation, pipe laying, HV cable ducting, and optical conduit installation occur inside a single coordinated road closure window before RDA lays the final binder and wearing courses.",
    actions: [
      "Check in field crews via GPS-tagged site telemetry and QR permit boards.",
      "Enforce shoring, barricading, and pedestrian walk-way safety compliance.",
      "Log daily trench chainage progress and material batch deliveries in real time.",
    ],
    outputs: [
      { code: "FLD-LOG-10", label: "Daily Chainage & Crew Telemetry" },
      { code: "MAT-CRT-11", label: "Aggregate & Asphalt Batch Logs" },
      { code: "SAF-AUD-12", label: "Site Barricade Compliance Record" },
    ],
  },
  {
    num: "05",
    id: "step-05",
    shortTitle: "Verify",
    badgeLabel: "STAGE 05 · VERIFY",
    leadTime: "Lead Time: +48 Hours Post-Lay",
    leadTimeColor: "#64748B",
    impactBadge: "Impact: Prevents Sub-Standard Backfill & Subsidence",
    title: "Geodetic As-Built Survey & Compaction QA",
    description:
      "Before any trench is sealed or contractor payment milestone is released, independent QA engineers conduct total-station laser surveys and nuclear density compaction tests to certify that the reinstated road structure meets national highway specifications.",
    actions: [
      "Capture millimeter-accurate XYZ coordinates of laid pipes, ducts, and joints.",
      "Verify ≥ 98% Modified Proctor compaction density across ABC sub-base layers.",
      "Test asphalt core thickness, bitumen binder content, and riding surface regularity.",
    ],
    outputs: [
      { code: "QA-COMP-13", label: "Compaction & Core Test Certificate", highlight: true },
      { code: "GIS-ASB-14", label: "3D Geodetic As-Built Twin Layer" },
      { code: "PAY-REL-15", label: "Milestone Payment Authorization" },
    ],
    plateImage: {
      src: "/landing/lp/qa-inspection.jpg",
      alt: "Survey engineer operating a total-station laser theodolite on an active infrastructure corridor",
      plateCode: "PLATE 3.2 · GEODETIC VERIFICATION",
      caption:
        "Independent QA engineers record sub-centimeter XYZ coordinates and sub-base compaction metrics prior to final wearing course approval.",
    },
  },
  {
    num: "06",
    id: "step-06",
    shortTitle: "Monitor",
    badgeLabel: "STAGE 06 · MONITOR",
    leadTime: "Lead Time: Continuous",
    leadTimeColor: "#64748B",
    impactBadge: "Impact: Real-Time Citizen & Control Room Visibility",
    title: "Live Telemetry & Public Transparency Feed",
    description:
      "Throughout construction and post-reinstatement curing, the central GIS control room tracks corridor KPIs while the public civic portal publishes sanitized project schedules, contractor identities, and road reopening countdowns.",
    actions: [
      "Stream live corridor status updates to the National Dispatch Console.",
      "Ingest citizen geo-tagged hazard reports and route them to the responsible engineer.",
      "Track SLA adherence and trigger automated escalation notices on schedule drift.",
    ],
    outputs: [
      { code: "PUB-BRD-16", label: "Public Corridor Status Feed" },
      { code: "SLA-ALT-17", label: "Automated Delay Escalation Log" },
      { code: "CIT-TKT-18", label: "Citizen Feedback Resolution Audit" },
    ],
  },
  {
    num: "07",
    id: "step-07",
    shortTitle: "Complete",
    badgeLabel: "STAGE 07 · COMPLETE",
    leadTime: "Lead Time: +14 Days",
    leadTimeColor: "#64748B",
    impactBadge: "Impact: Full Statutory Handover & Audit Trail",
    title: "Joint Commissioning & Digital Asset Handover",
    description:
      "Upon passing all structural and geometric QA gates, the corridor is formally commissioned. The permanent subterranean digital twin is updated, and final financial reconciliation is closed across participating utility budgets.",
    actions: [
      "Execute multi-agency joint sign-off certificate (RDA, Utility, Local Authority).",
      "Commit immutable as-built subterranean asset layers to the National GIS Registry.",
      "Release initial contractor retention tranche and initiate Defects Liability Period.",
    ],
    outputs: [
      { code: "COM-CRT-19", label: "Joint Corridor Commissioning Deed", highlight: true },
      { code: "TWN-UPD-20", label: "Permanent National Underground Registry" },
      { code: "DLP-REG-21", label: "Defects Liability Tracking Docket" },
    ],
  },
  {
    num: "08",
    id: "step-08",
    shortTitle: "Maintain",
    badgeLabel: "STAGE 08 · MAINTAIN",
    leadTime: "Lead Time: 5-Year Lock",
    leadTimeColor: "#14532D",
    impactBadge: "Impact: Statutory 5-Year Moratorium Protection",
    title: "Statutory 5-Year Excavation Moratorium Lock",
    description:
      "Once freshly surfaced, the road segment enters an automated 60-month statutory moratorium in INFRAOS. Any new routine excavation permit request within the locked polygon is automatically rejected by the system unless declared a life-safety emergency by a Ministry Secretary.",
    actions: [
      "Activate cryptographic GIS polygon lock preventing routine utility cut permits.",
      "Schedule automated annual pavement condition index (PCI) and settlement audits.",
      "Enforce strict emergency-only override logging with mandatory full-width resurfacing bonds.",
    ],
    outputs: [
      { code: "MOR-LCK-22", label: "60-Month Statutory Corridor Lock", highlight: true },
      { code: "PCI-AUD-23", label: "Annual Pavement Integrity Schedule" },
      { code: "EMR-OVR-24", label: "Secretary-Level Emergency Audit Log" },
    ],
  },
];

export function HowItWorksPage({ locale }: HowItWorksPageProps) {
  const copy = getPublicCopy(locale);
  const links = getLpLinks(locale);
  const localizedStages = copy.lifecycle.stages;
  const pageInfo = copy.infoPages["how-it-works"];

  return (
    <LpSubpageShell locale={locale} infoSlug="how-it-works">
      {/* Top Hero */}
      <section className="lp-subhero" aria-labelledby="how-hero-heading">
        <div className="lp-container">
          <nav className="lp-breadcrumb" aria-label="Breadcrumb">
            <Link href={links.home} className="lp-focus" style={{ color: "var(--lp-text-muted)", textDecoration: "none" }}>
              {copy.nav.home}
            </Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: "var(--lp-orange)" }}>{copy.nav.howItWorks}</span>
          </nav>

          <div className="lp-split-7-5" style={{ alignItems: "end" }}>
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <span className="lp-chip lp-chip-orange">Statutory Coordination Standard</span>
                <span className="lp-mono" style={{ fontSize: "0.75rem", color: "var(--lp-text-muted)" }}>
                  DIRECTIVE REF: LK-NII-SOP-08
                </span>
              </div>
              <h1
                id="how-hero-heading"
                className="lp-serif"
                style={{
                  fontSize: "clamp(2.15rem, 3.8vw, 3.25rem)",
                  lineHeight: 1.12,
                  color: "var(--lp-text)",
                  margin: "0 0 1.25rem",
                }}
              >
                {locale === "en"
                  ? "The 8-Stage Infrastructure Coordination Framework"
                  : pageInfo.title}
              </h1>
              <p
                style={{
                  fontSize: "1.0625rem",
                  lineHeight: 1.65,
                  color: "var(--lp-text-secondary)",
                  margin: 0,
                  maxWidth: "44rem",
                }}
              >
                {locale === "en"
                  ? "How INFRAOS transforms uncoordinated utility trenching into a synchronized, single-pass engineering workflow—from 180-day forward capital registration through a legally enforced 5-year road excavation moratorium."
                  : pageInfo.intro}
              </p>
            </div>

            {/* Hero Metric Highlights */}
            <div className="lp-grid2">
              <div className="lp-kpi" style={{ borderTop: "3px solid var(--lp-orange)" }}>
                <span className="lp-kpi-label">ESTIMATED FISCAL IMPACT</span>
                <div className="lp-kpi-value">LKR 4.2B</div>
                <p className="lp-kpi-sub" style={{ margin: 0 }}>
                  Capital Saved YTD via Joint Trenching &amp; Single-Pass Surfacing (Conceptual Model)
                </p>
              </div>
              <div className="lp-kpi" style={{ borderTop: "3px solid var(--lp-green)" }}>
                <span className="lp-kpi-label">CORRIDOR PRESERVATION</span>
                <div className="lp-kpi-value" style={{ color: "var(--lp-green-text)" }}>
                  -78%
                </div>
                <p className="lp-kpi-sub" style={{ margin: 0 }}>
                  Reduction in Repeat Road Re-Excavation Rates Across Synchronized Corridors
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Quick Nav Bar */}
      <nav className="lp-quicknav" aria-label="8-Stage Lifecycle Quick Navigation">
        <div className="lp-container">
          <div className="lp-quicknav-inner">
            <span
              className="lp-mono"
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--lp-text-muted)",
                marginRight: "0.35rem",
              }}
            >
              Jump to Stage:
            </span>
            {STAGES.map((stage, idx) => {
              const locStage = localizedStages[idx];
              const label = locale === "en" ? stage.shortTitle : locStage?.title ?? stage.shortTitle;
              return (
                <a key={stage.id} href={`#${stage.id}`} className="lp-quicknav-link lp-focus">
                  <span style={{ color: "var(--lp-orange)", fontWeight: 700 }}>{stage.num}</span>{" "}
                  {label}
                </a>
              );
            })}
          </div>
        </div>
      </nav>

      {/* 2-Column Main Lifecycle Stream */}
      <section className="lp-subpage-section" aria-labelledby="lifecycle-stream-heading">
        <div className="lp-container">
          <div className="lp-split-3-9">
            {/* Left Sticky Spine */}
            <aside aria-label="National Standard Lifecycle Spine">
              <div
                className="lp-card"
                style={{
                  padding: "1.5rem",
                  position: "sticky",
                  top: "5.25rem",
                  borderTop: "3px solid var(--lp-text)",
                }}
              >
                <div className="lp-eyebrow" style={{ marginBottom: "0.4rem" }}>
                  National Standard
                </div>
                <h2
                  id="lifecycle-stream-heading"
                  className="lp-serif"
                  style={{ fontSize: "1.35rem", color: "var(--lp-text)", margin: "0 0 0.35rem" }}
                >
                  Lifecycle Spine
                </h2>
                <p
                  className="lp-mono"
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--lp-text-muted)",
                    margin: "0 0 1.25rem",
                    paddingBottom: "0.85rem",
                    borderBottom: "1px solid var(--lp-border)",
                  }}
                >
                  Sri Lanka Gazette No. 2381/42 (Conceptual Preview)
                </p>

                <ol
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.65rem",
                  }}
                >
                  {STAGES.map((stage, idx) => {
                    const locStage = localizedStages[idx];
                    const label = locale === "en" ? stage.shortTitle : locStage?.title ?? stage.shortTitle;
                    return (
                      <li key={stage.id}>
                        <a
                          href={`#${stage.id}`}
                          className="lp-focus"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.5rem",
                            padding: "0.5rem 0.65rem",
                            borderRadius: "0.375rem",
                            background: "var(--lp-surface-low)",
                            border: "1px solid var(--lp-border)",
                            textDecoration: "none",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.8125rem",
                              fontWeight: 700,
                              color: "var(--lp-text)",
                            }}
                          >
                            <span className="lp-mono" style={{ color: "var(--lp-orange)", marginRight: "0.35rem" }}>
                              {stage.num}.
                            </span>
                            {label}
                          </span>
                          <span
                            className="lp-mono"
                            style={{
                              fontSize: "0.6875rem",
                              color: stage.leadTimeColor,
                              fontWeight: 600,
                            }}
                          >
                            {stage.leadTime.replace("Lead Time: ", "")}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ol>

                <div
                  style={{
                    marginTop: "1.25rem",
                    padding: "0.85rem",
                    borderRadius: "0.375rem",
                    background: "rgba(255,91,0,0.06)",
                    border: "1px solid rgba(255,91,0,0.2)",
                  }}
                >
                  <div
                    className="lp-mono"
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      color: "var(--lp-orange-text)",
                      textTransform: "uppercase",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Mandatory Compliance Gate
                  </div>
                  <p style={{ fontSize: "0.75rem", lineHeight: 1.5, color: "var(--lp-text-secondary)", margin: 0 }}>
                    No stage can advance without cryptographic sign-off of all required outputs from the preceding gate.
                  </p>
                </div>
              </div>
            </aside>

            {/* Right Expanded Sequence Stream */}
            <div className="lp-stream">
              {STAGES.map((stage, idx) => {
                const locStage = localizedStages[idx];
                const displayTitle = locale === "en" ? stage.title : locStage?.title ?? stage.title;
                const displayDesc = locale === "en" ? stage.description : locStage?.body ?? stage.description;

                return (
                  <article key={stage.id} id={stage.id} className="lp-stream-item">
                    <span className="lp-stream-dot" aria-hidden="true">
                      {stage.num}
                    </span>

                    <div className="lp-card" style={{ padding: "1.75rem" }}>
                      {/* Stage Header Badges */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.75rem",
                          marginBottom: "1rem",
                        }}
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
                          <span className="lp-chip lp-chip-orange">{stage.badgeLabel}</span>
                          <span className="lp-chip lp-chip-neutral">{stage.leadTime}</span>
                        </div>
                        <span className="lp-chip lp-chip-green">{stage.impactBadge}</span>
                      </div>

                      <h3
                        className="lp-serif"
                        style={{
                          fontSize: "1.5rem",
                          lineHeight: 1.25,
                          color: "var(--lp-text)",
                          margin: "0 0 0.75rem",
                        }}
                      >
                        {displayTitle}
                      </h3>
                      <p
                        style={{
                          fontSize: "0.9375rem",
                          lineHeight: 1.65,
                          color: "var(--lp-text-secondary)",
                          margin: "0 0 1.5rem",
                        }}
                      >
                        {displayDesc}
                      </p>

                      {/* 2-Column Actions & Required Outputs */}
                      <div className="lp-grid2">
                        <div
                          style={{
                            padding: "1.15rem",
                            borderRadius: "0.375rem",
                            background: "var(--lp-surface-low)",
                            border: "1px solid var(--lp-border)",
                          }}
                        >
                          <div
                            className="lp-mono"
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              color: "var(--lp-text)",
                              marginBottom: "0.75rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.4rem",
                            }}
                          >
                            <CheckCircle2Icon className="h-4 w-4 text-[#FF5B00]" aria-hidden="true" />
                            Key Agency Actions
                          </div>
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: "1.1rem",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.45rem",
                              fontSize: "0.84375rem",
                              lineHeight: 1.55,
                              color: "var(--lp-text-secondary)",
                            }}
                          >
                            {stage.actions.map((action) => (
                              <li key={action}>{action}</li>
                            ))}
                          </ul>
                        </div>

                        <div
                          style={{
                            padding: "1.15rem",
                            borderRadius: "0.375rem",
                            background: "#FFFFFF",
                            border: "1px solid var(--lp-border)",
                          }}
                        >
                          <div
                            className="lp-mono"
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              color: "var(--lp-text)",
                              marginBottom: "0.75rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.4rem",
                            }}
                          >
                            <FileCheckIcon className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
                            Required Statutory Outputs
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {stage.outputs.map((out) => (
                              <div
                                key={out.code}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "0.5rem",
                                  padding: "0.45rem 0.65rem",
                                  borderRadius: "0.25rem",
                                  background: out.highlight ? "rgba(255,91,0,0.06)" : "var(--lp-surface-low)",
                                  border: out.highlight
                                    ? "1px solid rgba(255,91,0,0.25)"
                                    : "1px solid var(--lp-border)",
                                }}
                              >
                                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--lp-text)" }}>
                                  {out.label}
                                </span>
                                <span
                                  className="lp-mono"
                                  style={{
                                    fontSize: "0.6875rem",
                                    fontWeight: 700,
                                    color: out.highlight ? "var(--lp-orange-text)" : "var(--lp-text-muted)",
                                  }}
                                >
                                  {out.code}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Optional Plate Image (Stage 05 Verify) */}
                      {stage.plateImage && (
                        <figure
                          style={{
                            margin: "1.5rem 0 0",
                            borderRadius: "0.5rem",
                            overflow: "hidden",
                            border: "1px solid var(--lp-border)",
                            background: "#0F172A",
                          }}
                        >
                          <div style={{ position: "relative", height: "16rem", width: "100%" }}>
                            <Image
                              src={stage.plateImage.src}
                              alt={stage.plateImage.alt}
                              fill
                              sizes="(max-width: 1024px) 100vw, 800px"
                              style={{ objectFit: "cover" }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                top: "0.75rem",
                                left: "0.75rem",
                                padding: "0.25rem 0.6rem",
                                borderRadius: "0.25rem",
                                background: "rgba(15,23,42,0.88)",
                                color: "#FFFFFF",
                                fontSize: "0.6875rem",
                              }}
                              className="lp-mono"
                            >
                              {stage.plateImage.plateCode}
                            </div>
                          </div>
                          <figcaption
                            style={{
                              padding: "0.75rem 1rem",
                              fontSize: "0.8125rem",
                              color: "#E2E8F0",
                              background: "#0F172A",
                            }}
                          >
                            {stage.plateImage.caption}
                          </figcaption>
                        </figure>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Deep-Dive Section: Resolving the Three-Agency Trilemma */}
      <section
        className="lp-subpage-section"
        style={{ background: "var(--lp-surface-low)" }}
        aria-labelledby="trilemma-heading"
      >
        <div className="lp-container">
          <div className="lp-split-7-5" style={{ alignItems: "center", marginBottom: "2.25rem" }}>
            <div>
              <div className="lp-eyebrow" style={{ marginBottom: "0.5rem" }}>
                Case Study &amp; Sequence Analysis
              </div>
              <h2
                id="trilemma-heading"
                className="lp-serif"
                style={{ fontSize: "clamp(1.75rem, 3vw, 2.35rem)", color: "var(--lp-text)", margin: "0 0 0.75rem" }}
              >
                Deep-Dive: Resolving the Three-Agency Trilemma
              </h2>
              <p style={{ fontSize: "1rem", lineHeight: 1.65, color: "var(--lp-text-secondary)", margin: 0 }}>
                Historically, arterial roads in the Western Province suffered repeated destructive cuts because water
                mains (NWSDB), underground HV power feeders (CEB), and highway resurfacing (RDA) operated on isolated
                fiscal calendars. RoadSync enforces a single synchronized engineering sequence.
              </p>
            </div>

            <figure
              className="lp-card"
              style={{ margin: 0, overflow: "hidden", border: "1px solid var(--lp-border)" }}
            >
              <div style={{ position: "relative", height: "13.5rem", width: "100%" }}>
                <Image
                  src="/landing/lp/asphalt-paving.jpg"
                  alt="Asphalt paving crew laying final wearing course after utility trench completion"
                  fill
                  sizes="(max-width: 1024px) 100vw, 520px"
                  style={{ objectFit: "cover" }}
                />
                <span
                  className="lp-mono"
                  style={{
                    position: "absolute",
                    top: "0.75rem",
                    left: "0.75rem",
                    background: "rgba(15,23,42,0.88)",
                    color: "#FFFFFF",
                    padding: "0.25rem 0.6rem",
                    borderRadius: "0.25rem",
                    fontSize: "0.6875rem",
                  }}
                >
                  PLATE 3.1 · SINGLE-PASS SURFACING
                </span>
              </div>
              <figcaption style={{ padding: "0.75rem 1rem", fontSize: "0.78125rem", color: "var(--lp-text-secondary)" }}>
                Final RDA asphalt wearing course is only authorized after NWSDB, CEB, and SLT subterranean layers pass
                Stage 05 geodetic verification.
              </figcaption>
            </figure>
          </div>

          {/* 2-Column Baseline vs Synchronized Comparison */}
          <div className="lp-grid2" style={{ marginBottom: "2.25rem" }}>
            <div className="lp-card" style={{ padding: "1.75rem", borderTop: "4px solid var(--lp-maroon)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span className="lp-chip lp-chip-maroon">Conventional Baseline</span>
                <span className="lp-mono" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--lp-maroon)" }}>
                  3 ROAD CUTS / 14 MONTHS
                </span>
              </div>
              <h3 className="lp-serif" style={{ fontSize: "1.35rem", color: "var(--lp-text)", margin: "0 0 0.75rem" }}>
                The Uncoordinated Cycle (14-Month Chaos)
              </h3>
              <ol
                style={{
                  margin: "0 0 1.25rem",
                  paddingLeft: "1.15rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.55rem",
                  fontSize: "0.875rem",
                  color: "var(--lp-text-secondary)",
                }}
              >
                <li>
                  <strong>Month 01 (RDA):</strong> Lays new 50mm asphalt carpet on arterial corridor (LKR 180M).
                </li>
                <li>
                  <strong>Month 05 (NWSDB):</strong> Cuts fresh asphalt to lay 300mm DI water main; cold-patch backfill
                  settles unevenly.
                </li>
                <li>
                  <strong>Month 11 (CEB / SLT):</strong> Re-excavates shoulder and lane for 11kV feeder &amp; fiber
                  ducts; structural integrity permanently compromised.
                </li>
              </ol>
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.375rem",
                  background: "var(--lp-maroon-bg)",
                  color: "var(--lp-maroon)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                }}
              >
                Result: 42% pavement lifespan loss + LKR 68M wasted reinstatement expenditure.
              </div>
            </div>

            <div className="lp-card" style={{ padding: "1.75rem", borderTop: "4px solid var(--lp-green)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span className="lp-chip lp-chip-green">INFRAOS Orchestrated</span>
                <span className="lp-mono" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--lp-green-text)" }}>
                  1 SHARED WINDOW / 5-YR LOCK
                </span>
              </div>
              <h3 className="lp-serif" style={{ fontSize: "1.35rem", color: "var(--lp-text)", margin: "0 0 0.75rem" }}>
                The Synchronized Sequence (Single Pass)
              </h3>
              <ol
                style={{
                  margin: "0 0 1.25rem",
                  paddingLeft: "1.15rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.55rem",
                  fontSize: "0.875rem",
                  color: "var(--lp-text-secondary)",
                }}
              >
                <li>
                  <strong>Days 01–18 (NWSDB + CEB + SLT):</strong> Tiered subterranean installation in a single shared
                  corridor closure window.
                </li>
                <li>
                  <strong>Days 19–21 (Joint QA):</strong> Geodetic 3D laser survey &amp; 98% Proctor compaction
                  verification across full trench width.
                </li>
                <li>
                  <strong>Days 22–28 (RDA):</strong> Continuous full-width polymer-modified asphalt wearing course +
                  immediate 5-year moratorium lock.
                </li>
              </ol>
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.375rem",
                  background: "var(--lp-green-bg)",
                  color: "var(--lp-green-text)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                }}
              >
                Result: 100% design pavement life preserved + zero repeat excavation for 60 months.
              </div>
            </div>
          </div>

          {/* SLS 1248 Subterranean Cross-Section Schematic */}
          <div className="lp-card" style={{ padding: "1.75rem" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <div className="lp-eyebrow">Engineering Cross-Section Schematic</div>
                <h3 className="lp-serif" style={{ fontSize: "1.35rem", color: "var(--lp-text)", margin: "0.2rem 0 0" }}>
                  Unified Utility Separation Standard (SLS 1248 Conceptual Profile)
                </h3>
              </div>
              <span className="lp-chip lp-chip-neutral">DEPTH PROFILE: 0.00m TO -1.60m</span>
            </div>

            <div style={{ width: "100%", overflowX: "auto" }}>
              <svg
                viewBox="0 0 900 260"
                role="img"
                aria-label="Cross-section diagram showing RDA Asphalt Wearing Course at surface, Crushed Aggregate Base, SLT Optical Duct at -0.60m, CEB 11kV Heavy Feed Line at -0.65m, and NWSDB 300mm Potable Main at -1.40m"
                style={{ width: "100%", height: "auto", minWidth: "640px", display: "block", borderRadius: "0.375rem" }}
              >
                {/* Sky / Surface Header */}
                <rect x="0" y="0" width="900" height="36" fill="#0F172A" />
                <text x="20" y="23" fill="#F8FAFC" fontSize="11" fontFamily="monospace" fontWeight="bold">
                  0.00m DATUM · RDA ARTERIAL CARRIAGEWAY SURFACE (50mm ASPHALT WEARING + 75mm BINDER COURSE)
                </text>

                {/* Sub-base ABC layer */}
                <rect x="0" y="36" width="900" height="44" fill="#334155" />
                <text x="20" y="62" fill="#CBD5E1" fontSize="11" fontFamily="monospace">
                  -0.12m TO -0.45m · COMPACTED CRUSHED AGGREGATE BASE COURSE (ABC ≥ 98% PROCTOR DENSITY)
                </text>

                {/* Subterranean Utility Zone */}
                <rect x="0" y="80" width="900" height="180" fill="#F1F5F9" />
                <line x1="0" y1="130" x2="900" y2="130" stroke="#CBD5E1" strokeDasharray="4 4" />
                <line x1="0" y1="205" x2="900" y2="205" stroke="#CBD5E1" strokeDasharray="4 4" />

                {/* Left Telecom Zone */}
                <rect x="45" y="102" width="220" height="48" rx="6" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
                <circle cx="72" cy="126" r="12" fill="#DBEAFE" stroke="#2563EB" strokeWidth="2" />
                <text x="94" y="122" fill="#1E293B" fontSize="11" fontFamily="monospace" fontWeight="bold">
                  SLT 12-WAY OPTICAL DUCT
                </text>
                <text x="94" y="138" fill="#475569" fontSize="10" fontFamily="monospace">
                  Depth: -0.60m · HDPE Conduit
                </text>

                {/* Center HV Power Zone */}
                <rect x="340" y="108" width="240" height="52" rx="6" fill="#FFFFFF" stroke="#FF5B00" strokeWidth="2" />
                <circle cx="368" cy="134" r="12" fill="#FFEDD5" stroke="#FF5B00" strokeWidth="2" />
                <text x="390" y="130" fill="#1E293B" fontSize="11" fontFamily="monospace" fontWeight="bold">
                  CEB 11kV / 33kV FEED LINE
                </text>
                <text x="390" y="146" fill="#475569" fontSize="10" fontFamily="monospace">
                  Depth: -0.65m · Concrete Tile Slab
                </text>

                {/* Deep Water Main Zone */}
                <rect x="620" y="176" width="245" height="58" rx="6" fill="#FFFFFF" stroke="#14532D" strokeWidth="2" />
                <circle cx="650" cy="205" r="15" fill="#DCFCE7" stroke="#14532D" strokeWidth="2" />
                <text x="675" y="200" fill="#1E293B" fontSize="11" fontFamily="monospace" fontWeight="bold">
                  NWSDB 300mm DI POTABLE MAIN
                </text>
                <text x="675" y="216" fill="#475569" fontSize="10" fontFamily="monospace">
                  Depth: -1.40m · Granular Bedding
                </text>

                {/* Horizontal Clearance Callout */}
                <line x1="265" y1="130" x2="340" y2="130" stroke="#8C1F28" strokeWidth="2" />
                <text x="272" y="122" fill="#8C1F28" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  ≥ 450mm
                </text>

                {/* Acoustic/IoT Marker */}
                <rect x="45" y="185" width="260" height="42" rx="4" fill="#0F172A" />
                <text x="60" y="204" fill="#FF5B00" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  RFID MARKER TAPE &amp; GEODETIC BEACON
                </text>
                <text x="60" y="218" fill="#E2E8F0" fontSize="10" fontFamily="monospace">
                  XYZ Accuracy: ±10mm (Stage 05 Verified)
                </text>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="lp-subpage-section" aria-labelledby="how-cta-heading">
        <div className="lp-container">
          <div
            className="lp-card"
            style={{
              padding: "2.25rem",
              background: "#0F172A",
              color: "#FFFFFF",
              border: "1px solid #1E293B",
            }}
          >
            <div className="lp-split-7-5" style={{ alignItems: "center" }}>
              <div>
                <div className="lp-eyebrow" style={{ color: "#FF8A4C", marginBottom: "0.4rem" }}>
                  Ready for Deployment
                </div>
                <h2
                  id="how-cta-heading"
                  className="lp-serif"
                  style={{ fontSize: "clamp(1.6rem, 2.6vw, 2.15rem)", color: "#FFFFFF", margin: "0 0 0.6rem" }}
                >
                  Are you an Authorized Municipal or Agency Engineer?
                </h2>
                <p style={{ fontSize: "0.9375rem", lineHeight: 1.6, color: "#CBD5E1", margin: 0 }}>
                  Access the RoadSync Corridor Registry to submit forward capital programs, inspect active 5-year
                  moratorium polygons, or lodge an inter-agency joint trenching docket.
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.85rem", justifyContent: "flex-start" }}>
                <Link href={links.signIn} className="lp-btn lp-btn-primary lp-focus">
                  <LockIcon className="h-4 w-4" aria-hidden="true" />
                  <span>Access Planning Portal</span>
                </Link>
                <Link
                  href={links.contact}
                  className="lp-btn lp-btn-secondary lp-focus"
                  style={{ background: "#1E293B", color: "#FFFFFF", borderColor: "#334155" }}
                >
                  <span>{copy.nav.contact}</span>
                  <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </LpSubpageShell>
  );
}

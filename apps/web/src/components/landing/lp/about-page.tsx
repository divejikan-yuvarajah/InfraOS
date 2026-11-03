import {
  ActivityIcon,
  ArrowRightIcon,
  BanknoteIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  Code2Icon,
  CompassIcon,
  DatabaseIcon,
  FileCheckIcon,
  FolderGit2Icon,
  GitBranchIcon,
  GraduationCapIcon,
  HardHatIcon,
  LandmarkIcon,
  MapIcon,
  ScaleIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { getLpCopy } from "@/lib/landing/lp-copy";
import { getLpLinks } from "@/lib/landing/lp-data";
import type { PublicLocale } from "@/lib/landing/locales";
import { getPublicCopy } from "@/lib/landing/messages";

import { FigureCaption, SectionHeader } from "./atoms";
import { LpSubpageShell } from "./lp-subpage-shell";

const PILLAR_ICONS = [FolderGit2Icon, GitBranchIcon, MapIcon, BrainCircuitIcon, FileCheckIcon] as const;
const PILLAR_META = [
  { tag: "Capital Work Registry", foot: "Input: Multi-year CIP Budgets" },
  { tag: "Corridor Co-location", foot: "Output: Synchronized Civil Timelines" },
  { tag: "Subsurface Registry", foot: "Format: GeoJSON / OGC SLD" },
  { tag: "Spatial Conflict Detection", foot: "Logic: Proximity & Depth Buffers" },
  { tag: "Permit & Clearance Ledger", foot: "Security: Immutable Multi-sig Ledger" },
] as const;

export function AboutPage({ locale }: { locale: PublicLocale }) {
  const lp = getLpCopy(locale);
  const pub = getPublicCopy(locale);
  const page = pub.infoPages.about;
  const links = getLpLinks(locale);

  return (
    <LpSubpageShell locale={locale} infoSlug="about">
      {/* SECTION 1: Page Header & Mission */}
      <section className="lp-subhero" aria-labelledby="lp-about-title">
        <div className="lp-container">
          <nav aria-label="Breadcrumb" className="lp-breadcrumb">
            <Link href={links.home}>{lp.nav.home}</Link>
            <span aria-hidden="true">/</span>
            <span className="lp-breadcrumb__cur">{page.title}</span>
          </nav>
          <div style={{ maxWidth: "56rem" }}>
            <div className="lp-hero__badge">
              <span className="lp-dot" style={{ background: "var(--lp-orange)" }} aria-hidden="true" />
              Statutory Framework Overview
            </div>
            <h1 id="lp-about-title" className="lp-display lp-h1">
              {locale === "en" ? "About the Platform" : page.title}
            </h1>
            <p className="lp-lede" style={{ fontSize: "20px", lineHeight: "30px", marginTop: "0.75rem" }}>
              {locale === "en"
                ? "INFRAOS was conceived to solve the chronic challenge of uncoordinated public infrastructure excavation across Sri Lanka through authoritative spatial intelligence and inter-agency workflows."
                : page.intro}
            </p>
          </div>
          <div className="lp-grid4" style={{ marginTop: "2rem" }}>
            <div className="lp-kpi">
              <div className="lp-kpi__label">Participating Statutory Agencies</div>
              <div className="lp-kpi__val">7 Authorities</div>
              <div className="lp-kpi__sub lp-kpi__sub--ok">Unified Spatial Layer</div>
            </div>
            <div className="lp-kpi">
              <div className="lp-kpi__label">Annual Preventable Loss</div>
              <div className="lp-kpi__val lp-kpi__val--primary">LKR 4.2B+</div>
              <div className="lp-kpi__sub">Repaving &amp; Trench Redundancy</div>
            </div>
            <div className="lp-kpi">
              <div className="lp-kpi__label">Underground Asset Conflicts</div>
              <div className="lp-kpi__val">82% Mitigated</div>
              <div className="lp-kpi__sub">Via Pre-Excavation Routing</div>
            </div>
            <div className="lp-kpi">
              <div className="lp-kpi__label">Statutory Clearance Window</div>
              <div className="lp-kpi__val">14 Days</div>
              <div className="lp-kpi__sub lp-kpi__sub--ok">Down from 90+ Working Days</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: The Coordination Challenge */}
      <section className="lp-section lp-section--canvas" aria-labelledby="lp-about-challenge">
        <div className="lp-container">
          <div className="lp-split-5-7">
            <div>
              <span className="lp-eyebrow">The Public Challenge</span>
              <h2 id="lp-about-challenge" className="lp-display lp-h2">
                {locale === "en" ? "The Reality of Fragmented Excavation" : (page.sections[0]?.heading ?? page.title)}
              </h2>
              <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem", color: "var(--lp-text-2)" }}>
                <p>
                  {locale === "en"
                    ? "In municipalities across Sri Lanka, a persistent cycle recurs: the Road Development Authority (RDA) or a Provincial Council commissions extensive capital to resurface an urban corridor, only for the National Water Supply and Drainage Board (NWSDB), Ceylon Electricity Board (CEB), or licensed telecommunication utilities to cut open the new asphalt within weeks."
                    : page.sections[0]?.body}
                </p>
                <p>
                  {locale === "en"
                    ? "This does not stem from negligence, but from statutory opacity. Utility entities operate on separate capital expenditure cycles, distinct geographic data systems, and independent tender schedules. Without a binding spatial coordination register, one department's completion is inevitably another department's excavation site."
                    : page.sections[1]?.body}
                </p>
                <p>
                  {locale === "en"
                    ? "The structural fallout is immediate: compressed tarmac integrity decays, premature structural failures occur, public transport experiences compounding gridlock, and underground fiber-optic and pressurized main lines endure catastrophic accidental strikes."
                    : page.sections[2]?.body}
                </p>
              </div>
              <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div className="lp-card" style={{ padding: "1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <BanknoteIcon aria-hidden="true" width={20} height={20} style={{ color: "var(--lp-primary)", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--lp-text)" }}>Capital Inefficiency &amp; Sunk Rupee Costs</h3>
                    <p style={{ fontSize: 13, lineHeight: "19px", color: "var(--lp-text-2)", marginTop: 2 }}>
                      Municipalities spend over 28% of maintenance reserves patching trenches that could have shared joint civil trenching contracts.
                    </p>
                  </div>
                </div>
                <div className="lp-card" style={{ padding: "1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <TriangleAlertIcon aria-hidden="true" width={20} height={20} style={{ color: "var(--lp-critical)", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--lp-text)" }}>Accidental Subsurface Strikes</h3>
                    <p style={{ fontSize: 13, lineHeight: "19px", color: "var(--lp-text-2)", marginTop: 2 }}>
                      Unmapped trenching causes electrical cutoffs, localized water supply contamination, and telecommunications blackout incidents.
                    </p>
                  </div>
                </div>
                <div className="lp-card" style={{ padding: "1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <TruckIcon aria-hidden="true" width={20} height={20} style={{ color: "var(--lp-secondary)", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--lp-text)" }}>Citizen Gridlock &amp; Environmental Strain</h3>
                    <p style={{ fontSize: 13, lineHeight: "19px", color: "var(--lp-text-2)", marginTop: 2 }}>
                      Continuous lane reductions on arterial highways throttle commercial transit and amplify urban vehicle emissions.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <FigureCaption
                src="/landing/lp/trench-excavation.jpg"
                alt={lp.problem.imageAlt}
                sizes="(min-width: 1024px) 640px, 100vw"
                label="Plate 1.2 — Active Utility Trenching Incident"
                caption="Plate 1.2 — Uncoordinated utility trenching along suburban transit corridor (NWSDB / CEB right-of-way conflict)"
                chip={lp.problem.plateChip}
                dot="var(--lp-attention)"
              />
              <div className="lp-card" style={{ padding: "1.5rem" }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    paddingBottom: "0.75rem",
                    borderBottom: "1px solid var(--lp-border)",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <ActivityIcon aria-hidden="true" width={18} height={18} style={{ color: "var(--lp-primary)" }} />
                      <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Subsurface Fatigue Index
                      </h3>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--lp-muted)", marginTop: 2 }}>
                      Post-trenching asphalt lifespan degradation measured across test sectors
                    </p>
                  </div>
                  <span className="lp-pill lp-pill--outline">SLSI 814 Validated</span>
                </div>
                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <strong style={{ color: "var(--lp-text)" }}>Coordinated Trenching (INFRAOS Joint Duct)</strong>
                      <strong style={{ color: "var(--lp-success-text)" }}>12–15 Years Structural Life</strong>
                    </div>
                    <div className="lp-cadence__bar" style={{ height: 10 }}>
                      <div className="lp-cadence__fill lp-cadence__fill--success" style={{ width: "92%" }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <strong style={{ color: "var(--lp-text)" }}>Standard Independent Single-Agency Excavation</strong>
                      <strong style={{ color: "var(--lp-primary)" }}>6–8 Years Structural Life</strong>
                    </div>
                    <div className="lp-cadence__bar" style={{ height: 10 }}>
                      <div className="lp-cadence__fill lp-cadence__fill--attention" style={{ width: "54%" }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <strong style={{ color: "var(--lp-text)" }}>Secondary Uncoordinated Resurfacing Trench</strong>
                      <strong style={{ color: "var(--lp-critical)" }}>1.5–3 Years (Rapid Rutting)</strong>
                    </div>
                    <div className="lp-cadence__bar" style={{ height: 10 }}>
                      <div style={{ height: "100%", width: "22%", background: "var(--lp-critical)", borderRadius: 9999 }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: System Architecture & Module Interconnection */}
      <section className="lp-section lp-section--card" aria-labelledby="lp-about-pillars">
        <div className="lp-container">
          <SectionHeader
            eyebrow={lp.capabilities.eyebrow}
            title="The Five Pillars of Inter-Agency Coordination"
            lede="INFRAOS bridges bureaucratic boundaries through an interconnected suite of spatial tools. Every phase links into an unalterable spatial and compliance record shared by all participating statutory bodies."
            id="lp-about-pillars"
            wide
          />
          <ul className="lp-grid5" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {lp.capabilities.cards.map((card, index) => {
              const Icon = PILLAR_ICONS[index];
              const meta = PILLAR_META[index];
              const isLast = index === 4;
              return (
                <li key={card.name} style={{ display: "flex" }}>
                  <div className="lp-tile" style={{ width: "100%", background: "var(--lp-canvas)" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                        <span
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 4,
                            background: isLast ? "var(--lp-success-text)" : "var(--lp-orange-btn)",
                            color: "#fff",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="lp-tile__icon" style={{ marginBottom: 0 }}>
                          <Icon aria-hidden="true" />
                        </div>
                      </div>
                      <h3 className="lp-display lp-h3">{card.name}</h3>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isLast ? "var(--lp-success-text)" : "var(--lp-primary)" }}>
                        {meta.tag}
                      </div>
                      <p className="lp-tile__text" style={{ marginTop: "0.5rem" }}>
                        {card.text}
                      </p>
                    </div>
                    <div
                      style={{
                        paddingTop: "0.625rem",
                        borderTop: "1px solid var(--lp-border)",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--lp-muted)",
                      }}
                    >
                      {meta.foot}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem 1.25rem",
              background: "var(--lp-low)",
              border: "1px solid var(--lp-border)",
              borderRadius: 4,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div className="lp-tile__icon" style={{ marginBottom: 0, background: "var(--lp-card)" }}>
                <DatabaseIcon aria-hidden="true" />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--lp-text)" }}>
                  Unified National Spatial Data Infrastructure (NSDI)
                </h3>
                <p style={{ fontSize: 13, color: "var(--lp-text-2)" }}>
                  Synchronized with Survey Department datum, WGS84 / SLD99 coordinates, and Lanka Government Cloud.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <span className="lp-pill lp-pill--outline">Real-time Webhook API</span>
              <span className="lp-pill lp-pill--outline">ISO 19115 GIS Standard</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Intended Stakeholders */}
      <section className="lp-section lp-section--canvas" aria-labelledby="lp-about-stakeholders">
        <div className="lp-container">
          <SectionHeader
            eyebrow="User Ecosystem"
            title="Built for Cross-Disciplinary Operational Clarity"
            lede="A platform is only effective when it directly serves the operational day-to-day requirements of every entity responsible for our shared public spaces."
            id="lp-about-stakeholders"
            wide
          />
          <div className="lp-card" style={{ overflow: "hidden", marginBottom: "2rem" }}>
            <div className="lp-split-7-5" style={{ gap: 0, alignItems: "stretch" }}>
              <div style={{ position: "relative", minHeight: 320 }}>
                <Image
                  src="/landing/lp/qa-inspection.jpg"
                  alt={lp.audiences.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 680px, 100vw"
                  style={{ objectFit: "cover" }}
                />
                <span
                  style={{
                    position: "absolute",
                    top: "1rem",
                    left: "1rem",
                    padding: "4px 10px",
                    background: "rgba(255,255,255,0.94)",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--lp-primary)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <CompassIcon aria-hidden="true" width={14} height={14} />
                  Authoritative Field Audit
                </span>
              </div>
              <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}>
                <div>
                  <span className="lp-eyebrow">Statutory Quality Assurance</span>
                  <h3 className="lp-display lp-h3" style={{ marginTop: 4 }}>
                    Post-Remediation Corridor Validation
                  </h3>
                  <p style={{ fontSize: 15, lineHeight: "24px", color: "var(--lp-text-2)", marginTop: "0.75rem" }}>
                    Joint technical inspections eliminate subsequent trenching disputes by certifying asphalt compaction, digital asset telemetry coordinates, and subsurface line depths before asset handover.
                  </p>
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "0.75rem",
                      background: "var(--lp-low)",
                      border: "1px solid var(--lp-border)",
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--lp-text)",
                    }}
                  >
                    Plate 2.3 — Chainage +4.2 KM post-remediation inspection adhering to SLS 1248 civil corridor standards
                  </div>
                </div>
                <div
                  style={{
                    paddingTop: "0.75rem",
                    borderTop: "1px solid var(--lp-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--lp-muted)",
                  }}
                >
                  <span>RDA QA / NSDI Verified</span>
                  <span style={{ color: "var(--lp-success-text)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2Icon aria-hidden="true" width={15} height={15} />
                    Compliant Handover
                  </span>
                </div>
              </div>
            </div>
          </div>

          <ul className="lp-grid3" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {[
              {
                Icon: UsersIcon,
                card: lp.audiences.cards[0],
                href: links.howItWorks,
                bullets: [
                  "Track active trenching and resurfacing within residential wards",
                  "Direct grievance submission with GPS photo geo-tagging",
                  "Advance disruption alerts for planned water and power work",
                ],
              },
              {
                Icon: LandmarkIcon,
                card: lp.audiences.cards[1],
                href: links.signIn,
                bullets: [
                  "Automated spatial conflict alerts against upcoming agency tenders",
                  "Consolidated Right-of-Way (RoW) digital permit dispatch",
                  "Shared utility corridor cost apportionment calculation",
                ],
              },
              {
                Icon: HardHatIcon,
                card: lp.audiences.cards[2],
                href: links.signIn,
                bullets: [
                  "On-site QR clearance passes for municipal police inspections",
                  "Direct upload of post-construction as-built GIS vector files",
                  "Clear utility safety boundary overlays before mechanized digging",
                ],
              },
            ].map(({ Icon, card, href, bullets }) => (
              <li key={card.title} style={{ display: "flex" }}>
                <div className="lp-tile lp-tile--audience" style={{ width: "100%" }}>
                  <div>
                    <div className="lp-tile__icon">
                      <Icon aria-hidden="true" />
                    </div>
                    <div className="lp-tile__tag">{card.tag}</div>
                    <h3 className="lp-display lp-h3" style={{ marginTop: 4 }}>
                      {card.title}
                    </h3>
                    <ul style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 0", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {bullets.map((b) => (
                        <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: 13, lineHeight: "19px", color: "var(--lp-text-2)" }}>
                          <CheckCircle2Icon aria-hidden="true" width={16} height={16} style={{ color: "var(--lp-primary)", flexShrink: 0, marginTop: 2 }} />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link href={href} className="lp-tile__link">
                    {card.cta}
                    <ArrowRightIcon aria-hidden="true" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* SECTION 5: Platform Status & Governance Disclosure */}
      <section className="lp-section lp-section--card" aria-labelledby="lp-about-disclosure">
        <div className="lp-container">
          <div className="lp-cadence">
            <div className="lp-cadence__head" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div className="lp-cadence__icon">
                  <ShieldCheckIcon aria-hidden="true" width={22} height={22} />
                </div>
                <div>
                  <span className="lp-eyebrow">Institutional Status Disclosure</span>
                  <h2 id="lp-about-disclosure" className="lp-display lp-h3">
                    Platform Prototype &amp; Academic Research Status
                  </h2>
                </div>
              </div>
              <span className="lp-pill lp-pill--outline">Operational Pilot • Battaramulla Test Zone</span>
            </div>
            <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem", color: "var(--lp-text-2)" }}>
              <p>
                INFRAOS currently operates as an authoritative research prototype developed in collaboration with civil infrastructure researchers, municipal planning officers, and senior engineering stakeholders across the Road Development Authority (RDA) and the National Water Supply and Drainage Board (NWSDB) domain.
              </p>
              <p>
                The project serves as an operational blueprint for Right-of-Way coordination. Simulated project registries, risk vectors, and co-location workflows utilize realistic public engineering parameters within the Western Province demonstration zone.
              </p>
            </div>
            <div className="lp-grid3" style={{ marginTop: "1.25rem" }}>
              <div className="lp-card" style={{ padding: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: 12, fontWeight: 700, color: "var(--lp-text)" }}>
                  <GraduationCapIcon aria-hidden="true" width={16} height={16} style={{ color: "var(--lp-primary)" }} />
                  Academic Supervision
                </div>
                <p style={{ fontSize: 13, color: "var(--lp-text-2)", marginTop: 4 }}>
                  Spatial Urban &amp; Transport Systems Modeling Lab · University GovTech Initiative
                </p>
              </div>
              <div className="lp-card" style={{ padding: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: 12, fontWeight: 700, color: "var(--lp-text)" }}>
                  <ScaleIcon aria-hidden="true" width={16} height={16} style={{ color: "var(--lp-primary)" }} />
                  Regulatory Alignment
                </div>
                <p style={{ fontSize: 13, color: "var(--lp-text-2)", marginTop: 4 }}>
                  National Physical Planning Policy &amp; Public Utilities Commission (PUCSL) Framework
                </p>
              </div>
              <div className="lp-card" style={{ padding: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: 12, fontWeight: 700, color: "var(--lp-text)" }}>
                  <Code2Icon aria-hidden="true" width={16} height={16} style={{ color: "var(--lp-primary)" }} />
                  Open Access Standards
                </div>
                <p style={{ fontSize: 13, color: "var(--lp-text-2)", marginTop: 4 }}>
                  Aligned with Open Contracting Data Standard (OCDS) &amp; OGC GIS API standards
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </LpSubpageShell>
  );
}


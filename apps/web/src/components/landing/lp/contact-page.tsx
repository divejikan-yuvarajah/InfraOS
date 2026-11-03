"use client";

import {
  ArrowRightIcon,
  CheckCircle2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";

import { getLpLinks } from "@/lib/landing/lp-data";
import type { PublicLocale } from "@/lib/landing/locales";
import { getPublicCopy } from "@/lib/landing/messages";
import { LpSubpageShell } from "./lp-subpage-shell";

interface ContactPageProps {
  locale: PublicLocale;
}

const SRI_LANKA_DISTRICTS = [
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matale",
  "Nuwara Eliya",
  "Galle",
  "Matara",
  "Hambantota",
  "Jaffna",
  "Kilinochchi",
  "Mannar",
  "Vavuniya",
  "Mullaitivu",
  "Batticaloa",
  "Ampara",
  "Trincomalee",
  "Kurunegala",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Moneragala",
  "Ratnapura",
  "Kegalle",
];

const REGIONAL_DESKS = [
  { region: "Colombo Region", code: "EXT. 201–204", coverage: "CMC, Dehiwala-Mt. Lavinia, Sri Jayawardenepura Kotte" },
  { region: "Western Outskirts", code: "EXT. 210–212", coverage: "Gampaha, Negombo, Kalutara Arterial Corridors" },
  { region: "Central / Kandy", code: "EXT. 301–305", coverage: "Kandy Municipal, Peradeniya, Nuwara Eliya" },
  { region: "Southern / Galle", code: "EXT. 401–403", coverage: "Galle Four Gravets, Matara, Hambantota Port Ring" },
  { region: "Northern / Jaffna", code: "EXT. 501–504", coverage: "Jaffna Peninsula, A9 Arterial & Regional Water Grids" },
  { region: "Eastern Province", code: "EXT. 601–603", coverage: "Trincomalee, Batticaloa, Ampara Coastal Corridors" },
];

export function ContactPage({ locale }: ContactPageProps) {
  const copy = getPublicCopy(locale);
  const links = getLpLinks(locale);
  const pageCopy = copy.infoPages.contact;

  const [fullName, setFullName] = useState("");
  const [nicNumber, setNicNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [classification, setClassification] = useState("Uncoordinated Road Excavation / Moratorium Breach");
  const [district, setDistrict] = useState("Colombo");
  const [roadLocation, setRoadLocation] = useState("");
  const [narrative, setNarrative] = useState("");
  const [declared, setDeclared] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <LpSubpageShell locale={locale} infoSlug="contact">
      {/* Top Utility Context Bar & Page Header */}
      <section className="lp-subhero" aria-labelledby="contact-hero-heading">
        <div className="lp-container">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              marginBottom: "1.25rem",
            }}
          >
            <nav className="lp-breadcrumb" aria-label="Breadcrumb" style={{ marginBottom: 0 }}>
              <Link href={links.home} className="lp-focus" style={{ color: "var(--lp-text-muted)", textDecoration: "none" }}>
                {copy.nav.home}
              </Link>
              <span aria-hidden="true">/</span>
              <span style={{ color: "var(--lp-orange)" }}>{copy.nav.contact}</span>
            </nav>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.65rem" }}>
              <span className="lp-chip lp-chip-green">Central Dispatch Desk: Operational</span>
              <span className="lp-chip lp-chip-neutral">ISO 9001:2015 Civil Registry</span>
            </div>
          </div>

          <div style={{ maxWidth: "52rem", marginBottom: "2rem" }}>
            <div className="lp-eyebrow" style={{ marginBottom: "0.5rem" }}>
              Ministry Liaison Desk • National Infrastructure Secretariat
            </div>
            <h1
              id="contact-hero-heading"
              className="lp-serif"
              style={{
                fontSize: "clamp(2.15rem, 3.8vw, 3.25rem)",
                lineHeight: 1.12,
                color: "var(--lp-text)",
                margin: "0 0 0.85rem",
              }}
            >
              {locale === "en" ? "Public Enquiries & Agency Coordination Helpdesk" : pageCopy.title}
            </h1>
            <p
              style={{
                fontSize: "1.0625rem",
                lineHeight: 1.65,
                color: "var(--lp-text-secondary)",
                margin: 0,
              }}
            >
              {locale === "en"
                ? "Official intake channel for citizen roadwork inquiries, 5-year moratorium breach alerts, and inter-agency RoadSync technical support across Sri Lanka."
                : pageCopy.intro}
            </p>
          </div>

          {/* 4-Card Live Service Level Performance Ribbon */}
          <div className="lp-grid4">
            <div className="lp-kpi" style={{ borderTop: "3px solid var(--lp-orange)" }}>
              <span className="lp-kpi-label">PUBLIC TRIAGE SLA</span>
              <div className="lp-kpi-value" style={{ fontSize: "1.75rem" }}>
                48 Hours
              </div>
              <p className="lp-kpi-sub" style={{ margin: 0 }}>
                Initial verification &amp; agency routing window
              </p>
            </div>
            <div className="lp-kpi" style={{ borderTop: "3px solid var(--lp-text)" }}>
              <span className="lp-kpi-label">CORRIDOR CONFLICT DESK</span>
              <div className="lp-kpi-value" style={{ fontSize: "1.75rem" }}>
                4 Hours
              </div>
              <p className="lp-kpi-sub" style={{ margin: 0 }}>
                Inter-agency emergency clash escalation
              </p>
            </div>
            <div className="lp-kpi" style={{ borderTop: "3px solid var(--lp-green)" }}>
              <span className="lp-kpi-label">GIC GATEWAY</span>
              <div className="lp-kpi-value" style={{ fontSize: "1.75rem", color: "var(--lp-green-text)" }}>
                1919
              </div>
              <p className="lp-kpi-sub" style={{ margin: 0 }}>
                National Government Information Center
              </p>
            </div>
            <div className="lp-kpi" style={{ borderTop: "3px solid var(--lp-yellow)" }}>
              <span className="lp-kpi-label">REGISTRY VERIFICATION</span>
              <div className="lp-kpi-value" style={{ fontSize: "1.75rem" }}>
                NIC Audit
              </div>
              <p className="lp-kpi-sub" style={{ margin: 0 }}>
                Traceable statutory docket numbers
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Two-Column Operational Layout: Intake Form + Liaison Directory */}
      <section className="lp-subpage-section" aria-labelledby="enquiry-form-heading">
        <div className="lp-container">
          <div className="lp-split-7-5">
            {/* Left Column: Official Enquiry Intake Form */}
            <div className="lp-card" style={{ padding: "2rem" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  paddingBottom: "1rem",
                  marginBottom: "1.5rem",
                  borderBottom: "1px solid var(--lp-border)",
                }}
              >
                <div>
                  <div className="lp-eyebrow">Official Enquiry Intake</div>
                  <h2
                    id="enquiry-form-heading"
                    className="lp-serif"
                    style={{ fontSize: "1.5rem", color: "var(--lp-text)", margin: "0.2rem 0 0" }}
                  >
                    Submit a Corridor Inquiry or Moratorium Alert
                  </h2>
                </div>
                <span className="lp-chip lp-chip-neutral">Form Ref: SEC-2025/ENQ</span>
              </div>

              {submitted && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    padding: "1.15rem",
                    borderRadius: "0.5rem",
                    background: "var(--lp-green-bg)",
                    border: "1px solid rgba(39,149,65,0.35)",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontWeight: 700,
                      color: "var(--lp-green-text)",
                      marginBottom: "0.35rem",
                    }}
                  >
                    <CheckCircle2Icon className="h-4 w-4" aria-hidden="true" />
                    <span>Enquiry Logged in Preview Mode</span>
                  </div>
                  <p style={{ fontSize: "0.875rem", color: "var(--lp-green-text)", margin: "0 0 0.35rem" }}>
                    Registry Reference:{" "}
                    <strong className="lp-mono">LK-RDA-2025-08942</strong> (Conceptual Preview Confirmation)
                  </p>
                  <p style={{ fontSize: "0.8125rem", color: "var(--lp-text-secondary)", margin: 0 }}>
                    Note: This public portal is a research and architectural preview; no personal data has been
                    transmitted to external government servers.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className="lp-grid2">
                  <div className="lp-field">
                    <label htmlFor="contact-full-name" className="lp-label">
                      <span>Full Name *</span>
                      <span className="lp-hint">REQUIRED</span>
                    </label>
                    <input
                      id="contact-full-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g., K. D. Perera"
                      className="lp-input lp-focus"
                    />
                  </div>

                  <div className="lp-field">
                    <label htmlFor="contact-nic" className="lp-label">
                      <span>Sri Lankan NIC Number</span>
                      <span className="lp-hint">OPTIONAL</span>
                    </label>
                    <input
                      id="contact-nic"
                      type="text"
                      value={nicNumber}
                      onChange={(e) => setNicNumber(e.target.value)}
                      placeholder="e.g., 198824501234 or 882450123V"
                      className="lp-input lp-focus"
                    />
                  </div>
                </div>

                <div className="lp-grid2">
                  <div className="lp-field">
                    <label htmlFor="contact-email" className="lp-label">
                      <span>Email Address *</span>
                      <span className="lp-hint">FOR DOCKET RECEIPT</span>
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="citizen@example.lk"
                      className="lp-input lp-focus"
                    />
                  </div>

                  <div className="lp-field">
                    <label htmlFor="contact-phone" className="lp-label">
                      <span>Direct Contact Number *</span>
                      <span className="lp-hint">SMS UPDATES</span>
                    </label>
                    <input
                      id="contact-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+94 71 234 5678"
                      className="lp-input lp-focus"
                    />
                  </div>
                </div>

                <div className="lp-grid2">
                  <div className="lp-field">
                    <label htmlFor="contact-classification" className="lp-label">
                      <span>Enquiry Classification *</span>
                    </label>
                    <select
                      id="contact-classification"
                      value={classification}
                      onChange={(e) => setClassification(e.target.value)}
                      className="lp-select lp-focus"
                    >
                      <option value="Uncoordinated Road Excavation / Moratorium Breach">
                        Uncoordinated Road Excavation / Moratorium Breach
                      </option>
                      <option value="Delayed Road Reinstatement / Unsealed Trench">
                        Delayed Road Reinstatement / Unsealed Trench
                      </option>
                      <option value="Public Project Timeline / Corridor Schedule Inquiry">
                        Public Project Timeline / Corridor Schedule Inquiry
                      </option>
                      <option value="Inter-Agency RoadSync Technical Support">
                        Inter-Agency RoadSync Technical Support
                      </option>
                      <option value="Academic / Policy Research Collaboration">
                        Academic / Policy Research Collaboration
                      </option>
                    </select>
                  </div>

                  <div className="lp-field">
                    <label htmlFor="contact-district" className="lp-label">
                      <span>Administrative District *</span>
                    </label>
                    <select
                      id="contact-district"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="lp-select lp-focus"
                    >
                      {SRI_LANKA_DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="lp-field">
                  <label htmlFor="contact-road" className="lp-label">
                    <span>Project Location / Road Corridor Name *</span>
                    <span className="lp-hint">ROUTE CODE OR LANDMARK</span>
                  </label>
                  <input
                    id="contact-road"
                    type="text"
                    required
                    value={roadLocation}
                    onChange={(e) => setRoadLocation(e.target.value)}
                    placeholder="e.g., A004 High Level Road — Nugegoda Flyover Sector (KM 08.4)"
                    className="lp-input lp-focus"
                  />
                </div>

                <div className="lp-field">
                  <label htmlFor="contact-narrative" className="lp-label">
                    <span>Detailed Narrative &amp; Observation *</span>
                  </label>
                  <textarea
                    id="contact-narrative"
                    required
                    value={narrative}
                    onChange={(e) => setNarrative(e.target.value)}
                    placeholder="Describe the observed utility work, agency signage on site, or specific corridor coordination query..."
                    className="lp-textarea lp-focus"
                  />
                </div>

                <label
                  htmlFor="contact-declaration"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.65rem",
                    padding: "0.85rem",
                    borderRadius: "0.375rem",
                    background: "var(--lp-surface-low)",
                    border: "1px solid var(--lp-border)",
                    fontSize: "0.8125rem",
                    color: "var(--lp-text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    id="contact-declaration"
                    type="checkbox"
                    checked={declared}
                    onChange={(e) => setDeclared(e.target.checked)}
                    style={{ marginTop: "0.2rem", accentColor: "#FF5B00" }}
                  />
                  <span>
                    <strong>Statutory Declaration:</strong> I confirm that the corridor details provided above are
                    accurate to the best of my knowledge for public infrastructure coordination review.
                  </span>
                </label>

                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                  <button type="submit" className="lp-btn lp-btn-primary lp-focus">
                    <span>Submit Official Enquiry</span>
                    <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="lp-mono" style={{ fontSize: "0.75rem", color: "var(--lp-text-muted)" }}>
                    conceptual-intake-preview · zero external transmission
                  </span>
                </div>
              </form>
            </div>

            {/* Right Column: Physical Liaison Office + Hotlines + Emergency Directory */}
            <aside aria-label="Liaison Office and Emergency Utility Hotlines" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Physical Liaison Office Card */}
              <div className="lp-card" style={{ overflow: "hidden" }}>
                <div style={{ position: "relative", height: "11.5rem", width: "100%" }}>
                  <Image
                    src="/landing/lp/aerial-highway.jpg"
                    alt="Aerial view of Sri Lankan highway interchange corridor"
                    fill
                    sizes="(max-width: 1024px) 100vw, 440px"
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
                      padding: "0.2rem 0.55rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.6875rem",
                    }}
                  >
                    PHYSICAL LIAISON OFFICE
                  </span>
                </div>
                <div style={{ padding: "1.35rem" }}>
                  <h3 className="lp-serif" style={{ fontSize: "1.2rem", color: "var(--lp-text)", margin: "0 0 0.45rem" }}>
                    National Infrastructure Coordination Secretariat
                  </h3>
                  <p style={{ fontSize: "0.84375rem", lineHeight: 1.55, color: "var(--lp-text-secondary)", margin: "0 0 0.85rem" }}>
                    Ministry of Transport &amp; Highways Complex, &ldquo;Maganeguma Mahamedura&rdquo;, Denzil
                    Kobbekaduwa Mawatha, Battaramulla 10120, Sri Lanka.
                  </p>
                  <div
                    className="lp-mono"
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--lp-text-muted)",
                      paddingTop: "0.65rem",
                      borderTop: "1px solid var(--lp-border)",
                    }}
                  >
                    GRID REF: 6.9016° N, 79.9188° E · WESTERN PROVINCE
                  </div>
                </div>
              </div>

              {/* Direct Hotlines & Routing Card */}
              <div className="lp-card" style={{ padding: "1.35rem" }}>
                <div className="lp-eyebrow" style={{ marginBottom: "0.35rem" }}>
                  Direct Hotlines &amp; Routing
                </div>
                <h3 className="lp-serif" style={{ fontSize: "1.2rem", color: "var(--lp-text)", margin: "0 0 0.85rem" }}>
                  Central Helpdesk Channels
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", fontSize: "0.84375rem" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.55rem 0.75rem",
                      background: "var(--lp-surface-low)",
                      borderRadius: "0.25rem",
                    }}
                  >
                    <span style={{ color: "var(--lp-text-secondary)" }}>GIC / Direct Line</span>
                    <strong className="lp-mono" style={{ color: "var(--lp-text)" }}>
                      1919 / +94 11 288 7450
                    </strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.55rem 0.75rem",
                      background: "var(--lp-surface-low)",
                      borderRadius: "0.25rem",
                    }}
                  >
                    <span style={{ color: "var(--lp-text-secondary)" }}>Registry Email</span>
                    <strong className="lp-mono" style={{ color: "var(--lp-orange-text)" }}>
                      helpdesk@infraos.gov.lk
                    </strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.55rem 0.75rem",
                      background: "var(--lp-surface-low)",
                      borderRadius: "0.25rem",
                    }}
                  >
                    <span style={{ color: "var(--lp-text-secondary)" }}>Operating Hours</span>
                    <strong className="lp-mono" style={{ color: "var(--lp-text)" }}>
                      Mon–Fri: 08:30 – 16:30
                    </strong>
                  </div>
                </div>
              </div>

              {/* Inter-Agency Emergency Damage Reporting */}
              <div
                className="lp-card"
                style={{
                  padding: "1.35rem",
                  borderTop: "4px solid var(--lp-maroon)",
                  background: "#FFFBFB",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                  <TriangleAlertIcon className="h-4 w-4 text-[#8C1F28]" aria-hidden="true" />
                  <span
                    className="lp-mono"
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--lp-maroon)",
                      textTransform: "uppercase",
                    }}
                  >
                    Inter-Agency Emergency Damage Reporting
                  </span>
                </div>
                <p style={{ fontSize: "0.8125rem", lineHeight: 1.5, color: "var(--lp-text-secondary)", margin: "0 0 0.85rem" }}>
                  For active utility strikes during excavation (burst water mains, downed HV lines, severed fiber
                  trunks), contact the 24/7 utility control rooms directly:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div
                    className="lp-mono"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.25rem",
                      background: "var(--lp-maroon-bg)",
                      color: "var(--lp-maroon)",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                    }}
                  >
                    <span>NWSDB (Water Supply Strike)</span>
                    <span>1939</span>
                  </div>
                  <div
                    className="lp-mono"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.25rem",
                      background: "var(--lp-maroon-bg)",
                      color: "var(--lp-maroon)",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                    }}
                  >
                    <span>CEB (High-Voltage Cable Fault)</span>
                    <span>1987</span>
                  </div>
                  <div
                    className="lp-mono"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.25rem",
                      background: "var(--lp-maroon-bg)",
                      color: "var(--lp-maroon)",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                    }}
                  >
                    <span>SLT-Mobitel (Backbone Fiber Cut)</span>
                    <span>1212</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Section 3: Statutory Triage SLA & Direct Regional Desk Extensions */}
      <section
        className="lp-subpage-section"
        style={{ background: "var(--lp-surface-low)" }}
        aria-labelledby="sla-escalation-heading"
      >
        <div className="lp-container">
          <div style={{ marginBottom: "1.75rem" }}>
            <div className="lp-eyebrow" style={{ marginBottom: "0.35rem" }}>
              Governance &amp; Response Protocol
            </div>
            <h2
              id="sla-escalation-heading"
              className="lp-serif"
              style={{ fontSize: "clamp(1.65rem, 2.8vw, 2.2rem)", color: "var(--lp-text)", margin: 0 }}
            >
              Statutory Triage &amp; Escalation Service Level Agreement (SLA)
            </h2>
          </div>

          {/* 3-Phase SLA Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1.25rem",
              marginBottom: "2.5rem",
            }}
          >
            <div className="lp-card" style={{ padding: "1.5rem", borderTop: "3px solid var(--lp-orange)" }}>
              <span className="lp-chip lp-chip-orange" style={{ marginBottom: "0.75rem" }}>
                PHASE 01 · T + 0 TO 48 HOURS
              </span>
              <h3 className="lp-serif" style={{ fontSize: "1.25rem", color: "var(--lp-text)", margin: "0 0 0.5rem" }}>
                Automated GIS Chainage Verification
              </h3>
              <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--lp-text-secondary)", margin: 0 }}>
                Every submitted inquiry is matched against active RoadSync corridor polygons and moratorium locks.
                Unpermitted excavations trigger an immediate stop-work alert to the provincial engineer.
              </p>
            </div>

            <div className="lp-card" style={{ padding: "1.5rem", borderTop: "3px solid var(--lp-yellow)" }}>
              <span className="lp-chip lp-chip-yellow" style={{ marginBottom: "0.75rem" }}>
                PHASE 02 · T + 3 TO 5 DAYS
              </span>
              <h3 className="lp-serif" style={{ fontSize: "1.25rem", color: "var(--lp-text)", margin: "0 0 0.5rem" }}>
                Joint Field Inspection &amp; Agency Assignment
              </h3>
              <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--lp-text-secondary)", margin: 0 }}>
                Field QA officers inspect trench reinstatement quality, barricade safety, and contractor permit
                credentials, assigning binding remediation tasks to the responsible utility board.
              </p>
            </div>

            <div className="lp-card" style={{ padding: "1.5rem", borderTop: "3px solid var(--lp-green)" }}>
              <span className="lp-chip lp-chip-green" style={{ marginBottom: "0.75rem" }}>
                PHASE 03 · T + 7 TO 14 DAYS
              </span>
              <h3 className="lp-serif" style={{ fontSize: "1.25rem", color: "var(--lp-text)", margin: "0 0 0.5rem" }}>
                Statutory Resolution &amp; Public Closure Log
              </h3>
              <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--lp-text-secondary)", margin: 0 }}>
                Once surface reinstatement passes geodetic and compaction verification, the citizen receives a formal
                closure transcript with photographic evidence and audit sign-off.
              </p>
            </div>
          </div>

          {/* Direct Regional Desk Extensions */}
          <div className="lp-card" style={{ padding: "1.75rem" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <div className="lp-eyebrow">Provincial Coordination Network</div>
                <h3 className="lp-serif" style={{ fontSize: "1.35rem", color: "var(--lp-text)", margin: "0.2rem 0 0" }}>
                  Direct Regional Desk Extensions
                </h3>
              </div>
              <span className="lp-chip lp-chip-neutral">DIAL +94 11 288 7450 + EXT</span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "1rem",
              }}
            >
              {REGIONAL_DESKS.map((desk) => (
                <div
                  key={desk.region}
                  style={{
                    padding: "1rem",
                    borderRadius: "0.375rem",
                    background: "var(--lp-surface-low)",
                    border: "1px solid var(--lp-border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.35rem",
                    }}
                  >
                    <strong style={{ fontSize: "0.9375rem", color: "var(--lp-text)" }}>{desk.region}</strong>
                    <span
                      className="lp-mono"
                      style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--lp-orange-text)" }}
                    >
                      {desk.code}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.8125rem", lineHeight: 1.45, color: "var(--lp-text-secondary)", margin: 0 }}>
                    {desk.coverage}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </LpSubpageShell>
  );
}

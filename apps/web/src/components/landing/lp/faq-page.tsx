"use client";

import {
  ArrowRightIcon,
  ChevronDownIcon,
  GlobeIcon,
  LockIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { getLpCopy } from "@/lib/landing/lp-copy";
import { getLpLinks } from "@/lib/landing/lp-data";
import type { PublicLocale } from "@/lib/landing/locales";
import { getPublicCopy } from "@/lib/landing/messages";
import { LpSubpageShell } from "./lp-subpage-shell";

interface FaqPageProps {
  locale: PublicLocale;
}

type FaqCategory =
  | "All Questions"
  | "General Infrastructure"
  | "Public Rights & Access"
  | "Agency Protocols"
  | "Technical & RoadSync";

interface StitchFaqItem {
  num: string;
  category: Exclude<FaqCategory, "All Questions">;
  directiveRef: string;
  question: string;
  answer: string;
  bulletPoints?: string[];
  calloutNote?: string;
}

const CATEGORIES: FaqCategory[] = [
  "All Questions",
  "General Infrastructure",
  "Public Rights & Access",
  "Agency Protocols",
  "Technical & RoadSync",
];

const STITCH_FAQ_ITEMS: StitchFaqItem[] = [
  {
    num: "01",
    category: "General Infrastructure",
    directiveRef: "REF: SEC-01/GEN",
    question: "What is INFRAOS?",
    answer:
      "INFRAOS (Infrastructure Operations & Synchronization System) is a unified civic coordination platform and GIS corridor registry designed for Sri Lankan highway, water, power, telecommunications, and municipal authorities. It brings forward capital works planning, digital wayleave clearances, field execution tracking, and public transparency under a single architectural standard.",
    bulletPoints: [
      "Connects RDA, NWSDB, CEB, SLT-Mobitel, and Municipal Engineering Departments.",
      "Provides citizens with verified roadwork schedules and expected completion timelines.",
    ],
  },
  {
    num: "02",
    category: "General Infrastructure",
    directiveRef: "REF: SEC-02/CRD",
    question: "Why is inter-agency coordination necessary?",
    answer:
      "Without a shared spatial registry, freshly carpeted highways are frequently re-excavated within months by underground utility providers operating on separate budget cycles. Inter-agency coordination eliminates destructive repeat trenching, preserves structural road pavement life, reduces commuter congestion, and protects public capital expenditure.",
    calloutNote:
      "Synchronized single-pass trenching reduces repeat utility cuts by up to 78% across coordinated corridors.",
  },
  {
    num: "03",
    category: "Technical & RoadSync",
    directiveRef: "REF: SEC-03/RSY",
    question: "What is RoadSync?",
    answer:
      "RoadSync is the automated spatial-temporal conflict detection and moratorium enforcement engine built into INFRAOS. Whenever two or more agencies submit excavation envelopes that overlap in space and time, RoadSync flags the clash, halts isolated permits, and opens a mandatory Joint Trenching Docket.",
    bulletPoints: [
      "Enforces 3D subterranean clearance rules (SLS 1248 vertical and horizontal buffer checks).",
      "Activates an automated 5-year statutory excavation moratorium lock once final asphalt surfacing is verified.",
    ],
  },
  {
    num: "04",
    category: "Agency Protocols",
    directiveRef: "REF: SEC-04/USR",
    question: "Who can use the platform?",
    answer:
      "INFRAOS operates on a dual-tier access model. The Public Civic Portal is open to all citizens, researchers, and commuters without registration. The Authorized Operations Portal is restricted to verified government engineers, utility planning directors, QA surveyors, and accredited civil contractors holding valid role-based credentials.",
  },
  {
    num: "05",
    category: "Public Rights & Access",
    directiveRef: "REF: SEC-05/PUB",
    question: "What information is public?",
    answer:
      "Under public transparency guidelines, the civic portal publishes active and scheduled road corridor works, lead and participating utility agencies, stage progression (from Plan to Maintain), expected road reopening dates, and moratorium protection status. Sensitive critical-infrastructure vulnerability schematics remain restricted to authorized security clearances.",
  },
  {
    num: "06",
    category: "Agency Protocols",
    directiveRef: "REF: SEC-06/GOV",
    question: "Does INFRAOS replace government authority?",
    answer:
      "No. INFRAOS is a technical coordination and decision-support system; it does not supersede the statutory mandate of any Ministry, Department, or Local Authority. All legal permits, traffic orders, and financial disbursements remain governed by the respective statutory officers of the Road Development Authority, utility boards, and municipal councils.",
  },
  {
    num: "07",
    category: "Public Rights & Access",
    directiveRef: "REF: SEC-07/CIT",
    question: "How can a citizen get help or report uncoordinated digging?",
    answer:
      "Citizens can lodge an official corridor inquiry or report an unmarked excavation hazard through the Contact & Helpdesk portal, or call the National Government Information Center (1919) / Tri-Agency Emergency Desk (1910) for urgent road safety hazards. Every submission receives a trackable registry reference number.",
  },
];

export function FaqPage({ locale }: FaqPageProps) {
  const copy = getPublicCopy(locale);
  const lpCopy = getLpCopy(locale);
  const links = getLpLinks(locale);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<FaqCategory>("All Questions");
  const [openIndices, setOpenIndices] = useState<Record<string, boolean>>({ "01": true, "03": true });

  const mergedItems = useMemo(() => {
    return STITCH_FAQ_ITEMS.map((item, idx) => {
      const locItem = copy.faq.items[idx];
      return {
        ...item,
        question: locale === "en" ? item.question : locItem?.question ?? item.question,
        answer: locale === "en" ? item.answer : locItem?.answer ?? item.answer,
      };
    });
  }, [copy.faq.items, locale]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mergedItems.filter((item) => {
      const matchesCat = activeCategory === "All Questions" || item.category === activeCategory;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.directiveRef.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, mergedItems, searchQuery]);

  const toggleItem = (num: string) => {
    setOpenIndices((prev) => ({ ...prev, [num]: !prev[num] }));
  };

  return (
    <LpSubpageShell locale={locale} infoSlug="faq">
      {/* Top Institutional Banner & Search */}
      <section className="lp-subhero" aria-labelledby="faq-hero-heading">
        <div className="lp-container">
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
            <nav className="lp-breadcrumb" aria-label="Breadcrumb" style={{ marginBottom: 0 }}>
              <Link href={links.home} className="lp-focus" style={{ color: "var(--lp-text-muted)", textDecoration: "none" }}>
                {copy.nav.home}
              </Link>
              <span aria-hidden="true">/</span>
              <span style={{ color: "var(--lp-orange)" }}>{copy.nav.faq}</span>
            </nav>
            <span className="lp-mono" style={{ fontSize: "0.75rem", color: "var(--lp-text-muted)" }}>
              Statutory Ref: LK-NII-DIR-2024/09
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: "1.25rem",
              marginBottom: "2rem",
            }}
          >
            <div>
              <div className="lp-eyebrow" style={{ marginBottom: "0.5rem" }}>
                Public Oversight Knowledge Base
              </div>
              <h1
                id="faq-hero-heading"
                className="lp-serif"
                style={{
                  fontSize: "clamp(2.15rem, 3.8vw, 3.25rem)",
                  lineHeight: 1.12,
                  color: "var(--lp-text)",
                  margin: "0 0 0.75rem",
                }}
              >
                {locale === "en" ? "Public Inquiries & Platform FAQ" : copy.faq.title}
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
                  ? "Authoritative guidance on how INFRAOS and the RoadSync engine coordinate national road corridors, safeguard public funds, and protect citizen access rights."
                  : copy.faq.intro}
              </p>
            </div>

            <span className="lp-chip lp-chip-green">
              Gazetted Standard · Updated Bi-Weekly • Colombo HQ
            </span>
          </div>

          {/* Search Input + Category Filter Bar */}
          <div
            className="lp-card"
            style={{
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem", justifyContent: "space-between" }}>
              <div className="lp-searchbox" style={{ flex: "1 1 20rem" }}>
                <SearchIcon className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
                <label htmlFor="faq-search" className="sr-only">
                  Search public inquiries and directives
                </label>
                <input
                  id="faq-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by keyword (e.g., RoadSync, moratorium, 1919, permits)..."
                />
              </div>
              <span className="lp-mono" style={{ fontSize: "0.75rem", color: "var(--lp-text-muted)" }}>
                Showing {filteredItems.length} of {mergedItems.length} Official Responses
              </span>
            </div>

            <div className="lp-tabs" role="tablist" aria-label="FAQ Categories">
              {CATEGORIES.map((category) => {
                const isActive = activeCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveCategory(category)}
                    className={`lp-tab lp-focus ${isActive ? "lp-tab-active" : ""}`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Main 2-Column FAQ Stream + Institutional Sidebar */}
      <section className="lp-subpage-section" aria-label="Frequently Asked Questions and Institutional Context">
        <div className="lp-container">
          <div className="lp-split-8-4">
            {/* Left Accordion List */}
            <div>
              {filteredItems.length === 0 ? (
                <div className="lp-card" style={{ padding: "2rem", textAlign: "center" }}>
                  <p style={{ fontSize: "1rem", color: "var(--lp-text-secondary)", margin: "0 0 1rem" }}>
                    No FAQ entries matched your filter criteria.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setActiveCategory("All Questions");
                    }}
                    className="lp-btn lp-btn-secondary lp-focus"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {filteredItems.map((item) => {
                    const isOpen = Boolean(openIndices[item.num]);
                    const panelId = `faq-panel-${item.num}`;
                    const btnId = `faq-btn-${item.num}`;

                    return (
                      <div key={item.num} className="lp-faq-item">
                        <h2 style={{ margin: 0 }}>
                          <button
                            id={btnId}
                            type="button"
                            className="lp-faq-btn lp-focus"
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            onClick={() => toggleItem(item.num)}
                          >
                            <span className="lp-faq-num">{item.num}</span>
                            <span style={{ flex: 1 }}>
                              <span
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                  marginBottom: "0.35rem",
                                }}
                              >
                                <span className="lp-chip lp-chip-neutral">{item.category}</span>
                                <span
                                  className="lp-mono"
                                  style={{ fontSize: "0.6875rem", color: "var(--lp-text-muted)" }}
                                >
                                  {item.directiveRef}
                                </span>
                              </span>
                              <span
                                className="lp-serif"
                                style={{
                                  display: "block",
                                  fontSize: "1.25rem",
                                  fontWeight: 600,
                                  color: "var(--lp-text)",
                                }}
                              >
                                {item.question}
                              </span>
                            </span>
                            <span
                              aria-hidden="true"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "2rem",
                                height: "2rem",
                                borderRadius: "9999px",
                                background: isOpen ? "rgba(255,91,0,0.1)" : "var(--lp-surface-low)",
                                color: isOpen ? "var(--lp-orange)" : "var(--lp-text-secondary)",
                                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 160ms ease",
                              }}
                            >
                              <ChevronDownIcon className="h-4 w-4" />
                            </span>
                          </button>
                        </h2>

                        {isOpen && (
                          <div id={panelId} role="region" aria-labelledby={btnId} className="lp-faq-body">
                            <p style={{ margin: "0 0 0.85rem" }}>{item.answer}</p>

                            {item.bulletPoints && (
                              <ul
                                style={{
                                  margin: "0 0 0.85rem",
                                  paddingLeft: "1.2rem",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.35rem",
                                  fontSize: "0.875rem",
                                }}
                              >
                                {item.bulletPoints.map((pt) => (
                                  <li key={pt}>{pt}</li>
                                ))}
                              </ul>
                            )}

                            {item.calloutNote && (
                              <div
                                style={{
                                  padding: "0.75rem 1rem",
                                  borderRadius: "0.375rem",
                                  background: "var(--lp-green-bg)",
                                  color: "var(--lp-green-text)",
                                  fontSize: "0.8125rem",
                                  fontWeight: 600,
                                }}
                              >
                                {item.calloutNote}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <aside aria-label="Institutional Context and Emergency Reporting" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* National Coordination Taskforce Card */}
              <div className="lp-card" style={{ overflow: "hidden" }}>
                <div style={{ position: "relative", height: "11.5rem", width: "100%" }}>
                  <Image
                    src="/landing/lp/hero-coordination.jpg"
                    alt="Engineers reviewing digital utility blueprints at an active road corridor"
                    fill
                    sizes="(max-width: 1024px) 100vw, 380px"
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
                    FIELD AUDITS
                  </span>
                </div>
                <div style={{ padding: "1.35rem" }}>
                  <h3 className="lp-serif" style={{ fontSize: "1.2rem", color: "var(--lp-text)", margin: "0 0 0.5rem" }}>
                    National Coordination Taskforce
                  </h3>
                  <p style={{ fontSize: "0.84375rem", lineHeight: 1.55, color: "var(--lp-text-secondary)", margin: "0 0 1rem" }}>
                    Conceptual benchmark metrics modeled across synchronized highway and utility corridors.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.5rem 0.65rem",
                        background: "var(--lp-surface-low)",
                        borderRadius: "0.25rem",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <span style={{ color: "var(--lp-text-secondary)" }}>Registered Agencies</span>
                      <strong className="lp-mono" style={{ color: "var(--lp-text)" }}>
                        48 Bodies
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.5rem 0.65rem",
                        background: "var(--lp-surface-low)",
                        borderRadius: "0.25rem",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <span style={{ color: "var(--lp-text-secondary)" }}>Synchronized Corridors</span>
                      <strong className="lp-mono" style={{ color: "var(--lp-text)" }}>
                        1,412 km
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.5rem 0.65rem",
                        background: "var(--lp-green-bg)",
                        borderRadius: "0.25rem",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <span style={{ color: "var(--lp-green-text)", fontWeight: 600 }}>Direct Fiscal Savings</span>
                      <strong className="lp-mono" style={{ color: "var(--lp-green-text)" }}>
                        LKR 4.8 Billion
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Official Language Support Card */}
              <div className="lp-card" style={{ padding: "1.35rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <GlobeIcon className="h-4 w-4 text-[#FF5B00]" aria-hidden="true" />
                  <h3 className="lp-serif" style={{ fontSize: "1.125rem", color: "var(--lp-text)", margin: 0 }}>
                    Official Language Support
                  </h3>
                </div>
                <p style={{ fontSize: "0.84375rem", lineHeight: 1.55, color: "var(--lp-text-secondary)", margin: "0 0 1rem" }}>
                  Public guidance is maintained in English, Sinhala (සිංහල), and Tamil (தமிழ்) in accordance with
                  national civic portal standards.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <Link href="/faq" className="lp-chip lp-chip-neutral lp-focus" style={{ textDecoration: "none" }}>
                    English
                  </Link>
                  <Link href="/si/faq" className="lp-chip lp-chip-neutral lp-focus" style={{ textDecoration: "none" }}>
                    සිංහල
                  </Link>
                  <Link href="/ta/faq" className="lp-chip lp-chip-neutral lp-focus" style={{ textDecoration: "none" }}>
                    தமிழ்
                  </Link>
                </div>
              </div>

              {/* Emergency Excavation Hazard Callout */}
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
                    Unsafe Excavation Hazard?
                  </span>
                </div>
                <p style={{ fontSize: "0.84375rem", lineHeight: 1.55, color: "var(--lp-text-secondary)", margin: "0 0 0.85rem" }}>
                  Report unbarricaded trenches, ruptured water mains, or exposed high-voltage cables immediately to the
                  24/7 Emergency Tri-Agency Desk:
                </p>
                <div
                  className="lp-mono"
                  style={{
                    padding: "0.65rem 0.85rem",
                    borderRadius: "0.375rem",
                    background: "var(--lp-maroon-bg)",
                    color: "var(--lp-maroon)",
                    fontSize: "1rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>HOTLINE: 1910</span>
                  <span style={{ fontSize: "0.75rem" }}>GIC: 1919</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Bottom Civic Liaison Callout */}
      <section className="lp-subpage-section" style={{ background: "var(--lp-surface-low)" }} aria-labelledby="faq-liaison-heading">
        <div className="lp-container">
          <div className="lp-card" style={{ padding: "2rem" }}>
            <div className="lp-split-7-5" style={{ alignItems: "center" }}>
              <div>
                <div className="lp-eyebrow" style={{ marginBottom: "0.35rem" }}>
                  Civic Liaison Directorate
                </div>
                <h2
                  id="faq-liaison-heading"
                  className="lp-serif"
                  style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)", color: "var(--lp-text)", margin: "0 0 0.5rem" }}
                >
                  Need Additional Clarification?
                </h2>
                <p style={{ fontSize: "0.9375rem", lineHeight: 1.6, color: "var(--lp-text-secondary)", margin: "0 0 0.75rem" }}>
                  Submit a formal public or inter-agency inquiry to the National Infrastructure Coordination Helpdesk.
                </p>
                <div
                  className="lp-mono"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1rem",
                    fontSize: "0.75rem",
                    color: "var(--lp-text-muted)",
                  }}
                >
                  <span>Location: Maganeguma Mahamedura, Battaramulla</span>
                  <span>•</span>
                  <span>Hours: Mon - Fri: 08:30 - 16:15 IST</span>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                <Link href={links.contact} className="lp-btn lp-btn-primary lp-focus">
                  <span>Submit Official Clarification</span>
                  <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href={links.signIn} className="lp-btn lp-btn-secondary lp-focus">
                  <LockIcon className="h-4 w-4" aria-hidden="true" />
                  <span>{lpCopy.nav.signIn}</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </LpSubpageShell>
  );
}

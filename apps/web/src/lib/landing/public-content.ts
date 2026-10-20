/** Step 25 marketing copy — keep truthful; see docs/marketing/content-claims.md */

export const PUBLIC_HERO = {
  eyebrow: "National Infrastructure Intelligence & Coordination",
  title:
    "One shared view of infrastructure. Better coordination before construction.",
  lead:
    "INFRAOS connects infrastructure plans, location, and timelines so teams can spot overlapping works early and coordinate with greater clarity.",
  modules:
    "ProjectTrace supports delivery and progress accountability. RoadSync is designed to surface explainable geographic and schedule overlaps for agency review—not autonomous approvals.",
  prototypeNote:
    "University prototype · Demonstration workflows use synthetic data",
  ctaPrimaryLabel: "Explore how INFRAOS works",
  illustrationCaption: "Illustrative scenario · not live map data or detected conflicts",
} as const;

export const PUBLIC_PROBLEM = {
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
      badge: { label: "Schedule overlap", variant: "critical" as const },
    },
    {
      id: "schedule-blind-spots",
      title: "Schedule blind spots",
      body:
        "Teams working the same corridor may not see each other's planned work windows when timelines live in different systems or spreadsheets.",
      badge: { label: "Pending coordination", variant: "warning" as const },
    },
    {
      id: "fragmented-progress",
      title: "Fragmented project progress",
      body:
        "Milestones, spending, and delivery status can be tracked in disconnected views, making accountability harder for officers and citizens.",
      badge: { label: "Informational", variant: "info" as const },
    },
    {
      id: "continuity-gap",
      title: "Verification and continuity",
      body:
        "Inspection evidence and later asset maintenance are part of a full lifecycle, but they are difficult to trace when records stay siloed.",
      badge: { label: "Lifecycle gap", variant: "neutral" as const },
    },
  ],
} as const;

export const PUBLIC_SOLUTION = {
  eyebrow: "A shared infrastructure view",
  title: "Plan together. Coordinate earlier. Build with fewer surprises.",
  intro:
    "INFRAOS brings project schedules, locations, and responsibilities into one coordinated workflow. RoadSync can identify planned-work overlaps using geography and dates, while ProjectTrace organizes delivery and progress.",
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
  modulesNote:
    "InfraMap is intended to add map-based visibility in later product steps. Inspection, risk, and asset modules extend the lifecycle after coordination—without replacing agency decisions.",
  illustrationCaption: "Illustrative scenario · not live detected conflicts or government data",
} as const;

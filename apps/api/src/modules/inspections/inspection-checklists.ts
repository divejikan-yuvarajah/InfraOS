import type { InspectionType } from "./inspection.constants.js";

/** Code-owned, versioned checklist templates. Keys are stable; text lives in the web message dictionaries (en/si/ta). No regulatory clause numbers. */
export type ChecklistItem = { key: string; group: "general" | "quality" | "safety" | "handover"; mandatory: boolean };

const item = (key: string, group: ChecklistItem["group"], mandatory = true): ChecklistItem => ({ key, group, mandatory });

const PROGRESS: ChecklistItem[] = [
  item("work_matches_plan", "general"), item("quantities_measured", "general"), item("milestone_status_confirmed", "general"),
  item("materials_on_site", "general", false), item("site_access_ok", "safety", false),
];
const QUALITY: ChecklistItem[] = [
  item("surface_finish", "quality"), item("thickness_recorded", "quality"), item("materials_compliant", "quality"),
  item("drainage_functional", "quality"), item("defects_recorded", "quality"),
];
const SAFETY: ChecklistItem[] = [
  item("signage_present", "safety"), item("barriers_traffic_management", "safety"), item("ppe_used", "safety"),
  item("site_hygiene", "safety"), item("incident_log_available", "safety", false),
];
const HANDOVER: ChecklistItem[] = [
  item("works_complete", "handover"), item("defects_liability_noted", "handover"), item("as_built_documents_sighted", "handover"),
  item("site_cleared", "handover"), item("work_matches_plan", "general"),
];

export const CHECKLIST_TEMPLATES: Record<InspectionType, ChecklistItem[]> = {
  PROGRESS_VERIFICATION: PROGRESS,
  QUALITY,
  SAFETY,
  MILESTONE: [...PROGRESS.slice(0, 3), item("milestone_evidence_sighted", "general")],
  FINAL_HANDOVER: HANDOVER,
  ASSET_CONDITION: [
    item("structural_integrity", "quality"), item("surface_wear", "quality"), item("drainage_water_ingress", "quality"),
    item("safety_features", "safety"), item("functionality", "general"),
  ],
  FOLLOW_UP: [item("previous_defects_rechecked", "quality"), item("rework_completed", "quality"), item("site_safe", "safety")],
};

export const checklistFor = (type: InspectionType): ChecklistItem[] => CHECKLIST_TEMPLATES[type];

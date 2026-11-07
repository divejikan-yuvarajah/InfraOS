/** Wire types for the contractor API (Steps 92-94). Money is always integer LKR cents. */

export const CONTRACTOR_STATUSES = ["ACTIVE", "SUSPENDED", "INACTIVE", "ARCHIVED"] as const;
export const CONTRACTOR_CATEGORIES = ["ROAD_CONSTRUCTION", "BRIDGE_STRUCTURAL", "WATER_SEWERAGE", "ELECTRICAL", "TELECOM", "DRAINAGE", "BUILDING", "GENERAL", "OTHER"] as const;
export const DOCUMENT_TYPES = ["REGISTRATION", "TAX", "CERTIFICATE", "CONTRACT", "OTHER"] as const;
export const RISK_BANDS = ["STRONG", "MIXED", "WEAK", "NOT_ENOUGH_EVIDENCE"] as const;
export const SORTS = ["name", "registeredAt", "activeProjects", "risk"] as const;
/** Mirror of SRI_LANKA_PROVINCES in @infraos/shared-types (the web build cannot import its runtime values); a test keeps the two identical. */
export const SRI_LANKA_PROVINCES = {
  Western: ["Colombo", "Gampaha", "Kalutara"], Central: ["Kandy", "Matale", "Nuwara Eliya"], Southern: ["Galle", "Matara", "Hambantota"],
  Northern: ["Jaffna", "Kilinochchi", "Mannar", "Vavuniya", "Mullaitivu"], Eastern: ["Batticaloa", "Ampara", "Trincomalee"], "North Western": ["Kurunegala", "Puttalam"],
  "North Central": ["Anuradhapura", "Polonnaruwa"], Uva: ["Badulla", "Monaragala"], Sabaragamuwa: ["Ratnapura", "Kegalle"],
} as const;
export const SRI_LANKA_DISTRICTS: readonly string[] = Object.values(SRI_LANKA_PROVINCES).flat();
export const CERT_EXPIRY = ["30", "60", "90", "expired"] as const;

export type ContractorStatus = (typeof CONTRACTOR_STATUSES)[number];
export type ContractorCategory = (typeof CONTRACTOR_CATEGORIES)[number];
export type RiskBand = (typeof RISK_BANDS)[number];
export type SortKey = (typeof SORTS)[number];
export type EvidenceLevel = "NONE" | "LOW" | "MODERATE" | "GOOD";
export type Severity = "LOW" | "MEDIUM" | "HIGH";

export type CertCounts = { valid: number; expiring: number; expired: number; revoked: number; total: number };

export type DirectoryRow = {
  id: string; name: string; registrationNumber: string; status: ContractorStatus; category: ContractorCategory | null;
  specializations: string[]; operatingDistricts: string[]; registeredByAgencyId: string | null; agencyName: string | null;
  certifications: CertCounts; registeredAt: string | null; activeProjects: number; canManage: boolean;
  reliabilityBand?: RiskBand | null; evidenceLevel?: EvidenceLevel | null;
};

export type Facet = { value: string; count: number };
export type ContractorList = { rows: DirectoryRow[]; total: number; page: number; limit: number; facets: { status: Facet[]; category: Facet[] }; scope: "platform" | "agencies" | "none" };

export type ContractorSummary = {
  total: number; byStatus: Facet[]; byCategory: Facet[]; certifications: { expiring30d: number; expired: number }; withoutEvidence: number; scope: string;
  performance?: { available: boolean; bands?: Record<string, number>; attentionCount?: number; attention?: { id: string; name: string; highFlags: number; flags: string[] }[]; evaluated?: number; total?: number; truncated?: boolean };
};

export type CertificationItem = { id: string; name: string; issuer: string | null; referenceNumber: string | null; issuedOn: string | null; expiresOn: string | null; status: "VALID" | "EXPIRING" | "EXPIRED" | "REVOKED"; revokedReason: string | null };
export type DocumentRefItem = { id: string; type: string; title: string; referenceNumber: string | null; documentId: string | null; documentTitle?: string | null; notes: string | null };

export type ContractorProfile = DirectoryRow & {
  tier: "directory" | "manage"; restricted: boolean; totalAssignments: number; gaps?: string[]; updatedAt?: string | null;
  contact?: { contactPersonName: string | null; email: string | null; phone: string | null; address: string | null };
  business?: { legalName: string | null; taxId: string | null; registrationAuthority: string | null; cidaGrade: string | null; registeredOn: string | null };
  certificationList?: CertificationItem[]; documentRefs?: DocumentRefItem[];
  statusReason?: string | null; statusChangedAt?: string | null; archivedAt?: string | null;
  can: { manage: boolean; performance: boolean; viewValues: boolean; assign: boolean; platform: boolean };
};

export type DuplicateMatch = DirectoryRow & { reasons: string[] };
export type DuplicateResult = { exact: DuplicateMatch[]; possible: DuplicateMatch[]; existsOutsideScope: boolean };

export type Assignment = {
  id: string; role: "PRIMARY" | "ADDITIONAL"; status: "ACTIVE" | "ENDED" | "REPLACED" | "TERMINATED"; startDate: string | null; endDate: string | null; endReason: string | null;
  contractReference: string | null; contractValue?: { amountMinor: number; currency: string } | null;
  contractor: { id: string; name: string; registrationNumber: string; status: string; category: string | null } | null;
  project: { id: string; code: string; title: string; status: string; agencyId: string; agencyName: string | null; plannedEndDate: string | null; actualEndDate: string | null; startDate: string | null; locationText: string | null };
  delayDays: number | null; inspectionOutcome: string | null; inspectionCount: number;
  successor: { assignmentId: string; contractorId: string; name: string | null } | null;
};
export type AssignmentList = { rows: Assignment[]; total: number; page: number; limit: number; counts: { active: number; ended: number }; basedOn: string; valuesVisible: boolean };
export type ProjectContractors = { rows: Assignment[]; can: { assign: boolean; manage: boolean }; projectStatus: string; valuesVisible: boolean };

export type TimelineEvent = { key: string; type: string; at: string; params: Record<string, string | number | null>; projectId?: string; actor?: string | null };
export type Timeline = { events: TimelineEvent[]; nextCursor: string | null; truncated: boolean; basedOn: string };

export type EvidenceRef = { kind: "project" | "milestone" | "inspection" | "assignment" | "certification" | "profile"; id: string; label: string; projectId?: string };
export type Indicator = {
  key: string; value: number | null; unit: "percent" | "count" | "days"; sampleSize: number; minSample: number; status: "OK" | "INSUFFICIENT_EVIDENCE";
  formulaKey: string; inputs: Record<string, unknown>; evidence: EvidenceRef[];
};
export type RiskFlag = { code: string; severity: Severity; reason: string; params: Record<string, string | number>; evidence: EvidenceRef[]; since: string | null };
export type Performance = {
  contractorId: string; generatedAt: string; ruleVersion: string; indicators: Indicator[]; evidenceLevel: EvidenceLevel; band: RiskBand; bandBasis: { key: string; value: number }[]; flags: RiskFlag[];
  sample: { projects: number; milestones: number; assignments: number; inspections: number; truncated: boolean };
  series: { delay: { projectCode: string; at: string; delayDays: number }[] }; deferred: { key: string; availableAfter: string }[];
};

/** Server-reported failure shapes the UI reacts to (409 details). */
export type ImpactRow = { assignmentId: string; projectId: string; projectCode: string; projectTitle: string; role: string };

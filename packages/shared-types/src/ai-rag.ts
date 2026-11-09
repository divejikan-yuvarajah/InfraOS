/** Phase 10 Batch 10 — RAG Q&A, summaries and structured extraction. Enums and registries shared by API and web; no behaviour. */

export const AI_LANGUAGES = ["en", "si", "ta"] as const;
export type AiLanguage = (typeof AI_LANGUAGES)[number];

export const AI_QA_STATUSES = ["ANSWERED", "PARTIAL", "INSUFFICIENT_EVIDENCE", "PASSAGES_ONLY", "FAILED", "BLOCKED_BY_POLICY"] as const;
export type AiQaStatus = (typeof AI_QA_STATUSES)[number];
/** What the model itself may claim (grounding verification can only downgrade it). */
export const AI_MODEL_STATUSES = ["ANSWERED", "PARTIAL", "INSUFFICIENT_EVIDENCE"] as const;

export const AI_EVIDENCE_LEVELS = ["VERIFIED", "PARTIAL", "NONE"] as const;
export type AiEvidenceLevel = (typeof AI_EVIDENCE_LEVELS)[number];

export const AI_SCOPE_MODES = ["DOCUMENT", "DOCUMENTS", "PROJECT", "ALL"] as const;
export type AiScopeMode = (typeof AI_SCOPE_MODES)[number];
export const AI_SCOPE_MAX_DOCUMENTS = 20;
export const AI_ALL_SCOPE_LIMIT = 500;

export const AI_SOURCE_STATUSES = ["CURRENT", "UPDATED", "ARCHIVED", "NO_LONGER_ACCESSIBLE"] as const;
export type AiSourceStatus = (typeof AI_SOURCE_STATUSES)[number];

export const AI_FEEDBACK_RATINGS = ["HELPFUL", "NOT_HELPFUL"] as const;
export const AI_FEEDBACK_REASONS = ["WRONG", "MISSING_SOURCE", "OUTDATED", "UNCLEAR", "OTHER"] as const;

export const AI_RAG_ERROR_CODES = [
  "AI_UNAVAILABLE", "AI_TIMEOUT", "AI_BUDGET_EXCEEDED", "AI_RATE_LIMITED", "AI_INVALID_OUTPUT", "AI_TOO_LARGE", "SCOPE_EMPTY", "FORBIDDEN_SCOPE", "NOT_AI_READY",
  "LLM_UNAVAILABLE", "LLM_TIMEOUT", "LLM_RATE_LIMITED", "LLM_CONTEXT_TOO_LONG", "LLM_INVALID_OUTPUT",
] as const;
export type AiRagErrorCode = (typeof AI_RAG_ERROR_CODES)[number];

export const AI_ARTIFACT_KINDS = ["SUMMARY", "EXTRACTION"] as const;
export type AiArtifactKind = (typeof AI_ARTIFACT_KINDS)[number];
export const AI_ARTIFACT_STATUSES = ["QUEUED", "RUNNING", "READY", "FAILED", "STALE"] as const;
export type AiArtifactStatus = (typeof AI_ARTIFACT_STATUSES)[number];
export const AI_ARTIFACT_ACTIVE_STATUSES = ["QUEUED", "RUNNING", "READY"] as const;
export const AI_ARTIFACT_PHASES = ["MAP", "REDUCE", "EXTRACT"] as const;
export const AI_USAGE_PURPOSES = ["QA", "SUMMARY_MAP", "SUMMARY_REDUCE", "EXTRACTION"] as const;
export type AiUsagePurpose = (typeof AI_USAGE_PURPOSES)[number];

export const AI_ARTIFACT_WARNINGS = ["TRUNCATED", "REDACTED", "FLAGGED_CONTENT_EXCLUDED", "UNVERIFIED_FIGURES", "UNSUPPORTED_REMOVED"] as const;
export type AiArtifactWarning = (typeof AI_ARTIFACT_WARNINGS)[number];

export const AI_RAG_AUDIT_ACTIONS = [
  "ai.question_asked", "ai.summary_requested", "ai.summary_completed", "ai.extraction_requested", "ai.extraction_reviewed", "ai.extraction_applied_to_metadata", "ai.feedback_submitted", "ai.interaction_deleted",
] as const;

/** Prompt versions (mirrored in apps/ai-service/app/llm/prompts.py). Bump when prompt text changes. */
export const AI_PROMPT_VERSIONS = { qa: "qa.v2", summaryMap: "sum-map.v2", summaryReduce: "sum-reduce.v2", extract: "extract.v2" } as const;

// ---------------------------------------------------------------- summary templates

export const SUMMARY_TEMPLATE_KEYS = ["EXECUTIVE", "KEY_POINTS", "CONTRACT", "INSPECTION", "PROJECT_REPORT", "KEY_DATES"] as const;
export type SummaryTemplateKey = (typeof SUMMARY_TEMPLATE_KEYS)[number];
export type SummaryTemplate = {
  key: SummaryTemplateKey;
  /** Section keys in output order. `kind` says how each is rendered: a paragraph, bullets, or dated items. */
  sections: readonly { key: string; kind: "text" | "bullets" | "dates" }[];
  categories: readonly string[];
  maxOutputTokens: number;
  useStrongModel?: boolean;
};
export const SUMMARY_TEMPLATES: readonly SummaryTemplate[] = [
  { key: "EXECUTIVE", sections: [{ key: "overview", kind: "text" }, { key: "highlights", kind: "bullets" }], categories: ["PROJECT_PROPOSAL", "PROJECT_PLAN", "GOVERNMENT_CORRESPONDENCE", "APPROVAL_DOCUMENT", "OTHER"], maxOutputTokens: 700 },
  { key: "KEY_POINTS", sections: [{ key: "points", kind: "bullets" }], categories: ["PROJECT_PROPOSAL", "PROJECT_PLAN", "TENDER", "BOQ", "BUDGET_DOCUMENT", "OTHER"], maxOutputTokens: 700 },
  {
    key: "CONTRACT",
    sections: [
      { key: "parties", kind: "bullets" }, { key: "scope", kind: "text" }, { key: "value", kind: "bullets" }, { key: "dates", kind: "dates" }, { key: "period", kind: "bullets" }, { key: "obligations", kind: "bullets" },
      { key: "payment", kind: "bullets" }, { key: "retention", kind: "bullets" }, { key: "penalties", kind: "bullets" }, { key: "termination", kind: "bullets" }, { key: "risks", kind: "bullets" },
    ],
    categories: ["CONTRACT", "TENDER", "APPROVAL_DOCUMENT"], maxOutputTokens: 1800, useStrongModel: true,
  },
  { key: "INSPECTION", sections: [{ key: "scope", kind: "text" }, { key: "findings", kind: "bullets" }, { key: "deficiencies", kind: "bullets" }, { key: "actions", kind: "bullets" }, { key: "followups", kind: "bullets" }], categories: ["INSPECTION_REPORT", "SITE_EVIDENCE", "MAINTENANCE_DOCUMENT"], maxOutputTokens: 1400 },
  { key: "PROJECT_REPORT", sections: [{ key: "progress", kind: "text" }, { key: "milestones", kind: "bullets" }, { key: "issues", kind: "bullets" }, { key: "nextSteps", kind: "bullets" }], categories: ["PROGRESS_REPORT", "COMPLETION_REPORT", "ASSET_HANDOVER_RECORD"], maxOutputTokens: 1200 },
  { key: "KEY_DATES", sections: [{ key: "dates", kind: "dates" }], categories: ["CONTRACT", "PROGRESS_REPORT", "APPROVAL_DOCUMENT", "OTHER"], maxOutputTokens: 900 },
];
export const summaryTemplate = (key: string): SummaryTemplate | undefined => SUMMARY_TEMPLATES.find((t) => t.key === key);
export const suggestedSummaryTemplates = (category: string): SummaryTemplateKey[] => SUMMARY_TEMPLATES.filter((t) => t.categories.includes(category)).map((t) => t.key);

// ---------------------------------------------------------------- extraction templates

export const EXTRACTION_FIELD_TYPES = ["STRING", "DATE", "MONEY", "PERCENT", "DURATION", "LIST", "ENUM"] as const;
export type ExtractionFieldType = (typeof EXTRACTION_FIELD_TYPES)[number];
export type ExtractionField = { key: string; type: ExtractionFieldType; repeats?: boolean; query: string; metadata?: "reference" | "documentDate" | "expiresAt" | "title" | "tags" };
export type ExtractionTemplate = { key: string; fields: readonly ExtractionField[]; categories: readonly string[]; useStrongModel?: boolean };
export const EXTRACTION_TEMPLATE_KEYS = ["PROJECT_BASICS", "CONTRACT_KEY_TERMS", "FINANCIAL_FIGURES", "MILESTONES", "OBLIGATIONS", "APPROVAL_DETAILS", "INSPECTION_FINDINGS", "RISKS_ISSUES"] as const;
export type ExtractionTemplateKey = (typeof EXTRACTION_TEMPLATE_KEYS)[number];
export const EXTRACTION_TEMPLATES: readonly ExtractionTemplate[] = [
  { key: "PROJECT_BASICS", categories: ["PROJECT_PROPOSAL", "PROJECT_PLAN", "APPROVAL_DOCUMENT"], fields: [
    { key: "project_name", type: "STRING", query: "project name title of the project", metadata: "title" }, { key: "locations", type: "STRING", repeats: true, query: "project location district road site" }, { key: "implementing_agency", type: "STRING", query: "implementing agency employer ministry department" } ] },
  { key: "CONTRACT_KEY_TERMS", categories: ["CONTRACT", "TENDER"], useStrongModel: true, fields: [
    { key: "contractor_name", type: "STRING", query: "contractor name parties agreement between" }, { key: "contract_number", type: "STRING", query: "contract number reference agreement no", metadata: "reference" },
    { key: "contract_value", type: "MONEY", query: "contract price contract sum value LKR Rs amount" }, { key: "contract_date", type: "DATE", query: "contract date dated agreement signed", metadata: "documentDate" },
    { key: "commencement_date", type: "DATE", query: "commencement date start of works" }, { key: "completion_date", type: "DATE", query: "completion date time for completion period of works", metadata: "expiresAt" },
    { key: "defects_liability_period", type: "DURATION", query: "defects liability period" }, { key: "retention_percent", type: "PERCENT", query: "retention percentage retention money" },
    { key: "performance_security", type: "STRING", query: "performance security bond guarantee" }, { key: "liquidated_damages", type: "STRING", query: "liquidated damages delay per day" }, { key: "payment_terms", type: "STRING", query: "payment terms invoice certified within days" } ] },
  { key: "FINANCIAL_FIGURES", categories: ["BUDGET_DOCUMENT", "PAYMENT_EVIDENCE", "BOQ", "CONTRACT"], fields: [{ key: "amounts", type: "MONEY", repeats: true, query: "amount LKR Rs total cost budget payment" }] },
  { key: "MILESTONES", categories: ["PROJECT_PLAN", "PROGRESS_REPORT", "CONTRACT"], fields: [{ key: "milestones", type: "STRING", repeats: true, query: "milestone deliverable planned date stage" }] },
  { key: "OBLIGATIONS", categories: ["CONTRACT", "APPROVAL_DOCUMENT", "GOVERNMENT_CORRESPONDENCE"], fields: [{ key: "obligations", type: "STRING", repeats: true, query: "shall obligation responsible party must deadline" }] },
  { key: "APPROVAL_DETAILS", categories: ["APPROVAL_DOCUMENT", "GOVERNMENT_CORRESPONDENCE"], fields: [
    { key: "approving_authority", type: "STRING", query: "approved by authority secretary minister" }, { key: "reference_number", type: "STRING", query: "reference number our ref file no", metadata: "reference" },
    { key: "approval_date", type: "DATE", query: "date of approval dated", metadata: "documentDate" }, { key: "conditions", type: "STRING", repeats: true, query: "conditions subject to approval" } ] },
  { key: "INSPECTION_FINDINGS", categories: ["INSPECTION_REPORT", "SITE_EVIDENCE"], fields: [{ key: "findings", type: "STRING", repeats: true, query: "finding deficiency defect observed severity location recommended action" }] },
  { key: "RISKS_ISSUES", categories: ["PROGRESS_REPORT", "PROJECT_PLAN", "INSPECTION_REPORT"], fields: [{ key: "risks", type: "STRING", repeats: true, query: "risk issue delay problem constraint" }] },
];
export const extractionTemplate = (key: string): ExtractionTemplate | undefined => EXTRACTION_TEMPLATES.find((t) => t.key === key);
export const suggestedExtractionTemplates = (category: string): string[] => EXTRACTION_TEMPLATES.filter((t) => t.categories.includes(category)).map((t) => t.key);

export const EXTRACTION_DECISIONS = ["PENDING", "ACCEPTED", "EDITED", "REJECTED"] as const;
export type ExtractionDecision = (typeof EXTRACTION_DECISIONS)[number];
export const EXTRACTION_FIELD_STATUSES = ["FOUND", "NOT_FOUND", "AMBIGUOUS"] as const;
export const EVIDENCE_STRENGTHS = ["STRONG", "WEAK", "NONE"] as const;
export type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number];
export const DIFF_STATES = ["MATCH", "DIFFERS", "NO_RECORD", "NOT_COMPARABLE"] as const;
export type DiffState = (typeof DIFF_STATES)[number];

// ---------------------------------------------------------------- suggested questions (static, no AI cost; text lives in web i18n by key)

export const SUGGESTED_QUESTION_KEYS: Record<string, readonly string[]> = {
  CONTRACT: ["contractValue", "completionDate", "liquidatedDamages", "paymentTerms", "retention"],
  TENDER: ["contractValue", "completionDate", "paymentTerms"],
  INSPECTION_REPORT: ["findings", "severeDeficiencies", "recommendedActions"],
  PROGRESS_REPORT: ["progressSummary", "delays", "nextSteps"],
  APPROVAL_DOCUMENT: ["approvedBy", "conditions", "approvalDate"],
  BUDGET_DOCUMENT: ["totalBudget", "keyFigures"],
  DEFAULT: ["summary", "keyDates", "obligations"],
};
export const suggestedQuestionKeys = (categories: readonly string[]): string[] => {
  const out = new Set<string>();
  for (const c of categories) for (const k of SUGGESTED_QUESTION_KEYS[c] ?? []) out.add(k);
  if (!out.size) for (const k of SUGGESTED_QUESTION_KEYS.DEFAULT!) out.add(k);
  return [...out].slice(0, 6);
};

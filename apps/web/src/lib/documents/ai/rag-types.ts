import type { AiEvidenceLevel, AiLanguage, AiQaStatus, AiScopeMode, AiSourceStatus, DiffState, EvidenceStrength } from "@infraos/shared-types";

export type Scope = { mode: AiScopeMode; documentIds?: string[]; projectId?: string };
export type Citation = {
  n: number; chunkId: string; documentId: string; versionNo: number; sourceStatus: AiSourceStatus; docNo: string | null; title: string | null; category: string | null;
  pageStart: number | null; pageEnd: number | null; section: string | null; quote: string | null; quoteVerified: boolean; wasNeighbor: boolean; excerpt?: string | null;
};
export type Evidence = { level: AiEvidenceLevel; unverifiedFigures: string[]; droppedClaims: number; quotesVerified: number; quotesTotal: number };
export type Coverage = { documentsInScope: number; documentsSearched: number; documentsNotAiReady: number; truncatedScope: boolean };
export type Passage = { documentId: string; docNo: string | null; title: string; pageStart: number | null; pageEnd: number | null; section: string | null; excerpt: string; score?: number };
export type Interaction = {
  id: string; threadId: string; createdAt: string; question: string; language: AiLanguage; status: AiQaStatus; scope: { mode: AiScopeMode; documentIds: string[]; projectId: string | null };
  answer: { text: string; claims: { text: string; citationNs: number[]; supported: boolean }[]; missingInfo: string[] } | null; citations: Citation[]; evidence: Evidence | null; coverage: Coverage | null;
  retrieval: { candidates: number; used: number; flaggedSuspicious: number; droppedStale: number; redactions: number } | null; model: string | null; promptVersion: string | null;
  usage: { inputTokens: number; outputTokens: number; estimatedCostMinor: number | null }; latencyMs: number | null; errorCode: string | null; feedback: { rating: string; reason: string | null } | null;
  sourcesChanged: boolean; related?: Passage[];
};
export type Thread = { threadId: string; title: string; lastAt: string; count: number; mode: string };
export type ThreadList = { items: Thread[]; nextCursor: string | null };
export type NotReady = { id: string; title: string; docNo: string | null; reasonCode: string };
export type ScopePreview = Coverage & { notAiReady: NotReady[]; searchable: { id: string; title: string; docNo: string | null; category: string }[] };
export type ChunkContext = { documentId: string; docNo: string | null; title: string | null; category: string | null; versionNo: number; previewable: boolean; chunks: { chunkId: string; chunkIndex: number; isCited: boolean; pageStart: number | null; pageEnd: number | null; section: string | null; text: string }[] };

export type ArtifactStatus = "QUEUED" | "RUNNING" | "READY" | "FAILED" | "STALE";
export type ArtifactCitation = { n: number; chunkId: string; pageStart: number | null; pageEnd: number | null; section: string | null; quote: string | null; quoteVerified: boolean };
export type Artifact = {
  id: string; kind: "SUMMARY" | "EXTRACTION"; documentId: string; versionNo: number; template: string; language: AiLanguage; status: ArtifactStatus; stale: boolean; progress: { phase: string | null; done: number; total: number };
  result?: unknown; citations?: ArtifactCitation[]; evidence: Evidence | null; coverage: { pagesFrom?: number | null; pagesTo?: number | null; chunksUsed?: number; chunksTotal?: number; truncated?: boolean } | null;
  warnings: string[]; model: string | null; promptVersion: string | null; usage: { inputTokens: number; outputTokens: number }; errorCode: string | null; attempt: number; createdAt: string; updatedAt: string;
};
export type TemplateInfo = { key: string; suggested: boolean; sections?: { key: string; kind: "text" | "bullets" | "dates" }[]; fields?: { key: string; type: string; repeats: boolean; metadata: string | null }[] };
export type ArtifactList = { ready: boolean; reasonCode: string | null; currentVersionNo: number | null; templates: TemplateInfo[]; artifacts: Artifact[] };
export type SummaryResult = { sections: { key: string; kind: "text" | "bullets" | "dates"; items: { text: string; date: string | null; dateIso: string | null; citationNs: number[] }[] }[] };

export type ExtractValue = { rawText: string; typed: { type: string; text?: string; iso?: string; amountMinor?: number; currency?: string; value?: string | number; unit?: string } | null; strength: EvidenceStrength; citationNs: number[]; readings?: string[] };
export type ExtractField = { key: string; type: string; repeats: boolean; status: "FOUND" | "NOT_FOUND" | "AMBIGUOUS"; reason: string | null; values: ExtractValue[] };
export type FieldDiff = { state: DiffState; current: string | null; record: { type: "PROJECT" | "CONTRACTOR"; id: string } | null };
export type ExtractionDetail = Artifact & {
  result: { fields: ExtractField[] } | null; version: number; canReview: boolean; readiness: { ready: boolean; reasonCode: string | null };
  review: { status: string; decisions: Record<string, { decision: string; editedValue: string | null }>; decided: number; total: number };
  diffs: Record<string, FieldDiff>; metadataPreview: { fieldKey: string; metadataField: string; before: string | null; after: string }[]; recordLinks: { project: { type: string; id: string } | null; contractor: { type: string; id: string } | null };
};
export type Quality = {
  from: string; to: string; questions: number; rates: Record<string, number | null>; counts: Record<string, number>; fallbacks: number; feedback: { helpful: number; notHelpful: number; helpfulRatio: number | null };
  citationVerificationRate: number | null; averageLatencyMs: number | null; tokensByPurpose: { purpose: string; inputTokens: number; outputTokens: number; requests: number }[];
};

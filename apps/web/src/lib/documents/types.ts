export type DocStatus = "DRAFT" | "ACTIVE" | "SUPERSEDED" | "ARCHIVED";
export type Visibility = "INTERNAL" | "PROJECT_TEAM" | "PUBLIC";
export type Confidentiality = "STANDARD" | "SENSITIVE";
export type Segment = { text: string; match: boolean };

export type DocCaps = { canEdit: boolean; canReplace: boolean; canArchive: boolean; canRestore: boolean; canDelete: boolean; canRestrict: boolean; canDownload: boolean };

export type DocItem = {
  id: string; docNo: string | null; title: string; description: string | null; category: string; group: string; status: DocStatus; visibility: Visibility; confidentiality: Confidentiality;
  origin: "DOCTRACE" | "INSPECTION_EVIDENCE" | "SYSTEM"; projectId: string | null; project: { id: string; title: string; code: string | null } | null; agencyId: string | null; agencyName: string | null;
  ownerId: string; ownerName: string | null; fileName: string; mimeType: string | null; sizeBytes: number | null; contentHash: string | null; currentVersionNo: number | null; fileAvailable: boolean;
  tags: string[]; documentDate: string | null; reference: string | null; language: string | null; expiresAt: string | null; links: Record<string, string>;
  ai: { extractedTextStatus: string; allowed: boolean; eligibleType: boolean }; version: number; createdAt: string | null; updatedAt: string | null; archivedAt: string | null; permissions: DocCaps;
  highlights?: { title: Segment[]; description: Segment[]; reference: Segment[]; tags: Segment[][] } | null;
};
export type DocDetail = DocItem & {
  currentVersion: { versionNo: number; changeNote: string | null; activeContent: boolean; uploadedAt: string | null } | null;
  linkDetails: { type: string; id: string; label: string | null; accessible: boolean }[];
  access: { audience: string[]; publicMeansAnonymous: false };
};
export type Facet = { key: string; count: number };
export type DocList = {
  items: DocItem[]; meta: { total: number; page: number; limit: number; pages: number; searchMode: string; metadataSearchOnly: true };
  facets: { category: Facet[]; status: Facet[]; fileType: Facet[]; project: { id: string; label: string; count: number }[]; agency: { id: string; label: string; count: number }[] };
};
export type DocSummary = {
  totalActive: number; addedThisMonth: number; drafts: number; expiringIn30Days: number; sensitive: number; awaitingFiles: number;
  byCategory: Facet[]; uploadsPerMonth: { month: string; count: number }[]; storageByCategory: { key: string; bytes: number }[]; storageApproximate: true;
};
export type CategoryDef = { key: string; group: string; icon: string; requiresProject: boolean; defaultVisibility: Visibility; links: string[]; allowsImages: boolean; sensitiveByDefault: boolean };
export type CategoryList = { groups: string[]; categories: CategoryDef[] };
export type VersionRow = {
  versionNo: number; fileName: string; mimeType: string; sizeBytes: number; contentHash: string; changeNote: string | null; status: "CURRENT" | "SUPERSEDED" | "REMOVED"; current: boolean;
  uploadedBy: string | null; createdAt: string | null; restoredFromVersionNo: number | null; previewable: boolean; activeContent: boolean; removedAt: string | null;
};
export type VersionList = { versions: VersionRow[]; permissions: { canRestore: boolean; canRemove: boolean } };
export type ActivityRow = { id: string; action: string; actor: string | null; at: string | null; from: string | null; to: string | null; reason: string | null };
export type ActivityList = { items: ActivityRow[]; nextCursor: string | null };
export type ProjectDocs = { items: DocItem[]; total: number; byCategory: Facet[]; canUpload: boolean };
export type BulkResult = { results: { id: string; ok: boolean; code?: string }[]; succeeded: number; failed: number };
export type UploadTicket = { ticket: string; fileName: string; upload: { path: string; method: "PUT"; contentType: string; maxBytes: number }; versionNo?: number };
export type StreamResult = { ticket: string; sizeBytes: number; contentHash: string; activeContent: boolean; duplicate: { id: string; docNo: string | null; title: string } | null };
export type UploadInit = {
  fileName: string; mimeType: string; sizeBytes: number; category: string; title?: string; description?: string; tags: string[]; documentDate?: string; reference?: string; language?: string;
  visibility?: Visibility; confidentiality?: Confidentiality; status: "DRAFT" | "ACTIVE"; projectId?: string; links: Record<string, string | null>;
};
export type PickerProject = { id: string; label: string };

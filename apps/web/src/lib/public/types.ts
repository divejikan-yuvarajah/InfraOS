export type PublicSummary = {
  releasedProjects: number;
  completedProjects: number;
  activeProjects: number;
  totalIssuesReported: number;
  resolvedIssues: number;
};

export type PublicProject = {
  slug: string;
  projectCode: string;
  title: string;
  summary: string;
  category: string;
  status: string;
  agency: { code: string; name: string } | null;
  district: string | null;
  province: string | null;
  physicalProgress: number | null;
  budgetBand: string | null;
  currency: string | null;
  plannedEndDate: string | null;
  coordinates: { lat: number; lng: number } | null;
  publishedAt: string | null;
};

export type PublicProjectPage = {
  items: PublicProject[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PublicMapFeatureProject = {
  kind: "PROJECT";
  slug: string;
  title: string;
  category: string;
  status: string;
  district: string | null;
  agencyName: string | null;
  coordinates: [number, number];
};

export type PublicMapFeatureIssue = {
  kind: "ISSUE";
  referenceNo: string;
  category: string;
  status: string;
  district: string | null;
  coordinates: [number, number];
};

export type PublicMapFeaturesResponse = {
  projects: PublicMapFeatureProject[];
  issues: PublicMapFeatureIssue[];
};

export type PublicIssueSubmitResponse = {
  referenceNo: string;
  trackingSecret: string;
  status: string;
  routed: boolean;
  createdAt: string;
};

export type PublicIssueTrackResponse = {
  referenceNo: string;
  category: string;
  title: string | null;
  description: string;
  status: string;
  priority: string;
  district: string | null;
  province: string | null;
  assignedAgencyName: string | null;
  photoCount: number;
  statusHistory: Array<{ fromStatus: string | null; toStatus: string; changedAt: string }>;
  publicMessages: Array<{ authorLabel: string; body: string; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
};

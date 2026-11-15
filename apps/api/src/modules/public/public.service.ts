import crypto from "node:crypto";
import mongoose from "mongoose";

import { Agency } from "../agencies/models/agency.model.js";
import { nextNumber } from "../../shared/database/counter.js";
import { escapeSearchRegex } from "../../shared/http/list-query.js";
import { logger } from "../../shared/logger.js";
import { getIssueStorage } from "../inspections/evidence-storage.js";
import { Project } from "../projects/models/project.model.js";
import { isInsideSriLanka, type IssueCategory, type IssuePriority } from "../issues/issue.constants.js";
import { randomIssuePhotoKey, validateAndStripIssuePhoto } from "../issues/issue-photo.js";
import { CitizenIssue } from "../issues/models/citizen-issue.model.js";
import { IssueRoutingRule } from "../issues/models/issue-routing-rule.model.js";

const COARSEN_STEP = 0.005;

function coarsenCoord(val: number): number {
  return Math.round(val / COARSEN_STEP) * COARSEN_STEP;
}

export function hashTrackingSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex");
}

function budgetBandFor(amountMinor?: number | null): string {
  if (typeof amountMinor !== "number" || !Number.isFinite(amountMinor)) return "UNDISCLOSED";
  const major = amountMinor / 100;
  if (major < 10_000_000) return "UNDER_10M";
  if (major < 100_000_000) return "10M_TO_100M";
  if (major < 500_000_000) return "100M_TO_500M";
  return "OVER_500M";
}

function toPublicProjectDto(doc: Record<string, unknown>, agencyMap: Map<string, { code: string; name: string }>) {
  const release = (doc.publicRelease ?? {}) as Record<string, unknown>;
  const loc = (doc.location ?? {}) as Record<string, unknown>;
  const geom = doc.geometry as { type?: string; coordinates?: unknown } | undefined;
  const budget = doc.budget as { amountMinor?: number; currency?: string } | undefined;
  const agency = agencyMap.get(String(doc.agencyId ?? ""));

  let publicCoordinates: { lat: number; lng: number } | null = null;
  if (release.showCoordinates !== false && geom?.type === "Point" && Array.isArray(geom.coordinates) && geom.coordinates.length === 2) {
    const [lng, lat] = geom.coordinates as [number, number];
    if (typeof lat === "number" && typeof lng === "number") {
      publicCoordinates = { lat: coarsenCoord(lat), lng: coarsenCoord(lng) };
    }
  }

  // Strict allowlist DTO: NEVER include _id, finance details, risk/AI, documents, notes, or user IDs.
  return {
    slug: String(release.slug ?? String(doc.projectCode ?? "").toLowerCase()),
    projectCode: String(doc.projectCode ?? ""),
    title: String(release.safeTitle || doc.title || ""),
    summary: String(release.safeSummary || doc.description || "").slice(0, 600),
    category: String(doc.projectType ?? "OTHER"),
    status: String(doc.status ?? ""),
    agency: agency ? { code: agency.code, name: agency.name } : null,
    district: typeof loc.district === "string" ? loc.district : null,
    province: typeof loc.province === "string" ? loc.province : null,
    physicalProgress: release.showProgress !== false ? Number(doc.physicalProgress ?? 0) : null,
    budgetBand: release.showBudgetBand === true ? budgetBandFor(budget?.amountMinor) : null,
    currency: release.showBudgetBand === true ? String(budget?.currency ?? "LKR") : null,
    plannedEndDate: doc.plannedEndDate instanceof Date ? doc.plannedEndDate.toISOString().slice(0, 10) : null,
    coordinates: publicCoordinates,
    publishedAt: release.publishedAt instanceof Date ? release.publishedAt.toISOString() : null,
  };
}

async function loadAgencyLookup(): Promise<Map<string, { code: string; name: string }>> {
  const agencies = await Agency.find({ status: "ACTIVE" }).select("_id code name").lean();
  const map = new Map<string, { code: string; name: string }>();
  for (const a of agencies) {
    map.set(String(a._id), { code: String(a.code), name: String(a.name) });
  }
  return map;
}

export async function getPublicSummary() {
  const baseFilter = {
    "publicRelease.isPublic": true,
    status: { $nin: ["DRAFT", "CANCELLED"] },
  };
  const [releasedCount, completedCount, ongoingCount, publicIssuesCount, resolvedIssuesCount] = await Promise.all([
    Project.countDocuments(baseFilter),
    Project.countDocuments({ ...baseFilter, status: "COMPLETED" }),
    Project.countDocuments({ ...baseFilter, status: { $in: ["ACTIVE", "APPROVED"] } }),
    CitizenIssue.countDocuments({}),
    CitizenIssue.countDocuments({ status: { $in: ["RESOLVED", "CLOSED"] } }),
  ]);

  return {
    releasedProjects: releasedCount,
    completedProjects: completedCount,
    activeProjects: ongoingCount,
    totalIssuesReported: publicIssuesCount,
    resolvedIssues: resolvedIssuesCount,
  };
}

export async function listPublicProjects(params: {
  page: number;
  limit: number;
  q?: string;
  category?: string;
  status?: string;
  district?: string;
}) {
  const filter: Record<string, unknown> = {
    "publicRelease.isPublic": true,
    status: { $nin: ["DRAFT", "CANCELLED"] },
  };
  if (params.category) filter.projectType = params.category;
  if (params.status && params.status !== "DRAFT" && params.status !== "CANCELLED") {
    filter.status = params.status;
  }
  if (params.district) filter["location.district"] = params.district;
  if (params.q) {
    const rx = new RegExp(escapeSearchRegex(params.q), "i");
    filter.$or = [{ title: rx }, { "publicRelease.safeTitle": rx }, { projectCode: rx }, { "location.district": rx }];
  }

  const skip = (params.page - 1) * params.limit;
  const [docs, total, agencyMap] = await Promise.all([
    Project.find(filter)
      .select("projectCode title description projectType status agencyId location geometry physicalProgress budget plannedEndDate publicRelease")
      .sort({ "publicRelease.publishedAt": -1, createdAt: -1 })
      .skip(skip)
      .limit(params.limit)
      .lean(),
    Project.countDocuments(filter),
    loadAgencyLookup(),
  ]);

  return {
    items: docs.map((d) => toPublicProjectDto(d as unknown as Record<string, unknown>, agencyMap)),
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}

export async function getPublicProjectBySlug(slug: string) {
  const doc = await Project.findOne({
    "publicRelease.isPublic": true,
    "publicRelease.slug": slug,
    status: { $nin: ["DRAFT", "CANCELLED"] },
  })
    .select("projectCode title description projectType status agencyId location geometry physicalProgress budget plannedEndDate publicRelease")
    .lean();
  if (!doc) return null;
  const agencyMap = await loadAgencyLookup();
  return toPublicProjectDto(doc as unknown as Record<string, unknown>, agencyMap);
}

export async function getPublicMapFeatures(bboxRaw?: string) {
  let minLng = 79.45;
  let minLat = 5.85;
  let maxLng = 81.95;
  let maxLat = 9.90;

  if (bboxRaw) {
    const parts = bboxRaw.split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
    }
  }

  const [projects, issues, agencyMap] = await Promise.all([
    Project.find({
      "publicRelease.isPublic": true,
      "publicRelease.showCoordinates": { $ne: false },
      status: { $nin: ["DRAFT", "CANCELLED"] },
      geometry: { $exists: true },
    })
      .select("projectCode title projectType status agencyId location geometry physicalProgress publicRelease")
      .limit(200)
      .lean(),
    CitizenIssue.find({
      publicMapVisible: true,
      status: { $nin: ["REJECTED", "DUPLICATE"] },
      geometry: { $exists: true },
    })
      .select("referenceNo category status priority location geometry createdAt")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
    loadAgencyLookup(),
  ]);

  const projectFeatures = projects
    .map((p) => {
      const dto = toPublicProjectDto(p as unknown as Record<string, unknown>, agencyMap);
      if (!dto.coordinates) return null;
      const { lat, lng } = dto.coordinates;
      if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return null;
      return {
        kind: "PROJECT" as const,
        slug: dto.slug,
        title: dto.title,
        category: dto.category,
        status: dto.status,
        district: dto.district,
        agencyName: dto.agency?.name ?? null,
        coordinates: [lng, lat] as [number, number],
      };
    })
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  const issueFeatures = issues
    .map((iss) => {
      const geom = iss.geometry as { type?: string; coordinates?: unknown } | undefined;
      if (geom?.type !== "Point" || !Array.isArray(geom.coordinates) || geom.coordinates.length !== 2) return null;
      const [rawLng, rawLat] = geom.coordinates as [number, number];
      const lng = coarsenCoord(rawLng);
      const lat = coarsenCoord(rawLat);
      if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return null;
      return {
        kind: "ISSUE" as const,
        referenceNo: String(iss.referenceNo ?? "ISS"),
        category: String(iss.category),
        status: String(iss.status),
        district: iss.location?.district ?? null,
        coordinates: [lng, lat] as [number, number],
      };
    })
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  return {
    projects: projectFeatures,
    issues: issueFeatures,
  };
}

async function resolveAutoRoutingAgency(category: IssueCategory, district?: string, province?: string): Promise<mongoose.Types.ObjectId | undefined> {
  const rules = await IssueRoutingRule.find({ isActive: true, category })
    .sort({ priorityOrder: 1, createdAt: 1 })
    .lean();
  if (rules.length === 0) return undefined;
  const exactDistrict = district ? rules.find((r) => r.district && r.district.toLowerCase() === district.toLowerCase()) : undefined;
  if (exactDistrict) return exactDistrict.agencyId as mongoose.Types.ObjectId;
  const exactProvince = province ? rules.find((r) => !r.district && r.province && r.province.toLowerCase() === province.toLowerCase()) : undefined;
  if (exactProvince) return exactProvince.agencyId as mongoose.Types.ObjectId;
  const fallback = rules.find((r) => !r.district && !r.province);
  return fallback ? (fallback.agencyId as mongoose.Types.ObjectId) : undefined;
}

export async function createPublicIssue(input: {
  category: IssueCategory;
  title?: string;
  description: string;
  priority?: IssuePriority;
  location: {
    addressLine?: string;
    district: string;
    province: string;
    lat?: number;
    lng?: number;
  };
  contact?: { name?: string; phone?: string; email?: string };
  photos?: Array<{ base64: string; fileName?: string }>;
}) {
  if (typeof input.location.lat === "number" && typeof input.location.lng === "number") {
    if (!isInsideSriLanka(input.location.lat, input.location.lng)) {
      return { ok: false as const, code: "COORD_OUT_OF_BOUNDS" as const, message: "Coordinates must be inside Sri Lanka" };
    }
  }

  const issueId = new mongoose.Types.ObjectId();
  const uploadedPhotos: Array<{ storageKey: string; fileName: string; mimeType: string; sizeBytes: number; exifStripped: boolean }> = [];

  if (input.photos && input.photos.length > 0) {
    const storage = getIssueStorage();
    if (!storage) {
      return { ok: false as const, code: "STORAGE_UNAVAILABLE" as const, message: "Photo storage is not configured" };
    }
    for (const rawPhoto of input.photos) {
      const cleaned = validateAndStripIssuePhoto(rawPhoto);
      if (!cleaned) {
        return { ok: false as const, code: "INVALID_PHOTO" as const, message: "Invalid image format, corrupt metadata, or exceeds 5 MB limit" };
      }
      const key = randomIssuePhotoKey(String(issueId));
      await storage.put(key, cleaned.buffer, cleaned.mimeType);
      uploadedPhotos.push({
        storageKey: key,
        fileName: cleaned.fileName,
        mimeType: cleaned.mimeType,
        sizeBytes: cleaned.buffer.length,
        exifStripped: cleaned.exifStripped,
      });
    }
  }

  const referenceNo = await nextNumber("ISS");
  const rawSecret = crypto.randomBytes(9).toString("base64url");
  const trackingSecretHash = hashTrackingSecret(rawSecret);

  const routedAgencyId = await resolveAutoRoutingAgency(input.category, input.location.district, input.location.province);
  const initialStatus = routedAgencyId ? "ASSIGNED" : "SUBMITTED";

  const doc = await CitizenIssue.create({
    _id: issueId,
    referenceNo,
    trackingSecretHash,
    category: input.category,
    title: input.title,
    description: input.description,
    priority: input.priority ?? "NORMAL",
    location: {
      addressLine: input.location.addressLine,
      district: input.location.district,
      province: input.location.province,
    },
    ...(typeof input.location.lat === "number" && typeof input.location.lng === "number"
      ? { geometry: { type: "Point", coordinates: [input.location.lng, input.location.lat] } }
      : {}),
    photos: uploadedPhotos,
    contact: input.contact,
    assignedAgency: routedAgencyId,
    status: initialStatus,
    publicMapVisible: false,
    statusHistory: [
      {
        toStatus: "SUBMITTED",
        note: "Submitted via public portal",
        changedAt: new Date(),
      },
      ...(routedAgencyId
        ? [{ fromStatus: "SUBMITTED" as const, toStatus: "ASSIGNED" as const, note: "Auto-routed by rule", changedAt: new Date() }]
        : []),
    ],
    publicMessages: [
      {
        authorLabel: "InfraOS Intake",
        body: routedAgencyId
          ? `Report ${referenceNo} received and automatically routed to the responsible agency.`
          : `Report ${referenceNo} received and queued for agency triage.`,
        createdAt: new Date(),
      },
    ],
  });

  logger.info({ referenceNo, issueId: String(doc._id), routed: Boolean(routedAgencyId) }, "public citizen issue submitted");

  return {
    ok: true as const,
    referenceNo,
    trackingSecret: rawSecret,
    status: initialStatus,
    routed: Boolean(routedAgencyId),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date().toISOString(),
  };
}

export async function trackPublicIssue(referenceNo: string, trackingSecret: string) {
  const issue = await CitizenIssue.findOne({ referenceNo: referenceNo.trim().toUpperCase() })
    .select("+trackingSecretHash +photos")
    .lean();
  if (!issue || !issue.trackingSecretHash) return null;

  const incomingHash = hashTrackingSecret(trackingSecret.trim());
  const a = Buffer.from(issue.trackingSecretHash, "hex");
  const b = Buffer.from(incomingHash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  let agencyName: string | null = null;
  if (issue.assignedAgency) {
    const ag = await Agency.findById(issue.assignedAgency).select("name code").lean();
    if (ag) agencyName = `${ag.name} (${ag.code})`;
  }

  // Strictly allowlisted public tracking response (never internal notes, contact PII, or raw user IDs)
  return {
    referenceNo: issue.referenceNo ?? referenceNo,
    category: issue.category,
    title: issue.title ?? null,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    district: issue.location?.district ?? null,
    province: issue.location?.province ?? null,
    assignedAgencyName: agencyName,
    photoCount: Array.isArray(issue.photos) ? issue.photos.length : 0,
    statusHistory: (issue.statusHistory ?? []).map((h) => ({
      fromStatus: h.fromStatus ?? null,
      toStatus: h.toStatus,
      changedAt: h.changedAt instanceof Date ? h.changedAt.toISOString() : new Date().toISOString(),
    })),
    publicMessages: (issue.publicMessages ?? []).map((m) => ({
      authorLabel: m.authorLabel,
      body: m.body,
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date().toISOString(),
    })),
    createdAt: issue.createdAt instanceof Date ? issue.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: issue.updatedAt instanceof Date ? issue.updatedAt.toISOString() : new Date().toISOString(),
  };
}

export async function openPublicIssuePhoto(referenceNo: string, trackingSecret: string, index: number) {
  const issue = await CitizenIssue.findOne({ referenceNo: referenceNo.trim().toUpperCase() })
    .select("+trackingSecretHash +photos")
    .lean();
  if (!issue || !issue.trackingSecretHash) return null;
  const incomingHash = hashTrackingSecret(trackingSecret.trim());
  const a = Buffer.from(issue.trackingSecretHash, "hex");
  const b = Buffer.from(incomingHash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const photos = issue.photos ?? [];
  const target = photos[index];
  if (!target) return null;
  const storage = getIssueStorage();
  if (!storage) return null;
  return {
    mimeType: target.mimeType || "image/jpeg",
    stream: storage.open(target.storageKey),
  };
}

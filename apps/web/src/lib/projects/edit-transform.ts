import {
  coordinate,
  dateOnlyToUtc,
  DRAFT_LOCATION_LIMITS,
  optionalText,
  type CreateIssue,
} from "./create-transform";
import { geometrySummary, projectCoreQueryKey, utcDateLabel } from "./overview-format";
import type { ProjectDetail, ProjectLocation } from "./types";

export type ProjectEditFormValues = {
  title: string;
  description: string;
  startDate: string;
  plannedEndDate: string;
  province: string;
  district: string;
  locality: string;
  roadName: string;
  locationDescription: string;
  longitude: string;
  latitude: string;
  removeGeometry: boolean;
};

export type EditField = keyof ProjectEditFormValues;
export type EditIssue = CreateIssue;

export type ProjectPatchRequest = {
  revision: number;
  title?: string;
  description?: string | null;
  location?: ProjectLocation | null;
  geometry?: { type: "Point"; coordinates: [number, number] } | null;
  startDate?: string | null;
  plannedEndDate?: string | null;
};

export type EditBaseline = {
  revision: number;
  title: string;
  description: string | null;
  startDate: string | null;
  plannedEndDate: string | null;
  location: ProjectLocation | null;
  geometry: { type: string; coordinates: unknown } | null;
  geometryKind: "none" | "point" | "complex";
};

function locationFromDetail(location: ProjectLocation | null | undefined): Omit<ProjectEditFormValues, "title" | "description" | "startDate" | "plannedEndDate" | "removeGeometry"> {
  return {
    province: location?.province ?? "",
    district: location?.district ?? "",
    locality: location?.locality ?? "",
    roadName: location?.roadName ?? "",
    locationDescription: location?.description ?? "",
    longitude: "",
    latitude: "",
  };
}

export function utcToDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(value);
  return match?.[1] ?? "";
}

export function classifyGeometryKind(geometry: ProjectDetail["geometry"]): EditBaseline["geometryKind"] {
  if (!geometry || typeof geometry.type !== "string") return "none";
  if (geometry.type === "Point") return "point";
  return "complex";
}

export function editBaselineFromProject(project: ProjectDetail): EditBaseline {
  const geometryKind = classifyGeometryKind(project.geometry ?? null);
  const values = locationFromDetail(project.location ?? null);
  if (geometryKind === "point" && project.geometry?.type === "Point" && Array.isArray(project.geometry.coordinates)) {
    const [longitude, latitude] = project.geometry.coordinates;
    if (typeof longitude === "number" && typeof latitude === "number") {
      values.longitude = String(longitude);
      values.latitude = String(latitude);
    }
  }
  return {
    revision: project.revision,
    title: project.title,
    description: project.description ?? null,
    startDate: project.startDate ?? null,
    plannedEndDate: project.plannedEndDate ?? null,
    location: project.location ?? null,
    geometry: project.geometry ?? null,
    geometryKind,
  };
}

export function editFormValuesFromProject(project: ProjectDetail): ProjectEditFormValues {
  const baseline = editBaselineFromProject(project);
  const place = locationFromDetail(baseline.location);
  if (baseline.geometryKind === "point" && baseline.geometry?.type === "Point" && Array.isArray(baseline.geometry.coordinates)) {
    const [longitude, latitude] = baseline.geometry.coordinates;
    if (typeof longitude === "number" && typeof latitude === "number") {
      place.longitude = String(longitude);
      place.latitude = String(latitude);
    }
  }
  return {
    title: baseline.title,
    description: baseline.description ?? "",
    startDate: utcToDateInput(baseline.startDate),
    plannedEndDate: utcToDateInput(baseline.plannedEndDate),
    ...place,
    removeGeometry: false,
  };
}

function buildLocation(values: ProjectEditFormValues): { ok: true; value?: ProjectLocation | null } | { ok: false; errors: Partial<Record<EditField, EditIssue>> } {
  const errors: Partial<Record<EditField, EditIssue>> = {};
  const location: ProjectLocation = {};
  const locationFields = [
    ["province", values.province],
    ["district", values.district],
    ["locality", values.locality],
    ["roadName", values.roadName],
    ["locationDescription", values.locationDescription],
  ] as const;
  for (const [field, value] of locationFields) {
    const limit = DRAFT_LOCATION_LIMITS[field];
    const parsed = optionalText(value, limit);
    if (!parsed.ok) errors[field] = parsed.issue;
    else if (parsed.value) {
      if (field === "locationDescription") location.description = parsed.value;
      else location[field] = parsed.value;
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const hasKeys = Object.keys(location).length > 0;
  return { ok: true, value: hasKeys ? location : null };
}

export function buildProjectPatchBody(
  values: ProjectEditFormValues,
  baseline: EditBaseline,
): { ok: true; body: ProjectPatchRequest } | { ok: false; errors: Partial<Record<EditField, EditIssue>> } {
  const errors: Partial<Record<EditField, EditIssue>> = {};
  const title = optionalText(values.title, 200);
  if (!title.ok) errors.title = title.issue;
  else if (!title.value) errors.title = "required";

  const description = optionalText(values.description, 5000);
  if (!description.ok) errors.description = description.issue;

  const start = values.startDate.trim();
  const end = values.plannedEndDate.trim();
  const startIso = start ? dateOnlyToUtc(start) : undefined;
  const endIso = end ? dateOnlyToUtc(end) : undefined;
  if (start && !startIso) errors.startDate = "date";
  if (end && !endIso) errors.plannedEndDate = "date";
  const effectiveStart = startIso ?? baseline.startDate;
  const effectiveEnd = endIso ?? baseline.plannedEndDate;
  if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) errors.plannedEndDate = "order";

  const locationBuilt = buildLocation(values);
  if (!locationBuilt.ok) Object.assign(errors, locationBuilt.errors);

  let geometryPatch: ProjectPatchRequest["geometry"] | undefined;
  if (baseline.geometryKind === "complex") {
    if (values.removeGeometry) geometryPatch = null;
  } else {
    const lonBlank = values.longitude.trim() === "";
    const latBlank = values.latitude.trim() === "";
    if (values.removeGeometry && (baseline.geometryKind === "point" || baseline.geometry)) {
      geometryPatch = null;
    } else if (!lonBlank || !latBlank) {
      const lon = coordinate(values.longitude, 180);
      const lat = coordinate(values.latitude, 90);
      if (!lon.ok) errors.longitude = lonBlank ? "pair" : lon.issue;
      if (!lat.ok) errors.latitude = latBlank ? "pair" : lat.issue;
      if (lon.ok && lat.ok) geometryPatch = { type: "Point", coordinates: [lon.value, lat.value] };
    } else if (baseline.geometryKind === "point") {
      geometryPatch = null;
    }
  }

  if (Object.keys(errors).length > 0 || !title.ok || !description.ok || !locationBuilt.ok || !title.value) {
    return { ok: false, errors };
  }

  const body: ProjectPatchRequest = { revision: baseline.revision };
  if (title.value !== baseline.title) body.title = title.value;

  const nextDescription = description.value ?? null;
  const baselineDescription = baseline.description?.trim() ? baseline.description.trim() : null;
  if (nextDescription !== baselineDescription) {
    body.description = nextDescription;
  }

  if (startIso !== undefined) {
    const baselineStart = baseline.startDate;
    if (startIso !== baselineStart) body.startDate = startIso;
  } else if (baseline.startDate && !start) {
    body.startDate = null;
  }

  if (endIso !== undefined) {
    if (endIso !== baseline.plannedEndDate) body.plannedEndDate = endIso;
  } else if (baseline.plannedEndDate && !end) {
    body.plannedEndDate = null;
  }

  if (locationBuilt.ok) {
    const nextLocation = locationBuilt.value;
    const baselineLocation = baseline.location;
    const sameLocation =
      JSON.stringify(nextLocation ?? null) === JSON.stringify(baselineLocation ?? null);
    if (!sameLocation) body.location = nextLocation;
  }

  if (geometryPatch !== undefined) {
    const baselinePoint =
      baseline.geometryKind === "point" && baseline.geometry?.type === "Point"
        ? JSON.stringify(baseline.geometry)
        : baseline.geometryKind === "none"
          ? "null"
          : JSON.stringify(baseline.geometry);
    const nextPoint = geometryPatch === null ? "null" : JSON.stringify(geometryPatch);
    if (baselinePoint !== nextPoint) body.geometry = geometryPatch;
  }

  return { ok: true, body };
}

export function editControlId(field: EditField): string {
  return `project-edit-${field}`;
}

export function editErrorId(field: EditField): string {
  return `project-edit-${field}-error`;
}

export function preservedGeometryLabel(
  geometry: EditBaseline["geometry"],
  geometryKind: EditBaseline["geometryKind"],
  missing: string,
): string {
  if (geometryKind === "complex") return geometrySummary(geometry, missing);
  return missing;
}

export function projectEditCachePlan(input: {
  startedEpoch: number;
  startedToken: string;
  currentEpoch: number;
  currentToken: string | null;
  userId: string;
  roleKey: string;
  projectId: string;
  listQuery: string | null;
}): {
  invalidate: boolean;
  href: string | null;
  queryKey: readonly ["project", "core", string, string, string, string] | null;
} {
  if (!input.projectId || input.currentEpoch !== input.startedEpoch || input.currentToken !== input.startedToken) {
    return { invalidate: false, href: null, queryKey: null };
  }
  const list = input.listQuery ? `?list=${encodeURIComponent(input.listQuery)}` : "";
  return {
    invalidate: true,
    href: `/projects/${input.projectId}/overview${list}`,
    queryKey: projectCoreQueryKey(String(input.currentEpoch), input.userId, input.roleKey, input.projectId),
  };
}

export function readOnlyContextLine(project: ProjectDetail, copy: { fieldCode: string; fieldType: string; types: Record<string, string> }): string {
  const typeLabel = copy.types[project.projectType as keyof typeof copy.types] ?? project.projectType;
  return `${copy.fieldCode}: ${project.projectCode} · ${copy.fieldType}: ${typeLabel} · ${utcDateLabel(project.updatedAt, "—")}`;
}

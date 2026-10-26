export const PROJECT_TYPE_VALUES = [
  "ROAD",
  "WATER",
  "ELECTRICITY",
  "TELECOM",
  "DRAINAGE",
  "BRIDGE",
  "BUILDING",
  "PUBLIC_FACILITY",
  "MULTI_INFRASTRUCTURE",
  "OTHER",
] as const;

export type ProjectTypeValue = (typeof PROJECT_TYPE_VALUES)[number];

export type ProjectCreateFormValues = {
  projectCode: string;
  title: string;
  projectType: string;
  description: string;
  startDate: string;
  plannedEndDate: string;
  amountLkr: string;
  province: string;
  district: string;
  locality: string;
  roadName: string;
  locationDescription: string;
  longitude: string;
  latitude: string;
};

export type ProjectCreateRequest = {
  projectCode: string;
  title: string;
  projectType: ProjectTypeValue;
  description?: string;
  startDate?: string;
  plannedEndDate?: string;
  location?: {
    province?: string;
    district?: string;
    locality?: string;
    roadName?: string;
    description?: string;
  };
  geometry?: { type: "Point"; coordinates: [number, number] };
  budget: { amountMinor: number; currency: "LKR" };
};

export type CreateField = keyof ProjectCreateFormValues;
export type CreateIssue = "required" | "format" | "length" | "unsafe" | "date" | "order" | "money" | "overflow" | "range" | "pair";

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const LOCATION_LIMITS = {
  province: 100,
  district: 100,
  locality: 160,
  roadName: 160,
  locationDescription: 500,
} as const;

function hasControl(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

export function normalizeProjectCode(value: string): string {
  return value.trim().toUpperCase();
}

export function dateOnlyToUtc(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return `${value}T00:00:00.000Z`;
}

/** Decimal-string rupees to integer cents. ASCII digits only. Grouping commas are optional. */
export function rupeesToMinor(raw: string): { ok: true; amountMinor: number } | { ok: false; issue: "required" | "money" | "overflow" } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, issue: "required" };
  if (/[eE+]/.test(trimmed) || trimmed.includes("-") || /[^\d,.]/.test(trimmed)) return { ok: false, issue: "money" };
  if (trimmed.includes(",")) {
    if (!/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(trimmed)) return { ok: false, issue: "money" };
  }
  const plain = trimmed.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(plain)) return { ok: false, issue: "money" };
  const [whole, fraction = ""] = plain.split(".");
  const cents = (fraction + "00").slice(0, 2);
  const minor = BigInt(whole) * BigInt(100) + BigInt(cents);
  if (minor > MAX_SAFE) return { ok: false, issue: "overflow" };
  return { ok: true, amountMinor: Number(minor) };
}

function optionalText(value: string, max: number): { ok: true; value?: string } | { ok: false; issue: "length" | "unsafe" } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true };
  if (trimmed.length > max) return { ok: false, issue: "length" };
  if (hasControl(trimmed) || trimmed.includes("$")) return { ok: false, issue: "unsafe" };
  return { ok: true, value: trimmed };
}

function coordinate(raw: string, limit: number): { ok: true; value: number } | { ok: false; issue: "range" | "pair" } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, issue: "pair" };
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return { ok: false, issue: "range" };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || Math.abs(value) > limit) return { ok: false, issue: "range" };
  return { ok: true, value };
}

export function buildProjectCreateBody(
  input: ProjectCreateFormValues,
): { ok: true; body: ProjectCreateRequest } | { ok: false; errors: Partial<Record<CreateField, CreateIssue>> } {
  const errors: Partial<Record<CreateField, CreateIssue>> = {};
  const projectCode = normalizeProjectCode(input.projectCode);
  if (!projectCode) errors.projectCode = "required";
  else if (projectCode.length > 48) errors.projectCode = "length";
  else if (!/^INF-[A-Z_]+-[0-9]+$/.test(projectCode)) errors.projectCode = "format";

  const title = optionalText(input.title, 200);
  if (!title.ok) errors.title = title.issue;
  else if (!title.value) errors.title = "required";

  const projectType = input.projectType.trim();
  if (!projectType) errors.projectType = "required";
  else if (!PROJECT_TYPE_VALUES.includes(projectType as ProjectTypeValue)) errors.projectType = "format";

  const description = optionalText(input.description, 5000);
  if (!description.ok) errors.description = description.issue;

  const start = input.startDate.trim();
  const end = input.plannedEndDate.trim();
  const startIso = start ? dateOnlyToUtc(start) : undefined;
  const endIso = end ? dateOnlyToUtc(end) : undefined;
  if (start && !startIso) errors.startDate = "date";
  if (end && !endIso) errors.plannedEndDate = "date";
  if (startIso && endIso && endIso < startIso) errors.plannedEndDate = "order";

  const money = rupeesToMinor(input.amountLkr);
  if (!money.ok) errors.amountLkr = money.issue;

  const location: NonNullable<ProjectCreateRequest["location"]> = {};
  const locationFields = [
    ["province", input.province],
    ["district", input.district],
    ["locality", input.locality],
    ["roadName", input.roadName],
    ["locationDescription", input.locationDescription],
  ] as const;
  for (const [field, value] of locationFields) {
    const parsed = optionalText(value, LOCATION_LIMITS[field]);
    if (!parsed.ok) errors[field] = parsed.issue;
    else if (parsed.value) {
      if (field === "locationDescription") location.description = parsed.value;
      else location[field] = parsed.value;
    }
  }

  const lonBlank = input.longitude.trim() === "";
  const latBlank = input.latitude.trim() === "";
  let geometry: ProjectCreateRequest["geometry"];
  if (!lonBlank || !latBlank) {
    const lon = coordinate(input.longitude, 180);
    const lat = coordinate(input.latitude, 90);
    if (!lon.ok) errors.longitude = lonBlank ? "pair" : lon.issue;
    if (!lat.ok) errors.latitude = latBlank ? "pair" : lat.issue;
    if (lon.ok && lat.ok) geometry = { type: "Point", coordinates: [lon.value, lat.value] };
  }

  if (Object.keys(errors).length > 0 || !title.ok || !description.ok || !money.ok || !title.value) {
    return { ok: false, errors };
  }

  const body: ProjectCreateRequest = {
    projectCode,
    title: title.value,
    projectType: projectType as ProjectTypeValue,
    budget: { amountMinor: money.amountMinor, currency: "LKR" },
  };
  if (description.value) body.description = description.value;
  if (startIso) body.startDate = startIso;
  if (endIso) body.plannedEndDate = endIso;
  if (Object.keys(location).length > 0) body.location = location;
  if (geometry) body.geometry = geometry;
  return { ok: true, body };
}

export function createControlId(field: CreateField): string {
  return `project-create-${field}`;
}

export function createErrorId(field: CreateField): string {
  return `project-create-${field}-error`;
}

export function projectCreateCachePlan(input: {
  startedEpoch: number;
  startedToken: string;
  currentEpoch: number;
  currentToken: string | null;
  projectId: string;
}): { invalidate: boolean; href: string | null } {
  if (!input.projectId || input.currentEpoch !== input.startedEpoch || input.currentToken !== input.startedToken) {
    return { invalidate: false, href: null };
  }
  return { invalidate: true, href: `/projects/${input.projectId}/overview` };
}

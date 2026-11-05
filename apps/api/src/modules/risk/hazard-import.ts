import { validGeometry } from "../../shared/database/geometry.js";
import { HAZARD_LEVELS, HAZARD_TYPES } from "./hazard.constants.js";

/**
 * Pure planning half of the hazard-zone import. No database access: it validates provenance and every feature and
 * reports what would be written, so the dry-run (the default) and the tests exercise exactly the same code.
 *
 * Candidate sources to REQUEST permission or data from (access, format and licence are UNVERIFIED; nothing is bundled
 * or scraped by this repository): National Building Research Organisation landslide hazard zonation; Disaster
 * Management Centre or Irrigation Department flood extents. Record the licence you were actually granted.
 */
export type ImportOptions = {
  hazardType: string;
  levelProperty: string;
  levelMap: Record<string, string>;
  organisation: string;
  dataset: string;
  licence: string;
  kind: string;
  sourceUrl?: string | undefined;
  dataDate?: string | undefined;
  agencyId?: string | undefined;
  commit: boolean;
};

export type PlannedZone = { externalId: string; name: string; hazardType: string; level: string; geometry: unknown; description?: string };
export type ImportPlan = { refused: string | null; read: number; valid: number; skipped: { index: number; reason: string }[]; zones: PlannedZone[] };

const MAX_COORDINATES = 10_000;
const KINDS = ["OFFICIAL_PUBLIC", "AGENCY_SUPPLIED"];

function countCoordinates(value: unknown): number {
  if (Array.isArray(value) && typeof value[0] === "number") return 1;
  return Array.isArray(value) ? value.reduce<number>((n, part) => n + countCoordinates(part), 0) : 0;
}

/** Provenance is mandatory. DEMO is never importable: demo data comes only from the labelled seed. */
export function checkProvenance(o: Partial<ImportOptions>): string | null {
  const missing = (["organisation", "dataset", "licence", "kind", "hazardType"] as const).filter((k) => !o[k]?.toString().trim());
  if (missing.length) return `missing required provenance: ${missing.join(", ")}`;
  if (!KINDS.includes(o.kind as string)) return `--kind must be one of ${KINDS.join(", ")} (DEMO is not importable)`;
  if (!(HAZARD_TYPES as readonly string[]).includes(o.hazardType as string)) return `--hazard-type must be one of ${HAZARD_TYPES.join(", ")}`;
  if (o.dataDate && Number.isNaN(Date.parse(o.dataDate))) return "--data-date is not a valid date";
  return null;
}

export function planImport(collection: unknown, options: ImportOptions): ImportPlan {
  const refused = checkProvenance(options);
  const features = (collection as { features?: unknown[] } | null)?.features;
  if (refused) return { refused, read: 0, valid: 0, skipped: [], zones: [] };
  if (!Array.isArray(features)) return { refused: "input is not a GeoJSON FeatureCollection", read: 0, valid: 0, skipped: [], zones: [] };
  const skipped: ImportPlan["skipped"] = [];
  const zones: PlannedZone[] = [];
  features.forEach((raw, index) => {
    const feature = raw as { id?: unknown; geometry?: { type?: string; coordinates?: unknown } | null; properties?: Record<string, unknown> | null };
    const geometry = feature?.geometry;
    if (!geometry || !["Polygon", "Point"].includes(String(geometry.type))) { skipped.push({ index, reason: "geometry must be a Polygon or Point" }); return; }
    if (countCoordinates(geometry.coordinates) > MAX_COORDINATES) { skipped.push({ index, reason: `more than ${MAX_COORDINATES} coordinates` }); return; }
    if (!validGeometry(geometry)) { skipped.push({ index, reason: "invalid geometry" }); return; }
    const rawLevel = String(feature.properties?.[options.levelProperty]);
    const mapped = options.levelMap[rawLevel] ?? rawLevel;
    const level = (HAZARD_LEVELS as readonly string[]).includes(mapped) ? mapped : undefined;
    if (!level) { skipped.push({ index, reason: `level "${rawLevel}" does not map to ${HAZARD_LEVELS.join("/")}` }); return; }
    const externalId = String(feature.id ?? feature.properties?.id ?? feature.properties?.externalId ?? "").trim();
    if (!externalId) { skipped.push({ index, reason: "no stable id (feature id or properties.id/externalId) for an idempotent re-import" }); return; }
    const name = String(feature.properties?.name ?? `${options.dataset} ${externalId}`).slice(0, 200);
    zones.push({ externalId, name, hazardType: options.hazardType, level, geometry });
  });
  return { refused: null, read: features.length, valid: zones.length, skipped, zones };
}

/** Parses `--key value` and bare `--flag` arguments. Unknown keys are kept so the caller can refuse them. */
export function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[arg.slice(2)] = true;
    else { out[arg.slice(2)] = next; i += 1; }
  }
  return out;
}

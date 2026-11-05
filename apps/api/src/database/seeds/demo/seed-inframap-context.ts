import type { Geometry } from "../../../shared/database/geometry.js";
import { Asset } from "../../../modules/assets/models/asset.model.js";
import { MaintenanceRecord } from "../../../modules/assets/models/maintenance-record.model.js";
import { HazardZone } from "../../../modules/risk/models/hazard-zone.model.js";
import { d } from "../helpers/dates.js";
import { GEO_WATER_CORRIDOR_OVERLAP } from "../helpers/geometry.js";
import { ctxId, type DemoContext } from "./context.js";

/**
 * Batch 02 demo context for InfraMap: a handful of labelled synthetic assets, one restricted water main, one standard
 * drainage point and two hazard zones. Hazard zones are prefixed "[DEMO]" and carry source.kind DEMO, so the UI always
 * shows them as demo data. These are NOT real hazard datasets. Idempotent: upserts by name.
 */
const DEMO_SOURCE = {
  kind: "DEMO" as const,
  organisation: "INFRAOS demo",
  datasetName: "[DEMO] InfraMap synthetic hazard zones",
  url: undefined,
  retrievedAt: d("2026-04-01T00:00:00.000Z"),
  notes: "Synthetic polygon for demonstration only. Not an official hazard zone.",
};

const FLOOD: Geometry = { type: "Polygon", coordinates: [[[79.8598, 6.9262], [79.8636, 6.9262], [79.8636, 6.9291], [79.8598, 6.9291], [79.8598, 6.9262]]] };
const LANDSLIDE: Geometry = { type: "Polygon", coordinates: [[[80.6240, 7.2820], [80.6420, 7.2820], [80.6420, 7.2985], [80.6240, 7.2985], [80.6240, 7.2820]]] };
const ROAD_ASSET: Geometry = { type: "LineString", coordinates: [[79.8575, 6.9250], [79.8590, 6.9262], [79.8640, 6.9300]] };
const BUILDING: Geometry = { type: "Point", coordinates: [79.8668, 6.9325] };
const DRAIN: Geometry = { type: "Point", coordinates: [79.8606, 6.9270] };
const POOR_BRIDGE: Geometry = { type: "Point", coordinates: [79.8506, 6.9106] }; // beside GEO_BRIDGE_POINT so both demo bridges stay visible

type AssetSeed = { name: string; assetType: string; agency: string; project: string; geometry: Geometry; condition: string; healthScore: number; sensitivity?: "STANDARD" | "RESTRICTED"; lastInspectionAt?: Date; nextMaintenanceAt?: Date; locality: string };

export const DEMO_INFRAMAP_ASSET_NAMES = ["[DEMO] Water main (restricted)", "[DEMO] Roadside drainage point", "[DEMO] Poor-condition river bridge", "[DEMO] Corridor road asset", "[DEMO] Public facility building"] as const;
export const DEMO_HAZARD_NAMES = ["[DEMO] Flood-prone area (synthetic)", "[DEMO] Landslide-prone slope (synthetic)"] as const;

export async function seedDemoInframapContext(context: DemoContext): Promise<{ assets: number; hazardZones: number }> {
  const seeds: AssetSeed[] = [
    { name: DEMO_INFRAMAP_ASSET_NAMES[0], assetType: "WATER", agency: "DEMO_WATER", project: "INF-WATER-001", geometry: GEO_WATER_CORRIDOR_OVERLAP, condition: "FAIR", healthScore: 64, sensitivity: "RESTRICTED", lastInspectionAt: d("2026-02-01T00:00:00.000Z"), nextMaintenanceAt: d("2026-09-01T00:00:00.000Z"), locality: "Demo corridor" },
    { name: DEMO_INFRAMAP_ASSET_NAMES[1], assetType: "DRAINAGE", agency: "AGENCY_DEMO_DRAINAGE", project: "INF-DRAINAGE-001", geometry: DRAIN, condition: "GOOD", healthScore: 82, sensitivity: "STANDARD", lastInspectionAt: d("2026-03-01T00:00:00.000Z"), nextMaintenanceAt: d("2027-03-01T00:00:00.000Z"), locality: "Demo corridor" },
    // Overdue maintenance and poor condition: the Needs-Attention example.
    { name: DEMO_INFRAMAP_ASSET_NAMES[2], assetType: "BRIDGE", agency: "DEMO_RDA", project: "INF-BRIDGE-001", geometry: POOR_BRIDGE, condition: "POOR", healthScore: 41, sensitivity: "STANDARD", lastInspectionAt: d("2025-01-15T00:00:00.000Z"), nextMaintenanceAt: d("2026-03-01T00:00:00.000Z"), locality: "Demo riverside" },
    { name: DEMO_INFRAMAP_ASSET_NAMES[3], assetType: "ROAD", agency: "DEMO_RDA", project: "INF-ROAD-001", geometry: ROAD_ASSET, condition: "FAIR", healthScore: 58, sensitivity: "STANDARD", lastInspectionAt: d("2026-01-20T00:00:00.000Z"), nextMaintenanceAt: d("2026-10-01T00:00:00.000Z"), locality: "Demo corridor" },
    { name: DEMO_INFRAMAP_ASSET_NAMES[4], assetType: "PUBLIC_FACILITY", agency: "DEMO_RDA", project: "INF-PFAC-001", geometry: BUILDING, condition: "GOOD", healthScore: 90, sensitivity: "STANDARD", lastInspectionAt: d("2026-03-10T00:00:00.000Z"), locality: "Demo district" },
  ];
  const ids = new Map<string, unknown>();
  for (const a of seeds) {
    const doc = await Asset.findOneAndUpdate(
      { name: a.name },
      { $set: {
        sourceProjectId: ctxId(context.projects, a.project), assetType: a.assetType, agencyId: ctxId(context.agencies, a.agency), geometry: a.geometry,
        condition: a.condition, healthScore: a.healthScore, ...(a.sensitivity ? { sensitivity: a.sensitivity } : {}),
        commissionedAt: d("2023-01-01T00:00:00.000Z"), ...(a.lastInspectionAt ? { lastInspectionAt: a.lastInspectionAt } : {}), ...(a.nextMaintenanceAt ? { nextMaintenanceAt: a.nextMaintenanceAt } : {}),
        location: { province: "Western Province", district: "Colombo", locality: a.locality, description: "Synthetic demo record." },
      }, $setOnInsert: { name: a.name } },
      { upsert: true, new: true, runValidators: true },
    );
    ids.set(a.name, doc._id);
  }
  const bridgeId = ids.get(DEMO_INFRAMAP_ASSET_NAMES[2]) as never;
  for (const m of [
    { maintenanceType: "ROUTINE", status: "COMPLETED", scheduledDate: d("2025-01-15T00:00:00.000Z"), completedDate: d("2025-01-16T00:00:00.000Z") },
    { maintenanceType: "CORRECTIVE", status: "OVERDUE", scheduledDate: d("2026-03-01T00:00:00.000Z") },
  ]) {
    await MaintenanceRecord.findOneAndUpdate({ assetId: bridgeId, maintenanceType: m.maintenanceType, scheduledDate: m.scheduledDate }, { $set: { status: m.status, ...("completedDate" in m ? { completedDate: m.completedDate } : {}) }, $setOnInsert: { assetId: bridgeId, maintenanceType: m.maintenanceType, scheduledDate: m.scheduledDate } }, { upsert: true, runValidators: true });
  }
  const zones = [
    { name: DEMO_HAZARD_NAMES[0], hazardType: "FLOOD", level: "HIGH", geometry: FLOOD, description: "Synthetic flood polygon overlapping the demo road corridor." },
    { name: DEMO_HAZARD_NAMES[1], hazardType: "LANDSLIDE", level: "MEDIUM", geometry: LANDSLIDE, description: "Synthetic landslide polygon away from the demo corridor." },
  ];
  for (const z of zones) {
    await HazardZone.findOneAndUpdate({ name: z.name, isDemo: true }, { $set: { hazardType: z.hazardType, level: z.level, geometry: z.geometry, description: z.description, visibility: "ALL_STAFF", source: DEMO_SOURCE, isDemo: true }, $setOnInsert: { name: z.name } }, { upsert: true, runValidators: true });
  }
  return { assets: seeds.length, hazardZones: zones.length };
}

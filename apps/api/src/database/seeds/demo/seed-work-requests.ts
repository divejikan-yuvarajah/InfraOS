import { WorkRequest } from "../../../modules/roadsync/models/work-request.model.js";
import { demoDates } from "../helpers/dates.js";
import {
  GEO_FAR_CONTROL,
  GEO_NEARBY_PARALLEL,
  GEO_ROAD_CORRIDOR,
  GEO_ROAD_CORRIDOR_B,
  GEO_WATER_CORRIDOR_OVERLAP,
} from "../helpers/geometry.js";
import type { DemoProjectCode } from "./catalog.js";
import { ctxId, type DemoContext } from "./context.js";

type WorkFixture = {
  projectCode: DemoProjectCode;
  agencyCode: string;
  workType: string;
  status: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  plannedStart: Date;
  plannedEnd: Date;
  geometry: typeof GEO_ROAD_CORRIDOR;
};

const WORK_FIXTURES: WorkFixture[] = [
  {
    projectCode: "INF-ROAD-001",
    agencyCode: "DEMO_RDA",
    workType: "ROAD_RESURFACING",
    status: "ACTIVE",
    priority: "HIGH",
    plannedStart: demoDates.wrRoadStart,
    plannedEnd: demoDates.wrRoadEnd,
    geometry: GEO_ROAD_CORRIDOR,
  },
  {
    projectCode: "INF-WATER-001",
    agencyCode: "DEMO_WATER",
    workType: "PIPELINE_INSTALLATION",
    status: "APPROVED",
    priority: "HIGH",
    plannedStart: demoDates.wrWaterStart,
    plannedEnd: demoDates.wrWaterEnd,
    geometry: GEO_WATER_CORRIDOR_OVERLAP,
  },
  {
    projectCode: "INF-DRAINAGE-001",
    agencyCode: "AGENCY_DEMO_DRAINAGE",
    workType: "DRAINAGE_WORK",
    status: "ACTIVE",
    priority: "LOW",
    plannedStart: demoDates.wrFarStart,
    plannedEnd: demoDates.wrFarEnd,
    geometry: GEO_FAR_CONTROL,
  },
  {
    projectCode: "INF-ROAD-001",
    agencyCode: "DEMO_RDA",
    workType: "ROAD_EXCAVATION",
    status: "PLANNED",
    priority: "LOW",
    plannedStart: demoDates.wrNonOverlapStart,
    plannedEnd: demoDates.wrNonOverlapEnd,
    geometry: GEO_ROAD_CORRIDOR_B,
  },
  {
    projectCode: "INF-WATER-001",
    agencyCode: "DEMO_WATER",
    workType: "UTILITY_REPAIR",
    status: "PLANNED",
    priority: "NORMAL",
    plannedStart: demoDates.wrNearbyStart,
    plannedEnd: demoDates.wrNearbyEnd,
    geometry: GEO_NEARBY_PARALLEL,
  },
  {
    projectCode: "INF-TELECOM-001",
    agencyCode: "AGENCY_DEMO_TELECOM",
    workType: "TELECOM_CABLE_WORK",
    status: "PLANNED",
    priority: "NORMAL",
    plannedStart: demoDates.wrWaterStart,
    plannedEnd: demoDates.wrWaterEnd,
    geometry: GEO_NEARBY_PARALLEL,
  },
];

export async function seedDemoWorkRequests(context: DemoContext): Promise<number> {
  let count = 0;
  for (const row of WORK_FIXTURES) {
    const projectId = ctxId(context.projects, row.projectCode);
    await WorkRequest.findOneAndUpdate(
      {
        projectId,
        workType: row.workType,
        plannedStart: row.plannedStart,
      },
      {
        $set: {
          agencyId: ctxId(context.agencies, row.agencyCode),
          geometry: row.geometry,
          plannedEnd: row.plannedEnd,
          status: row.status,
          priority: row.priority,
        },
        $setOnInsert: {
          projectId,
          workType: row.workType,
          plannedStart: row.plannedStart,
        },
      },
      { upsert: true, runValidators: true },
    );
    count += 1;
  }
  return count;
}

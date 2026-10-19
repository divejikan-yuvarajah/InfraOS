import { Milestone } from "../../../modules/projects/models/milestone.model.js";
import { Project } from "../../../modules/projects/models/project.model.js";
import { d, demoDates } from "../helpers/dates.js";
import {
  GEO_BRIDGE_POINT,
  GEO_FAR_CONTROL,
  GEO_ROAD_CORRIDOR,
} from "../helpers/geometry.js";
import { lkr } from "../helpers/money.js";
import { DEMO_MILESTONE_TITLES, DEMO_PROJECT_CODES } from "./catalog.js";
import { ctxId, type DemoContext } from "./context.js";

const colomboLocation = {
  province: "Western Province",
  district: "Colombo",
  locality: "Colombo Fort",
  roadName: "Demo Central Corridor",
  description: "Synthetic corridor for RoadSync prototype demonstrations.",
};

type ProjectSeed = {
  projectCode: (typeof DEMO_PROJECT_CODES)[number];
  title: string;
  projectType: string;
  agencyCode: string;
  status: string;
  contractorReg?: string;
  startDate?: Date;
  plannedEndDate?: Date;
  actualEndDate?: Date;
  budgetMinor: number;
  physicalProgress: number;
  financialProgress: number;
  riskScore?: number;
  geometry?: typeof GEO_ROAD_CORRIDOR;
};

const PROJECTS: ProjectSeed[] = [
  {
    projectCode: "INF-ROAD-001",
    title: "Central Corridor Road Resurfacing (Demo)",
    projectType: "ROAD",
    agencyCode: "DEMO_RDA",
    status: "ACTIVE",
    contractorReg: "SYNTH/ALPHA-001",
    startDate: demoDates.roadStart,
    plannedEndDate: demoDates.roadEnd,
    budgetMinor: 850_000_000_00,
    physicalProgress: 35,
    financialProgress: 28,
    geometry: GEO_ROAD_CORRIDOR,
  },
  {
    projectCode: "INF-WATER-001",
    title: "Central Corridor Water Main Upgrade (Demo)",
    projectType: "WATER",
    agencyCode: "DEMO_WATER",
    status: "APPROVED",
    contractorReg: "SYNTH/BETA-001",
    startDate: demoDates.waterStart,
    plannedEndDate: demoDates.waterEnd,
    budgetMinor: 420_000_000_00,
    physicalProgress: 0,
    financialProgress: 5,
    geometry: GEO_ROAD_CORRIDOR,
  },
  {
    projectCode: "INF-TELECOM-001",
    title: "Metro Telecom Cable Route (Demo)",
    projectType: "TELECOM",
    agencyCode: "AGENCY_DEMO_TELECOM",
    status: "DRAFT",
    budgetMinor: 95_000_000_00,
    physicalProgress: 0,
    financialProgress: 0,
  },
  {
    projectCode: "INF-DRAINAGE-001",
    title: "Colombo Drainage Upgrade (Demo)",
    projectType: "DRAINAGE",
    agencyCode: "AGENCY_DEMO_DRAINAGE",
    status: "ACTIVE",
    contractorReg: "SYNTH/GAMMA-001",
    startDate: demoDates.waterStart,
    plannedEndDate: demoDates.waterEnd,
    budgetMinor: 210_000_000_00,
    physicalProgress: 20,
    financialProgress: 15,
    geometry: GEO_FAR_CONTROL,
  },
  {
    projectCode: "INF-PFAC-001",
    title: "Delayed Public Facility Access Road (Demo)",
    projectType: "PUBLIC_FACILITY",
    agencyCode: "AGENCY_DEMO_LOCAL",
    status: "DELAYED",
    contractorReg: "SYNTH/BETA-001",
    startDate: demoDates.delayedStart,
    plannedEndDate: demoDates.delayedEnd,
    budgetMinor: 310_000_000_00,
    physicalProgress: 45,
    financialProgress: 67,
    riskScore: 72,
    geometry: GEO_BRIDGE_POINT,
  },
  {
    projectCode: "INF-BRIDGE-001",
    title: "Demo Riverside Bridge Completion (Synthetic)",
    projectType: "BRIDGE",
    agencyCode: "DEMO_RDA",
    status: "COMPLETED",
    contractorReg: "SYNTH/ALPHA-001",
    startDate: demoDates.completedStart,
    plannedEndDate: demoDates.completedEnd,
    actualEndDate: demoDates.completedEnd,
    budgetMinor: 560_000_000_00,
    physicalProgress: 100,
    financialProgress: 98,
    geometry: GEO_BRIDGE_POINT,
  },
  {
    projectCode: "INF-DRAFT-001",
    title: "Draft Concept Study (Demo)",
    projectType: "OTHER",
    agencyCode: "AGENCY_DEMO_PLANNING",
    status: "DRAFT",
    budgetMinor: 12_000_000_00,
    physicalProgress: 0,
    financialProgress: 0,
  },
];

export async function seedDemoProjects(
  context: DemoContext,
): Promise<Map<(typeof DEMO_PROJECT_CODES)[number], import("mongoose").Types.ObjectId>> {
  const projects = new Map<
    (typeof DEMO_PROJECT_CODES)[number],
    import("mongoose").Types.ObjectId
  >();
  const pmId = ctxId(context.users, "PROJECT_MANAGER");

  for (const row of PROJECTS) {
    const contractorId = row.contractorReg
      ? context.contractors.get(row.contractorReg)
      : undefined;
    const doc = await Project.findOneAndUpdate(
      { projectCode: row.projectCode },
      {
        $set: {
          title: row.title,
          description: `${row.title} — synthetic INFRAOS prototype data.`,
          projectType: row.projectType,
          agencyId: ctxId(context.agencies, row.agencyCode),
          managerId: pmId,
          contractorId: contractorId ?? null,
          location: colomboLocation,
          geometry: row.geometry,
          startDate: row.startDate,
          plannedEndDate: row.plannedEndDate,
          actualEndDate: row.actualEndDate,
          budget: lkr(row.budgetMinor),
          physicalProgress: row.physicalProgress,
          financialProgress: row.financialProgress,
          riskScore: row.riskScore,
          status: row.status,
          createdBy: pmId,
        },
        $setOnInsert: { projectCode: row.projectCode },
      },
      { upsert: true, new: true, runValidators: true },
    );
    projects.set(row.projectCode, doc._id);
  }

  await seedRoadMilestones(projects.get("INF-ROAD-001")!);
  return projects;
}

async function seedRoadMilestones(
  projectId: import("mongoose").Types.ObjectId,
): Promise<void> {
  const milestones = [
    {
      title: DEMO_MILESTONE_TITLES[0],
      status: "COMPLETED",
      progress: 100,
      plannedStart: demoDates.roadStart,
      plannedEnd: d("2026-02-01T00:00:00.000Z"),
      actualEnd: d("2026-01-28T00:00:00.000Z"),
    },
    {
      title: DEMO_MILESTONE_TITLES[1],
      status: "IN_PROGRESS",
      progress: 55,
      plannedStart: d("2026-02-01T00:00:00.000Z"),
      plannedEnd: d("2026-04-01T00:00:00.000Z"),
      actualStart: d("2026-02-03T00:00:00.000Z"),
    },
    {
      title: DEMO_MILESTONE_TITLES[2],
      status: "NOT_STARTED",
      progress: 0,
      plannedStart: d("2026-04-01T00:00:00.000Z"),
      plannedEnd: d("2026-05-15T00:00:00.000Z"),
    },
    {
      title: DEMO_MILESTONE_TITLES[3],
      status: "NOT_STARTED",
      progress: 0,
      plannedStart: d("2026-05-15T00:00:00.000Z"),
      plannedEnd: demoDates.roadEnd,
    },
    {
      title: "Delayed Site Mobilization (Demo Risk)",
      status: "DELAYED",
      progress: 30,
      plannedStart: demoDates.delayedStart,
      plannedEnd: d("2025-09-01T00:00:00.000Z"),
    },
  ] as const;

  for (const row of milestones) {
    await Milestone.findOneAndUpdate(
      { projectId, title: row.title },
      {
        $set: {
          description: "Synthetic milestone for demo timelines.",
          plannedStart: row.plannedStart,
          plannedEnd: row.plannedEnd,
          actualStart: "actualStart" in row ? row.actualStart : undefined,
          actualEnd: "actualEnd" in row ? row.actualEnd : undefined,
          progress: row.progress,
          status: row.status,
        },
        $setOnInsert: { projectId, title: row.title },
      },
      { upsert: true, runValidators: true },
    );
  }
}

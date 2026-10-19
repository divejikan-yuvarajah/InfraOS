import { Agency } from "../../../modules/agencies/models/agency.model.js";
import { DEMO_LAYER_AGENCY_CODES } from "./catalog.js";

const LAYER_AGENCIES = [
  {
    code: "AGENCY_DEMO_TELECOM",
    name: "Public Telecom Coordination Agency (Demo)",
    shortName: "Demo Telecom",
    type: "TELECOM" as const,
    description:
      "Synthetic prototype agency for INFRAOS demos. Not an official telecom regulator.",
    parentCode: "DEMO_MINISTRY",
  },
  {
    code: "AGENCY_DEMO_DRAINAGE",
    name: "Municipal Drainage & Local Works Authority (Demo)",
    shortName: "Demo Drainage",
    type: "DRAINAGE" as const,
    description: "Synthetic drainage authority for development demonstrations only.",
    parentCode: "DEMO_MINISTRY",
  },
  {
    code: "AGENCY_DEMO_LOCAL",
    name: "Demo Municipal Local Authority",
    shortName: "Demo Local",
    type: "LOCAL_AUTHORITY" as const,
    description: "Synthetic local authority for academic prototype scenarios.",
    parentCode: "DEMO_MINISTRY",
  },
  {
    code: "AGENCY_DEMO_PLANNING",
    name: "National Infrastructure Planning Office (Demo)",
    shortName: "Demo Planning",
    type: "DEPARTMENT" as const,
    description: "Synthetic planning department — not a real government office.",
    parentCode: "DEMO_MINISTRY",
  },
] as const;

export async function seedDemoAgencies(
  existing: Map<string, import("mongoose").Types.ObjectId>,
): Promise<Map<string, import("mongoose").Types.ObjectId>> {
  const agencies = new Map(existing);

  for (const agency of LAYER_AGENCIES) {
    const parentId = agency.parentCode
      ? agencies.get(agency.parentCode)
      : undefined;
    const doc = await Agency.findOneAndUpdate(
      { code: agency.code },
      {
        $set: {
          name: agency.name,
          shortName: agency.shortName,
          type: agency.type,
          description: agency.description,
          status: "ACTIVE",
          parentAgencyId: parentId ?? null,
        },
        $setOnInsert: { code: agency.code },
      },
      { upsert: true, new: true, runValidators: true },
    );
    agencies.set(agency.code, doc._id);
  }

  return agencies;
}

export async function loadAgencyMap(): Promise<
  Map<string, import("mongoose").Types.ObjectId>
> {
  const codes = [
    "DEMO_MINISTRY",
    "DEMO_RDA",
    "DEMO_WATER",
    "DEMO_ELEC",
    ...DEMO_LAYER_AGENCY_CODES,
  ];
  const agencies = new Map<string, import("mongoose").Types.ObjectId>();
  for (const code of codes) {
    const doc = await Agency.findOne({ code });
    if (doc) {
      agencies.set(code, doc._id);
    }
  }
  return agencies;
}

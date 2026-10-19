import { Contractor } from "../../../modules/contractors/models/contractor.model.js";
const CONTRACTORS = [
  {
    registrationNumber: "SYNTH/ALPHA-001",
    name: "Contractor Alpha (Synthetic)",
    rating: 4.2,
    riskLevel: "LOW" as const,
    activeProjects: 2,
    completedProjects: 8,
  },
  {
    registrationNumber: "SYNTH/BETA-001",
    name: "Contractor Beta (Synthetic)",
    rating: 3.6,
    riskLevel: "MEDIUM" as const,
    activeProjects: 1,
    completedProjects: 5,
  },
  {
    registrationNumber: "SYNTH/GAMMA-001",
    name: "Contractor Gamma (Synthetic)",
    rating: 3.1,
    riskLevel: "MEDIUM" as const,
    activeProjects: 3,
    completedProjects: 12,
  },
] as const;

export async function seedDemoContractors(): Promise<
  Map<string, import("mongoose").Types.ObjectId>
> {
  const map = new Map<string, import("mongoose").Types.ObjectId>();
  for (const row of CONTRACTORS) {
    const doc = await Contractor.findOneAndUpdate(
      { registrationNumber: row.registrationNumber },
      {
        $set: {
          name: row.name,
          rating: row.rating,
          riskLevel: row.riskLevel,
          activeProjects: row.activeProjects,
          completedProjects: row.completedProjects,
          status: "ACTIVE",
          contact: {
            email: "contact@contractor-demo.invalid",
            phone: "+94-11-000-0000",
          },
        },
        $setOnInsert: { registrationNumber: row.registrationNumber },
      },
      { upsert: true, new: true, runValidators: true },
    );
    map.set(row.registrationNumber, doc._id);
  }
  return map;
}

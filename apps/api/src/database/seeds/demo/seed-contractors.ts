import { Contractor } from "../../../modules/contractors/models/contractor.model.js";
import { emailKeyOf, nameKeyOf } from "../../../modules/contractors/contractor.keys.js";
import { ctxId } from "./context.js";

/**
 * Three clearly synthetic contractors. Legacy rating/riskLevel/activeProjects/completedProjects are deliberately NOT seeded
 * (and are removed on re-seed): indicators are computed from evidence, so a contractor with little evidence honestly shows
 * "Not enough evidence". Certification dates: one expired on a fixed past date, one expiring ~20 days after seeding so the
 * certification-expiry watch has something to show (the only relative date in the demo calendar, because expiry is judged against today).
 */
const DAY = 86_400_000;
const CONTRACTORS = [
  {
    registrationNumber: "SYNTH/ALPHA-001", name: "Contractor Alpha (Synthetic)", agency: "DEMO_RDA", category: "ROAD_CONSTRUCTION",
    districts: ["Colombo", "Gampaha"], specializations: ["Resurfacing", "Bridges"], authority: "CIDA", grade: "C3",
    certs: [
      { name: "CIDA Registration (Synthetic)", issuer: "Demo Authority", referenceNumber: "DEMO-CIDA-A", expiresOn: new Date("2025-09-30T00:00:00.000Z") as Date | "soon" },
      { name: "ISO 9001 (Synthetic)", issuer: "Demo Certifier", referenceNumber: "DEMO-ISO-A", expiresOn: "soon" as Date | "soon" },
    ],
  },
  {
    registrationNumber: "SYNTH/BETA-001", name: "Contractor Beta (Synthetic)", agency: "DEMO_WATER", category: "WATER_SEWERAGE",
    districts: ["Colombo", "Kalutara"], specializations: ["Pipelines"], authority: "CIDA", grade: "C4",
    certs: [{ name: "CIDA Registration (Synthetic)", issuer: "Demo Authority", referenceNumber: "DEMO-CIDA-B", expiresOn: new Date("2027-12-31T00:00:00.000Z") as Date | "soon" }],
  },
  {
    registrationNumber: "SYNTH/GAMMA-001", name: "Contractor Gamma (Synthetic)", agency: "AGENCY_DEMO_DRAINAGE", category: "DRAINAGE",
    districts: ["Colombo"], specializations: ["Culverts", "Drains"], authority: undefined, grade: undefined,
    certs: [] as { name: string; issuer: string; referenceNumber: string; expiresOn: Date | "soon" }[],
  },
];

export async function seedDemoContractors(agencies: Map<string, import("mongoose").Types.ObjectId>): Promise<Map<string, import("mongoose").Types.ObjectId>> {
  const map = new Map<string, import("mongoose").Types.ObjectId>();
  const soon = new Date(Date.now() + 20 * DAY);
  for (const row of CONTRACTORS) {
    const email = `${row.registrationNumber.split("/")[1]!.toLowerCase()}@contractor-demo.invalid`;
    const doc = await Contractor.findOneAndUpdate(
      { registrationNumber: row.registrationNumber },
      {
        $set: {
          name: row.name, nameKey: nameKeyOf(row.name), emailKey: emailKeyOf(email), status: "ACTIVE",
          registeredByAgencyId: ctxId(agencies, row.agency), category: row.category,
          specializations: [...row.specializations], operatingDistricts: [...row.districts],
          contact: { contactPersonName: "Demo Contact", email, phone: "+94-11-000-0000" },
          business: { legalName: row.name, ...(row.authority ? { registrationAuthority: row.authority } : {}), ...(row.grade ? { cidaGrade: row.grade } : {}) },
          certifications: row.certs.map((c) => ({ name: c.name, issuer: c.issuer, referenceNumber: c.referenceNumber, expiresOn: c.expiresOn === "soon" ? soon : c.expiresOn, status: "VALID" })),
        },
        $unset: { rating: 1, riskLevel: 1, activeProjects: 1, completedProjects: 1 },
        $setOnInsert: { registrationNumber: row.registrationNumber },
      },
      { upsert: true, new: true, runValidators: true },
    );
    map.set(row.registrationNumber, doc._id);
  }
  return map;
}

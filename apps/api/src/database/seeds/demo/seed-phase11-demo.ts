import crypto from "node:crypto";
import { Agency } from "../../../modules/agencies/models/agency.model.js";
import { CitizenIssue } from "../../../modules/issues/models/citizen-issue.model.js";
import { IssueRoutingRule } from "../../../modules/issues/models/issue-routing-rule.model.js";
import { Project } from "../../../modules/projects/models/project.model.js";

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

/** Idempotent demo seeder for Phase 11 (released public projects, issue routing rules, demo citizen issues). */
export async function seedPhase11Demo(): Promise<void> {
  const agencies = await Agency.find({ status: "ACTIVE" }).select("_id code").lean();
  const byCode = new Map(agencies.map((a) => [a.code, a._id]));
  const rdaId = byCode.get("RDA") ?? agencies[0]?._id;
  const nwsdbId = byCode.get("NWSDB") ?? agencies[0]?._id;
  const cebId = byCode.get("CEB") ?? agencies[0]?._id;
  if (!rdaId) return;

  // 1. Mark up to 3 active/completed non-draft projects as publicRelease
  const candidateProjects = await Project.find({ status: { $in: ["ACTIVE", "APPROVED", "COMPLETED"] } })
    .sort({ createdAt: 1 })
    .limit(3);

  for (const p of candidateProjects) {
    if (!p.publicRelease?.isPublic) {
      p.publicRelease = {
        isPublic: true,
        slug: p.projectCode.toLowerCase(),
        showProgress: true,
        showBudgetBand: true,
        showCoordinates: true,
        safeTitle: p.title,
        safeSummary: p.description?.slice(0, 400) || `Public infrastructure works under ${p.projectCode}.`,
        publishedAt: new Date(),
      };
      await p.save();
    }
  }

  // 2. Seed demo routing rules (idempotent via isDemo + category/district check)
  const rules: Array<{ category: "POTHOLE" | "WATER_LEAK" | "STREET_LIGHT"; district?: string; province: string; agencyId: typeof rdaId; priorityOrder: number }> = [
    { category: "POTHOLE", district: "Colombo", province: "Western", agencyId: rdaId, priorityOrder: 10 },
    { category: "WATER_LEAK", district: "Colombo", province: "Western", agencyId: nwsdbId ?? rdaId, priorityOrder: 10 },
    { category: "STREET_LIGHT", province: "Western", agencyId: cebId ?? rdaId, priorityOrder: 20 },
  ];

  for (const r of rules) {
    const exists = await IssueRoutingRule.findOne({ category: r.category, district: r.district ?? null, isDemo: true }).lean();
    if (!exists) {
      await IssueRoutingRule.create({ ...r, isActive: true, isDemo: true });
    }
  }

  // 3. Seed demo citizen issues with deterministic demo reference numbers
  const demoIssues = [
    {
      referenceNo: "ISS-DEMO-0001",
      category: "POTHOLE" as const,
      title: "Deep carriageway pothole near Borella junction",
      description: "Heavy rain widened a 1.2m depression on the eastbound lane causing bus lane congestion.",
      location: { addressLine: "Baseline Rd near Borella Junction", district: "Colombo", province: "Western" },
      geometry: { type: "Point" as const, coordinates: [79.878, 6.915] },
      assignedAgency: rdaId,
      status: "IN_PROGRESS" as const,
      priority: "HIGH" as const,
      publicMapVisible: true,
      secret: "demo-secret-0001",
    },
    {
      referenceNo: "ISS-DEMO-0002",
      category: "WATER_LEAK" as const,
      title: "Distribution main seepage on Galle Road kerb",
      description: "Continuous clean-water seepage emerging near storm drain grate since morning.",
      location: { addressLine: "Galle Rd, Bambalapitiya", district: "Colombo", province: "Western" },
      geometry: { type: "Point" as const, coordinates: [79.855, 6.893] },
      assignedAgency: nwsdbId ?? rdaId,
      status: "ASSIGNED" as const,
      priority: "NORMAL" as const,
      publicMapVisible: true,
      secret: "demo-secret-0002",
    },
    {
      referenceNo: "ISS-DEMO-0003",
      category: "DRAINAGE" as const,
      title: "Blocked storm culvert inlet",
      description: "Silt and construction debris blocking roadside culvert grate prior to monsoon.",
      location: { addressLine: "Peradeniya Rd", district: "Kandy", province: "Central" },
      geometry: { type: "Point" as const, coordinates: [80.625, 7.285] },
      status: "SUBMITTED" as const,
      priority: "NORMAL" as const,
      publicMapVisible: false,
      secret: "demo-secret-0003",
    },
  ];

  for (const item of demoIssues) {
    const existing = await CitizenIssue.findOne({ referenceNo: item.referenceNo }).lean();
    if (!existing) {
      await CitizenIssue.create({
        referenceNo: item.referenceNo,
        trackingSecretHash: sha256(item.secret),
        category: item.category,
        title: item.title,
        description: item.description,
        location: item.location,
        geometry: item.geometry,
        assignedAgency: item.assignedAgency,
        status: item.status,
        priority: item.priority,
        publicMapVisible: item.publicMapVisible,
        isDemo: true,
        statusHistory: [{ toStatus: item.status, note: "Demo seeded issue", changedAt: new Date() }],
        publicMessages: [{ authorLabel: "InfraOS Demo", body: `Demo tracking record ${item.referenceNo}.`, createdAt: new Date() }],
      });
    }
  }
}

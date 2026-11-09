import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { Project } from "../modules/projects/models/project.model.js";
import { Milestone } from "../modules/projects/models/milestone.model.js";
import { ProgressReport } from "../modules/projects/models/progress-report.model.js";
import { ConflictRecord } from "../modules/roadsync/models/conflict-record.model.js";
import { DEMO_RISK_PROJECT_CODES } from "../database/seeds/demo/catalog.js";
import { seedDemoRiskProjects } from "../database/seeds/demo/seed-risk-demo.js";
import {
  assessProject,
  getProjectRiskHistory,
} from "../modules/risk/risk-assessment.service.js";
import { SYSTEM_RISK_ACTOR } from "../modules/risk/risk-scheduler.js";

async function main(): Promise<void> {
  console.log("=== InfraOS Real Risk Demo Sequence (§4.10) ===\n");

  if (!env.MONGODB_URI || !env.MONGODB_DB_NAME) {
    throw new Error("MONGODB_URI and MONGODB_DB_NAME are required");
  }

  await connectDatabase(env);

  try {
    // 1. Seed or re-seed the 8 clean demo projects
    console.log("Initializing synthetic demo projects...");
    await seedDemoRiskProjects();

    const delayedProj = await Project.findOne({
      projectCode: "INF-RISK_DELAYED-001",
    });
    const conflictProj = await Project.findOne({
      projectCode: "INF-RISK_CONFLICT-001",
    });

    if (!delayedProj || !conflictProj) {
      throw new Error("Required demo projects not found");
    }

    // Step 0: Initial assessment baseline
    console.log("\n[Step 0] Establishing initial risk baseline for all demo projects...");
    const demoProjects = await Project.find({
      projectCode: { $in: [...DEMO_RISK_PROJECT_CODES] },
    }).sort({ projectCode: 1 });

    for (const p of demoProjects) {
      const res = await assessProject(
        SYSTEM_RISK_ACTOR,
        p._id.toString(),
        "DEMO_SEQUENCE",
        new Date(),
        { force: true },
      );
      console.log(
        `  - ${p.projectCode.padEnd(24)} -> Level: ${res.assessment.overallLevel.padEnd(14)} (Index: ${res.assessment.overallIndex ?? "N/A"})`,
      );
    }

    // Step 1: Delayed Project - Milestone Resolution
    console.log(
      "\n[Step 1] Applying site recovery on INF-RISK_DELAYED-001: marking overdue milestone COMPLETED...",
    );
    await Milestone.updateOne(
      { projectId: delayedProj._id, status: "IN_PROGRESS" },
      { $set: { status: "COMPLETED", actualStart: new Date(Date.now() - 100 * 86400000), actualEnd: new Date() } },
    );

    const step1Res = await assessProject(
      SYSTEM_RISK_ACTOR,
      delayedProj._id.toString(),
      "DEMO_SEQUENCE",
      new Date(),
      { force: true },
    );

    console.log(`  Assessment No: ${step1Res.assessment.assessmentNo}`);
    console.log(`  New Level: ${step1Res.assessment.overallLevel}`);
    console.log(
      `  Changes Detected (${step1Res.assessment.changes?.length ?? 0}):`,
    );
    for (const ch of step1Res.assessment.changes ?? []) {
      console.log(`    * [${ch.type}] Indicator ${ch.code}: ${ch.from ?? "None"} -> ${ch.to ?? "None"}`);
    }

    // Step 2: Delayed Project - Progress Advance
    console.log(
      "\n[Step 2] Logging physical progress leap from 20% -> 45% on INF-RISK_DELAYED-001...",
    );
    delayedProj.physicalProgress = 45;
    await delayedProj.save();

    await ProgressReport.collection.insertOne({
      _id: new mongoose.Types.ObjectId(),
      projectId: delayedProj._id,
      sequence: 3,
      reportedPercent: 45,
      previousPercent: 20,
      note: "Major recovery works completed (Synthetic)",
      reporterUserId: delayedProj.createdBy,
      reportedAt: new Date(),
      createdAt: new Date(),
    });

    const step2Res = await assessProject(
      SYSTEM_RISK_ACTOR,
      delayedProj._id.toString(),
      "DEMO_SEQUENCE",
      new Date(),
      { force: true },
    );

    console.log(`  Assessment No: ${step2Res.assessment.assessmentNo}`);
    console.log(`  New Level: ${step2Res.assessment.overallLevel}`);
    console.log(
      `  Level Change: ${step2Res.assessment.levelChange?.from ?? "N/A"} -> ${step2Res.assessment.levelChange?.to ?? "N/A"}`,
    );
    console.log(
      `  Changes Detected (${step2Res.assessment.changes?.length ?? 0}):`,
    );
    for (const ch of step2Res.assessment.changes ?? []) {
      console.log(`    * [${ch.type}] Indicator ${ch.code}: ${ch.from ?? "None"} -> ${ch.to ?? "None"}`);
    }

    // Step 3: Conflict Project - Conflict Resolution
    console.log(
      "\n[Step 3] Resolving cross-agency RoadSync conflict on INF-RISK_CONFLICT-001...",
    );
    await ConflictRecord.updateOne(
      {
        $or: [
          { aId: conflictProj._id, aType: "project" },
          { bId: conflictProj._id, bType: "project" },
        ],
      },
      {
        $set: {
          status: "resolved",
          "resolution.resolvedAt": new Date(),
        },
      },
    );

    const step3Res = await assessProject(
      SYSTEM_RISK_ACTOR,
      conflictProj._id.toString(),
      "DEMO_SEQUENCE",
      new Date(),
      { force: true },
    );

    console.log(`  Assessment No: ${step3Res.assessment.assessmentNo}`);
    console.log(`  New Level: ${step3Res.assessment.overallLevel}`);
    console.log(
      `  Level Change: ${step3Res.assessment.levelChange?.from ?? "N/A"} -> ${step3Res.assessment.levelChange?.to ?? "N/A"}`,
    );
    console.log(
      `  Changes Detected (${step3Res.assessment.changes?.length ?? 0}):`,
    );
    for (const ch of step3Res.assessment.changes ?? []) {
      console.log(`    * [${ch.type}] Indicator ${ch.code}: ${ch.from ?? "None"} -> ${ch.to ?? "None"}`);
    }

    // Final: Query genuine history
    console.log(
      "\n[Verification] Querying generated append-only history for INF-RISK_DELAYED-001...",
    );
    const history = await getProjectRiskHistory(
      SYSTEM_RISK_ACTOR,
      delayedProj._id.toString(),
      { limit: 10 },
    );

    console.log(`  Total History Snapshots: ${history.items.length}`);
    for (const h of history.items) {
      console.log(
        `    - ${h.assessmentNo} [${h.createdAt.slice(11, 19)}] Level: ${(h.overallLevel ?? "N/A").padEnd(8)} Changes: ${h.changesCount}`,
      );
    }

    console.log("\n=== Demo Sequence Finished: Genuine transitions generated ===");
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error("Demo sequence failed:", err);
  process.exit(1);
});

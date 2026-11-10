/**
 * Batch 11 migration & index synchronization script for Risk Intelligence (Steps 119–123).
 *
 *   npm run risk:migrate
 *   npm run risk:migrate -- --commit
 *
 * Dry-run by default; pass --commit to apply index creation and backfill missing assessment numbers.
 */
import { connectDatabase, disconnectDatabase, sanitizeMongoError } from "../config/database.js";
import { env } from "../config/env.js";
import { Project } from "../modules/projects/models/project.model.js";
import {
  RiskAssessment,
  nextAssessmentNo,
} from "../modules/risk/models/risk-assessment.model.js";
import { RiskResolution } from "../modules/risk/models/risk-resolution.model.js";
import { RiskRun } from "../modules/risk/models/risk-run.model.js";

export type RiskMigrationReport = {
  mode: "dry-run" | "commit";
  indexesCreated: string[];
  assessmentsNormalized: number;
  projectsChecked: number;
};

export async function migrateRiskBatch11(commit: boolean): Promise<RiskMigrationReport> {
  const indexesCreated: string[] = [];

  if (commit) {
    await Project.createIndexes();
    indexesCreated.push("projects");
    await RiskAssessment.createIndexes();
    indexesCreated.push("riskAssessments");
    await RiskResolution.createIndexes();
    indexesCreated.push("riskResolutions");
    await RiskRun.createIndexes();
    indexesCreated.push("riskRuns");
  }

  // Find legacy riskAssessments without assessmentNo
  const legacyWithoutNo = await RiskAssessment.find({
    $or: [{ assessmentNo: { $exists: false } }, { assessmentNo: null }],
  }).select("_id createdAt");

  let assessmentsNormalized = 0;
  if (commit && legacyWithoutNo.length > 0) {
    for (const doc of legacyWithoutNo) {
      const no = await nextAssessmentNo(doc.createdAt ?? new Date());
      await RiskAssessment.collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            assessmentNo: no,
            engineVersion: "legacy",
            overallLevel: "NOT_ASSESSABLE",
            applicable: true,
          },
        },
      );
      assessmentsNormalized++;
    }
  } else {
    assessmentsNormalized = legacyWithoutNo.length;
  }

  const projectsChecked = await Project.countDocuments();

  return {
    mode: commit ? "commit" : "dry-run",
    indexesCreated: commit ? indexesCreated : ["(dry-run: Project, RiskAssessment, RiskResolution, RiskRun)"],
    assessmentsNormalized,
    projectsChecked,
  };
}

async function main(): Promise<void> {
  const commit = process.argv.includes("--commit");
  await connectDatabase(env);
  try {
    const report = await migrateRiskBatch11(commit);
    console.log(`INFRAOS risk Batch 11 migration (${report.mode}): PASS`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await disconnectDatabase();
  }
}

// Execute when run as script
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.includes("migrate-risk-batch11")) {
  main().catch(async (error: unknown) => {
    console.error("INFRAOS risk Batch 11 migration: FAIL");
    console.error(error instanceof Error ? sanitizeMongoError(error) : "unknown error");
    try {
      await disconnectDatabase();
    } catch {
      /* ignore */
    }
    process.exitCode = 1;
  });
}


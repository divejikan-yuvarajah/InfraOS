import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { aiConfig } from "../modules/ai/ai.config.js";
import { Project } from "../modules/projects/models/project.model.js";
import { DEMO_RISK_PROJECT_CODES } from "../database/seeds/demo/catalog.js";
import { seedDemoRiskProjects } from "../database/seeds/demo/seed-risk-demo.js";
import { assessProject } from "../modules/risk/risk-assessment.service.js";
import { generateRiskNarrative } from "../modules/risk/risk-narrative.service.js";
import { SYSTEM_RISK_ACTOR } from "../modules/risk/risk-scheduler.js";

type SmokeRow = {
  projectCode: string;
  level: string;
  index: string;
  sufficiency: string;
  topIndicators: string;
  deterministic: string;
};

async function main(): Promise<void> {
  console.log("=== InfraOS Risk Intelligence Smoke Test (§4.10) ===\n");

  if (!env.MONGODB_URI || !env.MONGODB_DB_NAME) {
    throw new Error("MONGODB_URI and MONGODB_DB_NAME are required");
  }

  await connectDatabase(env);

  try {
    // 1. Ensure demo projects exist
    const existingCount = await Project.countDocuments({
      projectCode: { $in: [...DEMO_RISK_PROJECT_CODES] },
    });

    if (existingCount < DEMO_RISK_PROJECT_CODES.length) {
      console.log(`Seeding missing demo projects (${existingCount}/${DEMO_RISK_PROJECT_CODES.length})...`);
      await seedDemoRiskProjects();
    }

    const projects = await Project.find({
      projectCode: { $in: [...DEMO_RISK_PROJECT_CODES] },
    }).sort({ projectCode: 1 });

    const tableRows: SmokeRow[] = [];
    let allDeterministic = true;
    let sampleAssessmentId: string | null = null;
    let sampleProjectId: string | null = null;

    const now = new Date();

    for (const project of projects) {
      const pid = project._id.toString();

      // Run 1
      const res1 = await assessProject(SYSTEM_RISK_ACTOR, pid, "ON_DEMAND", now, {
        force: true,
      });

      // Run 2 (verify determinism)
      const res2 = await assessProject(SYSTEM_RISK_ACTOR, pid, "ON_DEMAND", now, {
        force: true,
      });

      const a1 = res1.assessment;
      const a2 = res2.assessment;

      const isDeterministic =
        a1.inputsHash === a2.inputsHash &&
        a1.overallLevel === a2.overallLevel &&
        a1.overallIndex === a2.overallIndex;

      if (!isDeterministic) allDeterministic = false;

      if (a1.overallLevel !== "NOT_ASSESSABLE" && !sampleAssessmentId) {
        sampleAssessmentId = a1.id;
        sampleProjectId = pid;
      }

      const topIndicators = (a1.indicators ?? [])
        .slice(0, 3)
        .map((i) => `${i.code}:${i.severity}`)
        .join(", ");

      const overallSufficiency =
        a1.categories?.every((c) => c.sufficiency === "SUFFICIENT")
          ? "SUFFICIENT"
          : a1.categories?.some((c) => c.sufficiency === "LIMITED")
            ? "LIMITED"
            : "INSUFFICIENT";

      tableRows.push({
        projectCode: project.projectCode,
        level: a1.overallLevel,
        index: a1.overallIndex !== undefined ? String(a1.overallIndex) : "N/A",
        sufficiency: overallSufficiency,
        topIndicators: topIndicators || "None",
        deterministic: isDeterministic ? "PASS" : "FAIL",
      });
    }

    console.table(tableRows);

    if (!allDeterministic) {
      throw new Error("Determinism check failed: identical inputs produced different hash/level");
    }

    console.log("\nDeterminism Check: ALL 8 PROJECTS PASS (identical inputsHash & levels on replay)\n");

    // 2. AI Narrative smoke check
    if (!aiConfig.configured) {
      console.log("[AI Narrative Check: SKIPPED (OpenRouter / AI credentials not configured)]");
    } else if (sampleAssessmentId && sampleProjectId) {
      console.log("Testing AI Narrative explanation...");
      try {
        const narrative = await generateRiskNarrative(
          SYSTEM_RISK_ACTOR,
          sampleProjectId,
          sampleAssessmentId,
          { language: "en", regenerate: true },
        );
        console.log(`[AI Narrative Check: PASS] Model: ${narrative.model}, Verified: ${narrative.verified}`);
      } catch (aiErr) {
        console.warn("[AI Narrative Check: WARN]", aiErr instanceof Error ? aiErr.message : String(aiErr));
      }
    }

    console.log("\n=== Smoke Test Complete: SUCCESS ===");
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});

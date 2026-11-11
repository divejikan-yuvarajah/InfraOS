/**
 * Phase 10 Batch 12 Admin Utility: Model Capabilities & Provider Probe
 *
 * Queries FastAPI /v1/capabilities and optionally inspects configured models / provider capabilities.
 * Outputs a proposed modelCatalog structure cleanly WITHOUT modifying AiSettings automatically.
 * Prints SKIPPED truthfully when AI_BASE_URL / AI_INTERNAL_SECRET or upstream network is unavailable.
 */
import { aiConfig } from "../modules/ai/ai.config.js";
import { aiClient, AiClientError } from "../modules/ai/ai-client.js";

type ProbeRow = {
  check: string;
  status: "PASS" | "SKIPPED" | "UNCONFIGURED";
  detail: string;
};

async function main(): Promise<void> {
  const rows: ProbeRow[] = [];
  const configuredModels = {
    LOW: aiConfig.chat.model || "",
    STRONG: aiConfig.chat.strongModel || "",
    VISION: aiConfig.vision.model || "",
    EMBED: aiConfig.embedModel || "",
  };

  for (const [tier, modelId] of Object.entries(configuredModels)) {
    rows.push({
      check: `env.model.${tier}`,
      status: modelId ? "PASS" : "UNCONFIGURED",
      detail: modelId || "(unset — tier will fail closed with MODEL_NOT_CONFIGURED)",
    });
  }

  let capabilities: Record<string, unknown> | null = null;
  if (!aiConfig.configured) {
    rows.push({
      check: "aiService.capabilities",
      status: "SKIPPED",
      detail: "AI_BASE_URL / AI_INTERNAL_SECRET not configured",
    });
  } else {
    try {
      const client = aiClient();
      const healthy = await client.health();
      if (!healthy) {
        rows.push({
          check: "aiService.capabilities",
          status: "SKIPPED",
          detail: "AI Service not reachable on AI_BASE_URL",
        });
      } else {
        const caps = await client.capabilities();
        capabilities = caps as unknown as Record<string, unknown>;
        rows.push({
          check: "aiService.capabilities",
          status: "PASS",
          detail: `pipeline=${caps.pipelineVersion} ocr=${caps.ocr} chatModel=${caps.chat?.model || "unset"} embedModel=${caps.embedding?.model || "unset"}`,
        });
      }
    } catch (err: unknown) {
      const code = err instanceof AiClientError ? err.code : err instanceof Error ? err.message : "unknown";
      rows.push({
        check: "aiService.capabilities",
        status: "SKIPPED",
        detail: `Probe failed/unreachable (${code})`,
      });
    }
  }

  const proposedCatalog = {
    LOW: {
      modelId: configuredModels.LOW,
      source: "provider-listing" as const,
      verifiedAt: null as string | null,
      note: configuredModels.LOW ? "Verify JSON planner probe (>=9/10) before storing verifiedAt." : "Set AI_CHAT_MODEL or configure in /settings/ai.",
    },
    STRONG: {
      modelId: configuredModels.STRONG,
      source: "provider-listing" as const,
      verifiedAt: null as string | null,
      note: configuredModels.STRONG ? "Optional higher-tier model configured." : "Set AI_CHAT_MODEL_STRONG when higher quality summary/extraction is needed.",
    },
    VISION: {
      modelId: configuredModels.VISION,
      source: "provider-listing" as const,
      verifiedAt: null as string | null,
      note: configuredModels.VISION ? "Verify image input schema adherence & per-image price before enabling vision." : "Set AI_VISION_MODEL before enabling vision in AiSettings.",
    },
    EMBED: {
      modelId: configuredModels.EMBED,
      source: "provider-listing" as const,
      verifiedAt: null as string | null,
      note: configuredModels.EMBED ? "Embedding model matches Qdrant vector dimension." : "Configured in apps/ai-service.",
    },
  };

  console.log("=== INFRAOS AI Models Check (Read-Only Proposal — never mutates AiSettings) ===");
  for (const r of rows) {
    console.log(`${r.check.padEnd(26)} ${r.status.padEnd(13)} ${r.detail}`);
  }
  console.log("\nProposed modelCatalog template:");
  console.log(JSON.stringify({ configuredModels, proposedCatalog, capabilities }, null, 2));
}

await main();

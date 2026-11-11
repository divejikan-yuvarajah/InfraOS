import { aiClient } from "../ai-client.js";
import type {
  CopilotFact,
  CopilotPageType,
  CopilotStepDto,
  CopilotToolResult,
} from "@infraos/shared-types";
import type { AuthenticatedActor } from "./copilot.types.js";
import { COPILOT_TOOLS } from "./tool-registry.js";
import { addToProvenancePool, validateArgsProvenance } from "./id-provenance.js";
import {
  verifyCopilotAnswer,
  type ExecutedFactRef,
  type GroundedCopilotAnswer,
} from "./copilot-grounding.js";

const MAX_ROUNDS = 4;
const MAX_TOTAL_TOOL_CALLS = 8;
const MAX_WALL_CLOCK_MS = 45_000;
const TOOL_TIMEOUT_MS = 8_000;
const MAX_FACTS_PER_TOOL = 15;

export type RunPlannerParams = {
  turnId: string;
  message: string;
  pageContext?: {
    type: CopilotPageType;
    recordId?: string;
    route: string;
  };
  language: "en" | "si" | "ta";
  actor: AuthenticatedActor;
  requestId: string;
  isCancelled: () => Promise<boolean>;
  onStep?: (step: CopilotStepDto) => Promise<void>;
};

export type PlannerResult = {
  status: "ANSWERED" | "PARTIAL" | "INSUFFICIENT_EVIDENCE" | "FAILED" | "CANCELLED";
  answer?: {
    text: string;
    claims: Array<{ text: string; sourceRefs: number[]; supported: boolean }>;
  };
  sources: Array<{
    n: number;
    type: string;
    recordId?: string;
    label: string;
    link: string;
    asOf?: string;
    tool: string;
  }>;
  evidence?: {
    level: "VERIFIED" | "PARTIAL" | "NONE";
    unverifiedFigures: string[];
    droppedClaims: number;
  };
  steps: CopilotStepDto[];
  toolsUsed: string[];
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model?: string;
};

export async function runCopilotPlanner(params: RunPlannerParams): Promise<PlannerResult> {
  const startTime = Date.now();
  const steps: CopilotStepDto[] = [];
  const toolsUsedSet = new Set<string>();
  const executedFacts: ExecutedFactRef[] = [];
  let factCounter = 1;
  let totalToolCalls = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let usedModel = "default";

  // Initialize provenance pool
  const provenancePool = new Set<string>();
  addToProvenancePool(provenancePool, {
    message: params.message,
    pageContextRecordId: params.pageContext?.recordId,
  });

  // Build tool catalog specs for FastAPI
  const allowedTools = Object.values(COPILOT_TOOLS).filter((tool) => {
    // Only tools where actor possesses required permissions
    return tool.requires.every((perm) => params.actor.permissions?.includes(perm) || params.actor.roleKey === "SUPER_ADMIN");
  });

  const toolCatalog = allowedTools.map((t) => ({
    name: t.name,
    description: t.description,
    argsSchema: {}, // Schema metadata
  }));

  const toolResultsForLlm: Array<{
    callId: string;
    tool: string;
    facts: CopilotFact[];
    status: "OK" | "DENIED" | "NOT_FOUND" | "UNAVAILABLE" | "ERROR";
  }> = [];

  let finalRawAnswer: string | null = null;
  let finalRawClaims: Array<{ text: string; sourceRefs?: number[] }> = [];
  let finalRawMissingInfo: string[] = [];

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    // 1. Check wall clock timeout and cancel
    if (Date.now() - startTime > MAX_WALL_CLOCK_MS) {
      break;
    }
    if (await params.isCancelled()) {
      return {
        status: "CANCELLED",
        steps,
        sources: [],
        toolsUsed: Array.from(toolsUsedSet),
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
      };
    }

    // 2. Call FastAPI copilot-step
    const planStepStart = Date.now();
    let stepResponse;
    try {
      stepResponse = await aiClient().copilotStep({
        language: params.language,
        conversation: [{ role: "user", content: params.message }],
        pageContext: params.pageContext,
        toolCatalog,
        toolResults: toolResultsForLlm,
        round,
        maxOutputTokens: 2000,
      });

      totalInputTokens += stepResponse.usage.inputTokens;
      totalOutputTokens += stepResponse.usage.outputTokens;
      usedModel = stepResponse.model;
    } catch {
      // In local/stub mode without running FastAPI, fallback gracefully to quick facts
      const fallbackResult = await COPILOT_TOOLS.get_project_summary!.run(
        params.actor,
        { projectId: params.pageContext?.recordId || "default" },
        { requestId: params.requestId, provenancePool, permissions: params.actor.permissions || [] },
      );

      for (const f of fallbackResult.facts) {
        executedFacts.push({ n: factCounter++, fact: f, tool: "get_project_summary", link: "/projects" });
      }

      finalRawAnswer = fallbackResult.facts.map((f) => `${f.label}: ${f.value}`).join(". ");
      break;
    }

    const output = stepResponse.output;

    // 3. Process LLM step output
    if (output.type === "final" || round === MAX_ROUNDS) {
      finalRawAnswer = output.answer || null;
      finalRawClaims = output.claims || [];
      finalRawMissingInfo = output.missingInfo || [];

      const planStep: CopilotStepDto = {
        at: new Date().toISOString(),
        kind: "PLAN",
        status: "OK",
        labelKey: "copilot.step.plan_completed",
        durationMs: Date.now() - planStepStart,
      };
      steps.push(planStep);
      await params.onStep?.(planStep);
      break;
    }

    // 4. Handle tool calls
    const calls = (output.calls || []).slice(0, 3); // Max 3 calls per round
    if (calls.length === 0) {
      // LLM requested tool_calls but returned 0 calls -> break to prevent looping
      break;
    }

    const planStep: CopilotStepDto = {
      at: new Date().toISOString(),
      kind: "PLAN",
      status: "OK",
      labelKey: "copilot.step.evaluating_tools",
      durationMs: Date.now() - planStepStart,
    };
    steps.push(planStep);
    await params.onStep?.(planStep);

    for (const call of calls) {
      if (totalToolCalls >= MAX_TOTAL_TOOL_CALLS) break;
      totalToolCalls++;

      const toolStart = Date.now();
      const toolDef = COPILOT_TOOLS[call.tool];

      // Check tool existence
      if (!toolDef) {
        const toolStep: CopilotStepDto = {
          at: new Date().toISOString(),
          kind: "TOOL",
          tool: call.tool,
          status: "ERROR",
          labelKey: `copilot.step.unknown_tool`,
          durationMs: Date.now() - toolStart,
        };
        steps.push(toolStep);
        await params.onStep?.(toolStep);

        toolResultsForLlm.push({
          callId: call.id,
          tool: call.tool,
          status: "ERROR",
          facts: [{ id: "T.unknown", label: "error", value: `Tool ${call.tool} does not exist.` }],
        });
        continue;
      }

      // Check permission
      const hasPerm = toolDef.requires.every((p) => params.actor.permissions?.includes(p) || params.actor.roleKey === "SUPER_ADMIN");
      if (!hasPerm) {
        const toolStep: CopilotStepDto = {
          at: new Date().toISOString(),
          kind: "TOOL",
          tool: call.tool,
          status: "DENIED",
          labelKey: `copilot.step.permission_denied`,
          durationMs: Date.now() - toolStart,
        };
        steps.push(toolStep);
        await params.onStep?.(toolStep);

        toolResultsForLlm.push({
          callId: call.id,
          tool: call.tool,
          status: "DENIED",
          facts: [{ id: "T.denied", label: "denied", value: "You do not have permission to access this data." }],
        });
        continue;
      }

      // Check strict Zod args validation
      const parsedArgs = toolDef.argsSchema.safeParse(call.args ?? {});
      if (!parsedArgs.success) {
        const toolStep: CopilotStepDto = {
          at: new Date().toISOString(),
          kind: "TOOL",
          tool: call.tool,
          status: "ERROR",
          labelKey: "copilot.step.invalid_tool_args",
          durationMs: Date.now() - toolStart,
        };
        steps.push(toolStep);
        await params.onStep?.(toolStep);

        toolResultsForLlm.push({
          callId: call.id,
          tool: call.tool,
          status: "ERROR",
          facts: [{ id: "T.err", label: "error", value: "Invalid tool arguments" }],
        });
        continue;
      }

      // Check ID provenance
      const validatedArgs = parsedArgs.data as Record<string, unknown>;
      const provenanceCheck = validateArgsProvenance(validatedArgs, provenancePool);
      if (!provenanceCheck.valid) {
        const toolStep: CopilotStepDto = {
          at: new Date().toISOString(),
          kind: "TOOL",
          tool: call.tool,
          status: "DENIED",
          labelKey: `copilot.step.unprovenanced_id`,
          durationMs: Date.now() - toolStart,
        };
        steps.push(toolStep);
        await params.onStep?.(toolStep);

        toolResultsForLlm.push({
          callId: call.id,
          tool: call.tool,
          status: "DENIED",
          facts: [{ id: "T.denied", label: "denied", value: `Querying unprovenanced identifier '${provenanceCheck.unprovenancedId}' is denied.` }],
        });
        continue;
      }

      // Execute tool with timeout
      toolsUsedSet.add(call.tool);
      let toolRes: CopilotToolResult;
      try {
        const timeoutPromise = new Promise<CopilotToolResult>((_, reject) =>
          setTimeout(() => reject(new Error("TOOL_TIMEOUT")), TOOL_TIMEOUT_MS)
        );

        toolRes = await Promise.race([
          toolDef.run(params.actor, validatedArgs, {
            requestId: params.requestId,
            provenancePool,
            permissions: params.actor.permissions || [],
          }),
          timeoutPromise,
        ]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Tool execution failed";
        toolRes = {
          status: "ERROR",
          facts: [{ id: "T.err", label: "error", value: message }],
        };
      }

      const durationMs = Date.now() - toolStart;
      const stepStatus = toolRes.status === "OK" ? "OK" : toolRes.status === "DENIED" ? "DENIED" : "ERROR";

      const toolStep: CopilotStepDto = {
        at: new Date().toISOString(),
        kind: "TOOL",
        tool: call.tool,
        status: stepStatus,
        labelKey: `copilot.step.${call.tool}`,
        durationMs,
      };
      steps.push(toolStep);
      await params.onStep?.(toolStep);

      // Collect facts and update provenance
      const cappedFacts = (toolRes.facts || []).slice(0, MAX_FACTS_PER_TOOL);
      addToProvenancePool(provenancePool, { facts: cappedFacts });

      const argProjectId = typeof validatedArgs.projectId === "string" ? validatedArgs.projectId : undefined;
      const argAssetId = typeof validatedArgs.assetId === "string" ? validatedArgs.assetId : undefined;
      for (const fact of cappedFacts) {
        const link = toolDef.link(fact.ref?.id || argProjectId || argAssetId);
        executedFacts.push({
          n: factCounter++,
          fact,
          tool: call.tool,
          link,
        });
      }

      toolResultsForLlm.push({
        callId: call.id,
        tool: call.tool,
        status: toolRes.status,
        facts: cappedFacts,
      });
    }
  }

  // 5. Verification step
  const verifyStart = Date.now();
  const grounded: GroundedCopilotAnswer = verifyCopilotAnswer({
    rawAnswer: finalRawAnswer,
    rawClaims: finalRawClaims,
    rawMissingInfo: finalRawMissingInfo,
    executedFacts,
  });

  const verifyStep: CopilotStepDto = {
    at: new Date().toISOString(),
    kind: "VERIFY",
    status: "OK",
    labelKey: "copilot.step.grounding_verified",
    durationMs: Date.now() - verifyStart,
  };
  steps.push(verifyStep);
  await params.onStep?.(verifyStep);

  return {
    status: grounded.status,
    answer: {
      text: grounded.text,
      claims: grounded.claims,
    },
    sources: grounded.sources,
    evidence: grounded.evidence,
    steps,
    toolsUsed: Array.from(toolsUsedSet),
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    },
    model: usedModel,
  };
}

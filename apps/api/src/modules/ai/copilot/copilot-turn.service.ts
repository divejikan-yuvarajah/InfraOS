import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import type {
  CopilotPageType,
  CopilotTurnDto,
  CopilotTurnStatus,
} from "@infraos/shared-types";
import { AiInteraction } from "../rag/interaction.model.js";
import { checkGate, recordGate } from "../governance/ai-gate.js";
import { AuditLog } from "../../audit/models/audit-log.model.js";
import { detectLanguage } from "../rag/rag.service.js";
import type { AuthenticatedActor } from "./copilot.types.js";
import { runCopilotPlanner } from "./copilot-planner.js";

export class CopilotError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "CopilotError";
  }
}

export type CreateTurnInput = {
  message: string;
  threadId?: string;
  pageContext?: {
    type: CopilotPageType;
    recordId?: string;
    route: string;
  };
};

export async function createCopilotTurn(
  actor: AuthenticatedActor,
  input: CreateTurnInput,
  requestId: string,
): Promise<{ turnId: string; threadId: string; status: CopilotTurnStatus }> {
  const cleanMessage = input.message.trim();
  if (cleanMessage.length === 0 || cleanMessage.length > 800) {
    throw new CopilotError(400, "INVALID_MESSAGE_LENGTH", {
      message: "Message must be between 1 and 800 characters",
    });
  }

  // 1. Central Gate Check
  const gate = await checkGate({
    actor,
    agencyId: actor.agencyId,
    feature: "copilot",
    tier: "LOW",
    estimate: { inputTokens: 1000, outputTokens: 800, costUnits: 3 },
  });

  if (!gate.allow) {
    if (gate.deny.code === "FEATURE_DISABLED") {
      throw new CopilotError(403, "FEATURE_DISABLED", { message: gate.deny.message });
    }
    if (gate.deny.code === "AI_CONCURRENCY_EXCEEDED") {
      throw new CopilotError(429, "AI_CONCURRENCY_EXCEEDED", {
        message: "Only 1 active copilot turn is allowed per user.",
      });
    }
    if (gate.deny.code === "AI_BUDGET_EXCEEDED") {
      throw new CopilotError(429, "AI_BUDGET_EXCEEDED", { resetsAt: gate.deny.resetsAt });
    }
    if (gate.deny.code === "AI_RATE_LIMITED") {
      throw new CopilotError(429, "AI_RATE_LIMITED", { retryAfterSeconds: gate.deny.retryAfterSeconds });
    }
    throw new CopilotError(503, "AI_UNAVAILABLE", { reason: gate.deny.code });
  }

  const threadId = input.threadId && /^[a-f0-9-]{36}$/.test(input.threadId) ? input.threadId : randomUUID();
  const language = detectLanguage(cleanMessage);

  // 30 days retention per §4.3
  const expiresAt = new Date(Date.now() + 30 * 86_400_000);

  // 2. Create interaction row as RUNNING
  const interaction = await AiInteraction.create({
    kind: "COPILOT",
    userId: new mongoose.Types.ObjectId(actor.userId),
    agencyId: actor.agencyId ? new mongoose.Types.ObjectId(actor.agencyId) : undefined,
    threadId,
    message: cleanMessage,
    question: cleanMessage,
    language,
    status: "RUNNING",
    pageContext: input.pageContext,
    steps: [],
    sources: [],
    toolsUsed: [],
    cancelRequested: false,
    evidence: {
      level: "NONE",
      unverifiedFigures: [],
      droppedClaims: 0,
      quotesVerified: 0,
      quotesTotal: 0,
    },
    expiresAt,
  });

  const turnId = interaction._id.toString();

  // Audit turn started
  await AuditLog.create({
    action: "ai.copilot_turn_started",
    actorUserId: new mongoose.Types.ObjectId(actor.userId),
    resourceType: "AiInteraction",
    resourceId: interaction._id,
    agencyId: interaction.agencyId,
    metadata: { requestId, threadId },
  }).catch(() => undefined);

  // 3. Spawn background execution
  setImmediate(async () => {
    try {
      const plannerResult = await runCopilotPlanner({
        turnId,
        message: cleanMessage,
        pageContext: input.pageContext,
        language,
        actor,
        requestId,
        isCancelled: async () => {
          const fresh = await AiInteraction.findById(turnId).select("cancelRequested").lean();
          return Boolean(fresh?.cancelRequested);
        },
        onStep: async (step) => {
          await AiInteraction.updateOne(
            { _id: interaction._id },
            { $push: { steps: step as any } },
          ).catch(() => undefined);
        },
      });

      // Update interaction on completion
      await AiInteraction.updateOne(
        { _id: interaction._id },
        {
          $set: {
            status: plannerResult.status,
            answer: plannerResult.answer,
            sources: plannerResult.sources as any,
            evidence: plannerResult.evidence as any,
            toolsUsed: plannerResult.toolsUsed,
            usage: plannerResult.usage,
            model: plannerResult.model,
          },
        },
      );

      // Record gate usage
      await recordGate({
        actor,
        agencyId: actor.agencyId,
        feature: "copilot",
        tier: "LOW",
        model: plannerResult.model || "default",
        actual: {
          status: plannerResult.status === "FAILED" ? "ERROR" : "OK",
          inputTokens: plannerResult.usage.inputTokens,
          outputTokens: plannerResult.usage.outputTokens,
          costUnits: 3,
          latencyMs: 1000,
        },
      }).catch(() => undefined);

      await AuditLog.create({
        action: "ai.copilot_turn_completed",
        actorUserId: new mongoose.Types.ObjectId(actor.userId),
        resourceType: "AiInteraction",
        resourceId: interaction._id,
        agencyId: interaction.agencyId,
        metadata: { requestId, threadId, status: plannerResult.status },
      }).catch(() => undefined);
    } catch (err: any) {
      await AiInteraction.updateOne(
        { _id: interaction._id },
        {
          $set: {
            status: "FAILED",
            errorCode: err.message || "PLANNER_ERROR",
          },
        },
      ).catch(() => undefined);

      await recordGate({
        actor,
        agencyId: actor.agencyId,
        feature: "copilot",
        tier: "LOW",
        model: "none",
        actual: {
          status: "ERROR",
          inputTokens: 0,
          outputTokens: 0,
          costUnits: 3,
          latencyMs: 1000,
        },
      }).catch(() => undefined);
    }
  });

  return { turnId, threadId, status: "RUNNING" };
}

export async function getCopilotTurn(actor: AuthenticatedActor, turnId: string): Promise<CopilotTurnDto> {
  if (!mongoose.Types.ObjectId.isValid(turnId)) {
    throw new CopilotError(404, "NOT_FOUND");
  }

  // Hard privacy rule: Only the author can read their interaction
  const interaction = await AiInteraction.findOne({
    _id: new mongoose.Types.ObjectId(turnId),
    userId: new mongoose.Types.ObjectId(actor.userId),
    kind: "COPILOT",
  }).lean();

  if (!interaction) {
    throw new CopilotError(404, "NOT_FOUND");
  }

  return {
    id: interaction._id.toString(),
    threadId: interaction.threadId,
    message: interaction.message || interaction.question || "",
    pageContext: interaction.pageContext as any,
    status: interaction.status as CopilotTurnStatus,
    steps: (interaction.steps || []).map((s: any) => ({
      at: s.at instanceof Date ? s.at.toISOString() : String(s.at),
      kind: s.kind,
      tool: s.tool,
      status: s.status,
      labelKey: s.labelKey,
      durationMs: s.durationMs ?? 0,
    })),
    answer: interaction.answer
      ? {
          text: interaction.answer.text || "",
          claims: (interaction.answer.claims || []).map((c: any) => ({
            text: c.text,
            sourceRefs: c.sourceRefs || c.citationNs || [],
            supported: Boolean(c.supported),
          })),
        }
      : undefined,
    sources: (interaction.sources || []).map((src: any) => ({
      n: src.n,
      type: src.type,
      recordId: src.recordId,
      label: src.label,
      link: src.link,
      asOf: src.asOf instanceof Date ? src.asOf.toISOString() : undefined,
      tool: src.tool,
    })),
    evidence: interaction.evidence as any,
    toolsUsed: interaction.toolsUsed || [],
    usage: interaction.usage ? { inputTokens: interaction.usage.inputTokens, outputTokens: interaction.usage.outputTokens } : undefined,
    model: interaction.model ?? undefined,
    createdAt: interaction.createdAt ? interaction.createdAt.toISOString() : new Date().toISOString(),
  };
}

export async function cancelCopilotTurn(actor: AuthenticatedActor, turnId: string): Promise<{ cancelled: boolean }> {
  if (!mongoose.Types.ObjectId.isValid(turnId)) {
    throw new CopilotError(404, "NOT_FOUND");
  }

  const result = await AiInteraction.updateOne(
    {
      _id: new mongoose.Types.ObjectId(turnId),
      userId: new mongoose.Types.ObjectId(actor.userId),
      kind: "COPILOT",
    },
    { $set: { cancelRequested: true } },
  );

  return { cancelled: result.matchedCount > 0 };
}

export async function listCopilotThreads(actor: AuthenticatedActor): Promise<{
  threads: Array<{ threadId: string; title: string; lastAt: string; turnsCount: number }>;
}> {
  const rows = await AiInteraction.aggregate<{
    _id: string;
    title: string;
    lastAt: Date;
    count: number;
  }>([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(actor.userId),
        kind: "COPILOT",
      },
    },
    {
      $group: {
        _id: "$threadId",
        title: { $first: "$message" },
        lastAt: { $max: "$createdAt" },
        count: { $sum: 1 },
      },
    },
    { $sort: { lastAt: -1 } },
    { $limit: 30 },
  ]);

  return {
    threads: rows.map((r) => ({
      threadId: r._id,
      title: r.title ? (r.title.length > 50 ? `${r.title.slice(0, 47)}...` : r.title) : "New Conversation",
      lastAt: r.lastAt ? r.lastAt.toISOString() : new Date().toISOString(),
      turnsCount: r.count,
    })),
  };
}

export async function deleteCopilotThread(actor: AuthenticatedActor, threadId: string): Promise<{ deleted: boolean }> {
  const result = await AiInteraction.deleteMany({
    userId: new mongoose.Types.ObjectId(actor.userId),
    threadId,
    kind: "COPILOT",
  });
  return { deleted: result.deletedCount > 0 };
}

/**
 * Reconciles stale RUNNING turns (> 120s) to FAILED (TURN_TIMEOUT) for server restart safety.
 */
export async function reconcileStaleCopilotTurns(): Promise<number> {
  const cutoff = new Date(Date.now() - 120_000);
  const result = await AiInteraction.updateMany(
    {
      kind: "COPILOT",
      status: "RUNNING",
      createdAt: { $lt: cutoff },
    },
    {
      $set: {
        status: "FAILED",
        errorCode: "TURN_TIMEOUT",
      },
    },
  );
  return result.modifiedCount;
}

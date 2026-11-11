import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { AI_FEATURE_KEYS } from "@infraos/shared-types";
import { success, failure } from "../../../shared/http/envelope.js";
import { noStore } from "../../contractors/contractor.http.js";
import { parseStrict as parseStrictSchema } from "../../contractors/contractor.schema.js";
import { readSingleBearer, requireAuthenticated } from "../../identity/auth/require-authenticated.js";
import { verifyAccessToken } from "../../identity/auth/jwt.js";
import { User } from "../../identity/models/user.model.js";
import { requireAnyPermission, requirePermission } from "../../identity/authorization/require-permission.js";
import {
  getMyLimits,
  getMyUsage,
  getAgencyUsage,
  getAiAudit,
  exportAiAuditCsv,
  getSettings,
  updateSettings,
  resetSettings,
  checkModelsProbe,
  getAboutAi,
  GovernanceError,
} from "./ai-governance.service.js";

export const aiGovernanceRouter = Router();

const anyAiPerm = requireAnyPermission(
  "copilot.use",
  "document.ask",
  "risk.read",
  "inspection.verify",
  "inspection.submit",
  "ai.manage",
);

const authManage = [requireAuthenticated, requirePermission("ai.manage")];
const authAnyAi = [requireAuthenticated, anyAiPerm];

const objectIdString = z.string().regex(/^[a-f0-9]{24}$/i);
const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const featureEnum = z.enum(AI_FEATURE_KEYS as unknown as [string, ...string[]]);

const agencyUsageQuerySchema = z.object({
  from: dayString.optional(),
  to: dayString.optional(),
  feature: featureEnum.optional(),
  agencyId: objectIdString.optional(),
}).strict();

const auditQuerySchema = z.object({
  from: dayString.optional(),
  to: dayString.optional(),
  feature: featureEnum.optional(),
  status: z.enum(["OK", "ERROR", "RATE_LIMITED"]).optional(),
  limit: z.string().regex(/^\d{1,3}$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  cursor: objectIdString.optional(),
}).strict();

const settingsQuerySchema = z.object({
  agencyId: objectIdString.optional(),
}).strict();

const featureTogglesSchema = z.object({
  qa: z.boolean().optional(),
  summary: z.boolean().optional(),
  extraction: z.boolean().optional(),
  riskNarrative: z.boolean().optional(),
  vision: z.boolean().optional(),
  copilot: z.boolean().optional(),
  embedding: z.boolean().optional(),
}).strict();

const perFeatureLimitMap = (max: number) => z.object({
  qa: z.number().int().min(1).max(max).optional(),
  summary: z.number().int().min(1).max(max).optional(),
  extraction: z.number().int().min(1).max(max).optional(),
  riskNarrative: z.number().int().min(1).max(max).optional(),
  vision: z.number().int().min(1).max(max).optional(),
  copilot: z.number().int().min(1).max(max).optional(),
  embedding: z.number().int().min(1).max(max).optional(),
}).strict();

const dailyBudgetMap = z.object({
  LOW: z.number().int().min(1000).max(1_000_000_000).optional(),
  STRONG: z.number().int().min(1000).max(1_000_000_000).optional(),
  VISION: z.number().int().min(1000).max(1_000_000_000).optional(),
  EMBED: z.number().int().min(1000).max(1_000_000_000).optional(),
}).strict();

const catalogEntrySchema = z.object({
  modelId: z.string().max(160),
  verifiedAt: z.string().optional(),
  source: z.enum(["admin-entered", "provider-listing"]).optional(),
  pricePerMInputMinor: z.number().int().nonnegative().optional(),
  pricePerMOutputMinor: z.number().int().nonnegative().optional(),
  pricePerImageMinor: z.number().int().nonnegative().optional(),
}).strict();

const updateSettingsBody = z.object({
  scope: z.enum(["PLATFORM", "AGENCY"]).optional(),
  agencyId: objectIdString.optional(),
  version: z.number().int().min(1),
  featureToggles: featureTogglesSchema.optional(),
  limits: z.object({
    userRequestsPer10Min: perFeatureLimitMap(500).optional(),
    agencyRequestsPerDay: perFeatureLimitMap(100_000).optional(),
    concurrencyPerUser: z.number().int().min(1).max(5).optional(),
  }).strict().optional(),
  budgets: z.object({
    dailyTokenBudget: dailyBudgetMap.optional(),
    dailyVisionImages: z.number().int().min(0).max(100_000).optional(),
  }).strict().optional(),
  modelCatalog: z.object({
    LOW: catalogEntrySchema.optional(),
    STRONG: catalogEntrySchema.optional(),
    VISION: catalogEntrySchema.optional(),
    EMBED: catalogEntrySchema.optional(),
  }).strict().optional(),
  routing: z.object({
    strongSummaryInputThreshold: z.number().int().min(1000).max(500_000).optional(),
    autoDowngradeAtBudgetPercent: z.number().int().min(10).max(100).optional(),
  }).strict().optional(),
}).strict();

const resetSettingsBody = z.object({
  scope: z.enum(["PLATFORM", "AGENCY"]).optional(),
  agencyId: objectIdString.optional(),
}).strict();

function sendGovError(res: Response, req: Request, err: unknown, fallbackMsg: string): void {
  noStore(res);
  if (err instanceof GovernanceError) {
    res.status(err.statusCode).json(failure(err.code, err.message, req.requestId));
    return;
  }
  res.status(500).json(failure("INTERNAL_ERROR", err instanceof Error ? err.message : fallbackMsg, req.requestId));
}

aiGovernanceRouter.get("/limits/me", ...authAnyAi, async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor!;
    const data = await getMyLimits({
      userId: actor.userId,
      agencyId: actor.agencyId,
      roleKey: actor.roleKey,
    });
    res.status(200).json(success(data, req.requestId));
  } catch (err) {
    sendGovError(res, req, err, "Failed to load limits");
  }
});

aiGovernanceRouter.get("/usage/me", ...authAnyAi, async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor!;
    const data = await getMyUsage({
      userId: actor.userId,
      agencyId: actor.agencyId,
      roleKey: actor.roleKey,
    });
    res.status(200).json(success(data, req.requestId));
  } catch (err) {
    sendGovError(res, req, err, "Failed to load personal usage");
  }
});

aiGovernanceRouter.get("/usage/agency", ...authManage, async (req, res) => {
  try {
    noStore(res);
    const q = parseStrictSchema(agencyUsageQuerySchema, req.query);
    if (!q) {
      res.status(400).json(failure("VALIDATION_ERROR", "Invalid agency usage query", req.requestId));
      return;
    }
    const actor = req.actor!;
    const data = await getAgencyUsage(
      { userId: actor.userId, agencyId: actor.agencyId, roleKey: actor.roleKey },
      q,
    );
    res.status(200).json(success(data, req.requestId));
  } catch (err) {
    sendGovError(res, req, err, "Failed to load agency usage");
  }
});

aiGovernanceRouter.get("/audit", ...authManage, async (req, res) => {
  try {
    noStore(res);
    const q = parseStrictSchema(auditQuerySchema, req.query);
    if (!q) {
      res.status(400).json(failure("VALIDATION_ERROR", "Invalid audit query", req.requestId));
      return;
    }
    const actor = req.actor!;
    const data = await getAiAudit(
      { userId: actor.userId, agencyId: actor.agencyId, roleKey: actor.roleKey },
      q,
    );
    res.status(200).json(success(data, req.requestId));
  } catch (err) {
    sendGovError(res, req, err, "Failed to load AI audit records");
  }
});

aiGovernanceRouter.get(
  "/audit/export.csv",
  requireAuthenticated,
  requirePermission("ai.manage"),
  requirePermission("report.export"),
  async (req, res) => {
    try {
      noStore(res);
      const q = parseStrictSchema(auditQuerySchema, req.query);
      if (!q) {
        res.status(400).json(failure("VALIDATION_ERROR", "Invalid audit export query", req.requestId));
        return;
      }
      const actor = req.actor!;
      const csv = await exportAiAuditCsv(
        { userId: actor.userId, agencyId: actor.agencyId, roleKey: actor.roleKey },
        q,
        req.requestId,
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ai-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.status(200).send(csv);
    } catch (err) {
      sendGovError(res, req, err, "Failed to export AI audit records");
    }
  },
);

aiGovernanceRouter.get("/settings", ...authAnyAi, async (req, res) => {
  try {
    noStore(res);
    const q = parseStrictSchema(settingsQuerySchema, req.query);
    if (!q) {
      res.status(400).json(failure("VALIDATION_ERROR", "Invalid settings query", req.requestId));
      return;
    }
    const actor = req.actor!;
    const data = await getSettings(
      { userId: actor.userId, agencyId: actor.agencyId, roleKey: actor.roleKey },
      q.agencyId,
    );
    res.status(200).json(success(data, req.requestId));
  } catch (err) {
    sendGovError(res, req, err, "Failed to load settings");
  }
});

aiGovernanceRouter.put("/settings", ...authManage, async (req, res) => {
  noStore(res);
  const parsed = updateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(failure("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid settings payload", req.requestId));
    return;
  }

  try {
    const actor = req.actor!;
    const targetScope = parsed.data.scope ?? (actor.roleKey === "SUPER_ADMIN" ? "PLATFORM" : "AGENCY");
    const updated = await updateSettings(
      { userId: actor.userId, agencyId: actor.agencyId, roleKey: actor.roleKey },
      targetScope,
      parsed.data,
      req.requestId,
    );
    res.status(200).json(success(updated, req.requestId));
  } catch (err) {
    sendGovError(res, req, err, "Failed to update settings");
  }
});

aiGovernanceRouter.put("/settings/agency/:id", ...authManage, async (req, res) => {
  noStore(res);
  const parsed = updateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(failure("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid settings payload", req.requestId));
    return;
  }

  try {
    const actor = req.actor!;
    const agencyId = String(req.params.id);
    if (!/^[a-f0-9]{24}$/i.test(agencyId)) {
      res.status(400).json(failure("VALIDATION_ERROR", "Invalid agency ID", req.requestId));
      return;
    }
    if (actor.roleKey !== "SUPER_ADMIN" && actor.agencyId !== agencyId) {
      res.status(403).json(failure("FORBIDDEN", "Cannot modify settings for another agency", req.requestId));
      return;
    }

    const updated = await updateSettings(
      { userId: actor.userId, agencyId: actor.agencyId, roleKey: actor.roleKey },
      "AGENCY",
      { ...parsed.data, agencyId },
      req.requestId,
    );
    res.status(200).json(success(updated, req.requestId));
  } catch (err) {
    sendGovError(res, req, err, "Failed to update agency settings");
  }
});

aiGovernanceRouter.post("/settings/reset", ...authManage, async (req, res) => {
  noStore(res);
  const parsed = resetSettingsBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json(failure("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid reset payload", req.requestId));
    return;
  }

  try {
    const actor = req.actor!;
    const requestedScope = parsed.data.scope ?? (actor.roleKey === "SUPER_ADMIN" ? "PLATFORM" : "AGENCY");
    const resetDto = await resetSettings(
      { userId: actor.userId, agencyId: actor.agencyId, roleKey: actor.roleKey },
      requestedScope,
      parsed.data.agencyId,
      req.requestId,
    );
    res.status(200).json(success(resetDto, req.requestId));
  } catch (err) {
    sendGovError(res, req, err, "Failed to reset settings");
  }
});

aiGovernanceRouter.post("/models/check", ...authManage, async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor!;
    const data = await checkModelsProbe(
      { userId: actor.userId, agencyId: actor.agencyId, roleKey: actor.roleKey },
      req.requestId,
    );
    res.status(200).json(success(data, req.requestId));
  } catch (err) {
    sendGovError(res, req, err, "Failed to probe models");
  }
});

// Public-to-authenticated transparency endpoint
aiGovernanceRouter.get("/about", async (req, res) => {
  try {
    noStore(res);
    let agencyId = req.actor?.agencyId;
    if (!agencyId) {
      const token = readSingleBearer(req.header("authorization"));
      if (token) {
        try {
          const claims = await verifyAccessToken(token);
          if (/^[a-f0-9]{24}$/i.test(claims.sub)) {
            const u = await User.findById(claims.sub).select("agencyId").lean().catch(() => null);
            if (u?.agencyId) agencyId = u.agencyId.toString();
          }
        } catch {
          // Optional auth for public page: fall back cleanly to platform defaults
        }
      }
    }
    const data = await getAboutAi(agencyId);
    res.status(200).json(success(data, req.requestId));
  } catch (err) {
    sendGovError(res, req, err, "Failed to load AI transparency details");
  }
});

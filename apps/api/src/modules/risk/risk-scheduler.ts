import os from "node:os";
import mongoose from "mongoose";
import type {
  RiskRunDto,
  RiskRunTrigger,
} from "@infraos/shared-types";
import { env } from "../../config/env.js";
import { logger } from "../../shared/logger.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { Project } from "../projects/models/project.model.js";
import { roadsyncEvents } from "../roadsync/roadsync.events.js";
import { WorkRequest } from "../roadsync/models/work-request.model.js";
import { colomboDayStart } from "./engine/math.js";
import { RiskRun, type RiskRunDocument } from "./models/risk-run.model.js";
import { assessProject } from "./risk-assessment.service.js";
import { RiskAccessError } from "./risk-inputs.service.js";
import { writeRiskAudit } from "./risk.audit.js";

export const SYSTEM_RISK_ACTOR: AuthenticatedActor = {
  userId: "000000000000000000000000",
  roleKey: "SUPER_ADMIN",
  roleId: "000000000000000000000000",
  agencyId: "000000000000000000000000",
  credentialEpoch: 1,
};

const LEASE_MS = 15 * 60 * 1000; // 15 minute lease
const EVENT_DEBOUNCE_INTERVAL_MS = 60 * 1000; // 60s debounce
const TWENTY_SIX_HOURS_MS = 26 * 60 * 60 * 1000;

// --- Event Debounce Queue ---
const eventQueue = new Set<string>();
let debounceTimer: NodeJS.Timeout | null = null;

export function queueProjectForRiskAssessment(projectId: string): void {
  if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) return;
  eventQueue.add(projectId);
}

export function getEventQueueSize(): number {
  return eventQueue.size;
}

export async function flushEventQueue(now = new Date()): Promise<number> {
  if (eventQueue.size === 0) return 0;
  const projectIds = Array.from(eventQueue);
  eventQueue.clear();

  let assessedCount = 0;
  for (const pid of projectIds) {
    try {
      await assessProject(SYSTEM_RISK_ACTOR, pid, "EVENT", now);
      assessedCount++;
    } catch (err) {
      logger.warn(
        { pid, err: err instanceof Error ? err.message : String(err) },
        "Event-driven risk assessment failed for project",
      );
    }
  }
  return assessedCount;
}

export function startEventQueueTimer(
  intervalMs = EVENT_DEBOUNCE_INTERVAL_MS,
): () => void {
  if (debounceTimer) clearInterval(debounceTimer);
  debounceTimer = setInterval(() => {
    void flushEventQueue().catch((err) =>
      logger.error({ err }, "Error flushing risk event debounce queue"),
    );
  }, intervalMs);
  debounceTimer.unref();

  return () => {
    if (debounceTimer) {
      clearInterval(debounceTimer);
      debounceTimer = null;
    }
  };
}

// --- Event Subscriptions ---
let unsubscribers: (() => void)[] = [];

async function queueProjectFromWorkRequest(requestId: string): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(requestId)) return;
    const wr = await WorkRequest.findById(requestId).select("projectId").lean();
    if (wr?.projectId) {
      queueProjectForRiskAssessment(wr.projectId.toString());
    }
  } catch (err) {
    logger.warn({ requestId, err }, "Failed to resolve project for work request");
  }
}

export function registerRiskEventSubscribers(): () => void {
  unregisterRiskEventSubscribers();

  const handleConflict = (e: any) => {
    if (e?.requestId) void queueProjectFromWorkRequest(String(e.requestId));
  };

  roadsyncEvents.on("roadsyncConflictRecordChanged", handleConflict);
  roadsyncEvents.on("roadsyncCoordinationChanged", handleConflict);
  roadsyncEvents.on("roadsyncAssessmentCompleted", handleConflict);

  unsubscribers = [
    () => roadsyncEvents.off("roadsyncConflictRecordChanged", handleConflict),
    () => roadsyncEvents.off("roadsyncCoordinationChanged", handleConflict),
    () => roadsyncEvents.off("roadsyncAssessmentCompleted", handleConflict),
  ];

  return unregisterRiskEventSubscribers;
}

export function unregisterRiskEventSubscribers(): void {
  for (const unsub of unsubscribers) unsub();
  unsubscribers = [];
}

// --- Lease & Batch Runner ---
function generateWorkerId(): string {
  const instance = process.env.RENDER_INSTANCE_ID || `${os.hostname()}-${process.pid}`;
  return `${instance}-${Date.now()}`;
}

export async function runRiskBatch(
  trigger: RiskRunTrigger,
  scopeStr: "platform" | string,
  actor: AuthenticatedActor = SYSTEM_RISK_ACTOR,
  maxProjects: number = env.RISK_MAX_PROJECTS_PER_RUN ?? 2000,
  pacingDelayMs: number = 20, // default light pacing for background work
): Promise<RiskRunDocument> {
  const now = new Date();
  const workerId = generateWorkerId();
  const runId = `RUN-${trigger.slice(0, 4)}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const run = await RiskRun.create({
    runId,
    trigger,
    scope: scopeStr,
    status: "RUNNING",
    lockedBy: workerId,
    leaseUntil: new Date(now.getTime() + LEASE_MS),
    startedAt: now,
    counters: {
      considered: 0,
      assessed: 0,
      unchanged: 0,
      notApplicable: 0,
      failed: 0,
    },
  });

  const queryFilter: Record<string, unknown> = {
    status: { $in: ["ACTIVE", "DELAYED", "ON_HOLD", "APPROVED"] },
  };

  if (scopeStr !== "platform" && mongoose.Types.ObjectId.isValid(scopeStr)) {
    queryFilter.agencyId = new mongoose.Types.ObjectId(scopeStr);
  }

  const projects = await Project.find(queryFilter)
    .sort({ riskScore: -1, updatedAt: -1 })
    .limit(maxProjects)
    .select("_id status")
    .lean();

  run.counters.considered = projects.length;

  try {
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      if (!p) continue;
      try {
        const assessTrigger = trigger === "BULK_ADMIN" ? "ON_DEMAND" : "SCHEDULED";
        const result = await assessProject(
          actor,
          p._id.toString(),
          assessTrigger,
          new Date(),
        );

        if (result.unchanged) {
          run.counters.unchanged++;
        } else {
          run.counters.assessed++;
        }
      } catch (itemErr) {
        run.counters.failed++;
        logger.warn(
          { projectId: p._id, err: itemErr instanceof Error ? itemErr.message : String(itemErr) },
          "Risk batch run failed on single project",
        );
      }

      // Update counters & heartbeat every 10 projects
      if (i > 0 && i % 10 === 0) {
        await RiskRun.updateOne(
          { _id: run._id, status: "RUNNING", lockedBy: workerId },
          {
            $set: {
              counters: run.counters,
              leaseUntil: new Date(Date.now() + LEASE_MS),
            },
          },
        );
      }

      if (pacingDelayMs > 0 && i % 5 === 4) {
        await new Promise((resolve) => setTimeout(resolve, pacingDelayMs));
      }
    }

    const finalStatus =
      run.counters.failed === 0
        ? "SUCCEEDED"
        : run.counters.assessed > 0 || run.counters.unchanged > 0
          ? "PARTIAL"
          : "FAILED";

    await RiskRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: finalStatus,
          finishedAt: new Date(),
          counters: run.counters,
        },
        $unset: { lockedBy: 1, leaseUntil: 1 },
      },
    );

    run.status = finalStatus;
    run.finishedAt = new Date();

    await writeRiskAudit(undefined, {
      action: "risk.run_completed",
      resourceId: run._id,
      actorUserId: actor.userId,
      agencyId: scopeStr === "platform" ? null : new mongoose.Types.ObjectId(scopeStr),
      status: finalStatus,
      reason: `considered:${run.counters.considered},assessed:${run.counters.assessed},unchanged:${run.counters.unchanged},failed:${run.counters.failed}`,
    });

    return run;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await RiskRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: "FAILED",
          finishedAt: new Date(),
          errorCode: errorMsg.slice(0, 200),
          counters: run.counters,
        },
        $unset: { lockedBy: 1, leaseUntil: 1 },
      },
    );
    throw err;
  }
}

// --- Admin Bulk Run ---
export async function startAdminBulkRun(
  actor: AuthenticatedActor,
  scopeStr: "platform" | string,
): Promise<RiskRunDocument> {
  // Check if any run is currently RUNNING with valid lease
  const activeRun = await RiskRun.findOne({
    status: "RUNNING",
    leaseUntil: { $gt: new Date() },
  }).lean();

  if (activeRun) {
    throw new RiskAccessError(
      409,
      "RUN_IN_PROGRESS",
      `A risk assessment run (${activeRun.runId}) is already in progress.`,
    );
  }

  // Launch asynchronously in background
  const runPromise = runRiskBatch("BULK_ADMIN", scopeStr, actor);
  void runPromise.catch((err) =>
    logger.error({ err }, "Admin bulk risk assessment run failed in background"),
  );

  // Return the newly created running document quickly
  const created = await RiskRun.findOne({ trigger: "BULK_ADMIN", status: "RUNNING" })
    .sort({ startedAt: -1 });

  if (!created) {
    throw new RiskAccessError(500, "RUN_CREATION_FAILED", "Failed to initialize bulk run");
  }

  return created;
}

// --- Startup Catch-up ---
export async function checkStartupCatchup(now = new Date()): Promise<void> {
  try {
    const lastSuccess = await RiskRun.findOne({
      trigger: { $in: ["SCHEDULED", "STARTUP_CATCHUP"] },
      status: "SUCCEEDED",
    })
      .sort({ startedAt: -1 })
      .lean();

    if (!lastSuccess || now.getTime() - lastSuccess.startedAt.getTime() > TWENTY_SIX_HOURS_MS) {
      logger.info(
        "Last successful risk run is > 26h old or none found. Triggering startup catch-up run.",
      );
      void runRiskBatch("STARTUP_CATCHUP", "platform", SYSTEM_RISK_ACTOR).catch((err) =>
        logger.error({ err }, "Startup catch-up risk run failed"),
      );
    }
  } catch (err) {
    logger.warn({ err }, "Failed to verify risk startup catch-up");
  }
}

// --- Nightly In-Process Scheduler ---
let schedulerTimer: NodeJS.Timeout | null = null;

function getColomboHour(date: Date): number {
  try {
    const colomboStr = date.toLocaleString("en-US", {
      timeZone: "Asia/Colombo",
      hour12: false,
      hour: "numeric",
    });
    return parseInt(colomboStr, 10);
  } catch {
    return (date.getUTCHours() + 5) % 24; // fallback UTC+5:30 approximate
  }
}

export async function checkAndTriggerNightlyRun(now = new Date()): Promise<boolean> {
  const targetHour = env.RISK_SCHEDULE_HOUR ?? 2;
  const currentHour = getColomboHour(now);

  if (currentHour !== targetHour) {
    return false;
  }

  // Check if a scheduled run already executed or is running for today's Colombo date
  const todayStart = colomboDayStart(now);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const existingToday = await RiskRun.findOne({
    trigger: "SCHEDULED",
    startedAt: { $gte: todayStart, $lt: tomorrowStart },
    status: { $in: ["RUNNING", "SUCCEEDED"] },
  }).lean();

  if (existingToday) {
    return false;
  }

  logger.info({ today: todayStart.toISOString() }, "Triggering nightly risk intelligence run");
  void runRiskBatch("SCHEDULED", "platform", SYSTEM_RISK_ACTOR).catch((err) =>
    logger.error({ err }, "Nightly risk intelligence run failed"),
  );
  return true;
}

export function startRiskScheduler(): { stop: () => Promise<void> } {
  if (env.NODE_ENV === "test") {
    return { stop: async () => {} };
  }

  // 1. Register subscribers & start debounce timer
  registerRiskEventSubscribers();
  const stopDebounce = startEventQueueTimer();

  // 2. Check startup catch-up
  void checkStartupCatchup();

  // 3. Start nightly interval check (every 5 minutes)
  if (env.RISK_SCHEDULE_ENABLED ?? true) {
    schedulerTimer = setInterval(() => {
      void checkAndTriggerNightlyRun().catch((err) =>
        logger.error({ err }, "Error in nightly risk schedule check"),
      );
    }, 5 * 60 * 1000);
    schedulerTimer.unref();
  }

  return {
    stop: async () => {
      unregisterRiskEventSubscribers();
      stopDebounce();
      if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
      }
    },
  };
}

// --- Read helpers ---
export async function getRecentRuns(limit = 20): Promise<RiskRunDto[]> {
  const runs = await RiskRun.find()
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean();

  return runs.map((r) => ({
    id: r._id.toString(),
    runId: r.runId,
    trigger: r.trigger,
    scope: r.scope,
    status: r.status,
    counters: r.counters,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString(),
    errorCode: r.errorCode ?? undefined,
  }));
}

export async function getRunById(runIdOrId: string): Promise<RiskRunDto | null> {
  const filter = mongoose.Types.ObjectId.isValid(runIdOrId)
    ? { $or: [{ _id: new mongoose.Types.ObjectId(runIdOrId) }, { runId: runIdOrId }] }
    : { runId: runIdOrId };

  const r = await RiskRun.findOne(filter).lean();
  if (!r) return null;

  return {
    id: r._id.toString(),
    runId: r.runId,
    trigger: r.trigger,
    scope: r.scope,
    status: r.status,
    counters: r.counters,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString(),
    errorCode: r.errorCode ?? undefined,
  };
}

import { beforeEach, describe, expect, it, vi } from "vitest";

// Cold-start tolerance for the Copilot planner (Render free tier sleeps; first call can take 30-60 s).
const fake = {
  isCold: true,
  health: vi.fn(async () => false),
  wake: vi.fn(async () => undefined),
  copilotStep: vi.fn(),
};
vi.mock("../src/modules/ai/ai-client.js", () => ({ aiClient: () => fake }));

const { runCopilotPlanner } = await import("../src/modules/ai/copilot/copilot-planner.js");

const finalStep = {
  output: { type: "final", answer: "Nothing to report.", claims: [], missingInfo: [] },
  usage: { inputTokens: 10, outputTokens: 5 },
  model: "stub-model",
};

const params = () => ({
  turnId: "t1",
  message: "hello",
  language: "en" as const,
  actor: { userId: "u1", roleKey: "PROJECT_MANAGER", permissions: ["copilot.use"] },
  requestId: "r1",
  isCancelled: async () => false,
});

describe("copilot planner cold-start handling", () => {
  beforeEach(() => {
    fake.isCold = true;
    fake.health.mockReset().mockResolvedValue(false);
    fake.wake.mockReset().mockResolvedValue(undefined);
    fake.copilotStep.mockReset();
  });

  it("tells the user the service is warming up, waits for it, then answers", async () => {
    fake.copilotStep.mockResolvedValueOnce(finalStep);
    const res = await runCopilotPlanner(params());
    expect(fake.wake).toHaveBeenCalledTimes(1);
    expect(res.steps.map((s) => s.labelKey)).toContain("copilot.step.service_warming");
    expect(res.status).not.toBe("FAILED");
  });

  it("does not show a warming step when the service answers the liveness probe quickly", async () => {
    fake.health.mockResolvedValue(true);
    fake.copilotStep.mockResolvedValueOnce(finalStep);
    const res = await runCopilotPlanner(params());
    expect(fake.wake).not.toHaveBeenCalled();
    expect(res.steps.map((s) => s.labelKey)).not.toContain("copilot.step.service_warming");
  });

  it("retries once after a transport timeout, then succeeds", async () => {
    fake.isCold = false;
    fake.copilotStep.mockRejectedValueOnce(Object.assign(new Error("t"), { code: "AI_SERVICE_TIMEOUT" })).mockResolvedValueOnce(finalStep);
    const res = await runCopilotPlanner(params());
    expect(fake.copilotStep).toHaveBeenCalledTimes(2);
    expect(res.status).not.toBe("FAILED");
  });

  it("fails honestly (typed error code) when the retry also fails, and never retries provider/LLM errors", async () => {
    fake.isCold = false;
    fake.copilotStep.mockRejectedValue(Object.assign(new Error("t"), { code: "AI_SERVICE_UNAVAILABLE" }));
    const failed = await runCopilotPlanner(params());
    expect(fake.copilotStep).toHaveBeenCalledTimes(2);
    expect(failed.status).toBe("FAILED");
    expect(failed.errorCode).toBe("AI_SERVICE_UNAVAILABLE");

    fake.copilotStep.mockReset().mockRejectedValue(Object.assign(new Error("x"), { code: "AI_RATE_LIMITED" }));
    const limited = await runCopilotPlanner(params());
    expect(fake.copilotStep).toHaveBeenCalledTimes(1);
    expect(limited.errorCode).toBe("AI_RATE_LIMITED");
  });
});

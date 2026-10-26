import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: vi.fn() };
});

vi.mock("@/lib/auth/state", () => ({
  getAuthEpoch: vi.fn(() => 4),
  getMemoryAccessToken: vi.fn(() => "token-a"),
}));

import { apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";
import { createProject } from "./api";

const body = {
  projectCode: "INF-ROAD-52",
  title: "Synthetic",
  projectType: "ROAD" as const,
  budget: { amountMinor: 100, currency: "LKR" as const },
};

describe("create project transport", () => {
  beforeEach(() => {
    vi.mocked(apiClient).mockReset();
    vi.mocked(getAuthEpoch).mockReturnValue(4);
    vi.mocked(getMemoryAccessToken).mockReturnValue("token-a");
  });

  it("posts once and returns the saved draft for the same subject", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      success: true,
      data: { project: { id: "p1", projectCode: "INF-ROAD-52", status: "DRAFT" } },
    });
    const result = await createProject(body);
    expect(result.project.id).toBe("p1");
    expect(result.epoch).toBe(4);
    expect(apiClient).toHaveBeenCalledTimes(1);
    expect(apiClient).toHaveBeenCalledWith("/api/v1/projects", {
      method: "POST",
      authenticated: true,
      body,
    });
    expect(JSON.stringify(body)).not.toMatch(/agencyId|managerId|createdBy|status/);
  });

  it("drops a success that returns after the session moves", async () => {
    vi.mocked(apiClient).mockImplementation(async () => {
      vi.mocked(getAuthEpoch).mockReturnValue(5);
      vi.mocked(getMemoryAccessToken).mockReturnValue("token-b");
      return { success: true, data: { project: { id: "p1" } } };
    });
    await expect(createProject(body)).rejects.toMatchObject({ status: 401, message: "session moved" });
    expect(apiClient).toHaveBeenCalledTimes(1);
  });

  it("does not call the client again after a conflict", async () => {
    vi.mocked(apiClient).mockRejectedValue(new ApiError("duplicate", 409, { code: "CONFLICT" }));
    await expect(createProject(body)).rejects.toMatchObject({ status: 409 });
    expect(apiClient).toHaveBeenCalledTimes(1);
  });
});

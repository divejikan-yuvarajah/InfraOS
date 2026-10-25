import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return {
    ...actual,
    apiClient: vi.fn(),
  };
});

vi.mock("@/lib/auth/state", () => ({
  getAuthEpoch: vi.fn(() => 1),
  getMemoryAccessToken: vi.fn(() => "token-a"),
}));

import { apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";
import { fetchSelfProfile, updateSelfProfile } from "./api";

describe("profile api client", () => {
  beforeEach(() => {
    vi.mocked(apiClient).mockReset();
    vi.mocked(getAuthEpoch).mockReturnValue(1);
    vi.mocked(getMemoryAccessToken).mockReturnValue("token-a");
  });

  it("returns profile data when the session is unchanged", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      success: true,
      data: { profile: { id: "u1", revision: 0, firstName: "A", lastName: "B" } },
      meta: { requestId: "r1" },
    });
    const profile = await fetchSelfProfile();
    expect(profile.id).toBe("u1");
    expect(apiClient).toHaveBeenCalledWith("/api/v1/profile/me", {
      method: "GET",
      authenticated: true,
    });
  });

  it("ignores stale profile responses after logout epoch moves", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      success: true,
      data: { profile: { id: "u1", revision: 0, firstName: "A", lastName: "B" } },
      meta: { requestId: "r1" },
    });
    vi.mocked(getAuthEpoch).mockReturnValueOnce(1).mockReturnValueOnce(2);
    await expect(fetchSelfProfile()).rejects.toMatchObject({ status: 401 });
  });

  it("does not retry PATCH through apiClient options", async () => {
    vi.mocked(apiClient).mockRejectedValue(new ApiError("conflict", 409, { code: "CONFLICT" }));
    await expect(
      updateSelfProfile({ firstName: "A", lastName: "B", revision: 0 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(apiClient).toHaveBeenCalledTimes(1);
    expect(getMemoryAccessToken()).toBe("token-a");
  });
});

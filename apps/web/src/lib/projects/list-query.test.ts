import { PROJECT_STATUSES as OFFICIAL_STATUSES, PROJECT_TYPES as OFFICIAL_TYPES } from "@infraos/shared-types";
import { describe, expect, it } from "vitest";

import {
  canHintProjectCreate,
  parseProjectListParams,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  resetProjectListPage,
  serializeProjectListParams,
  toProjectListRequest,
} from "./list-query";

describe("project list query", () => {
  it("maps search, filters, page, and an allowlisted sort into the API request", () => {
    const state = parseProjectListParams(new URLSearchParams("page=2&limit=20&q=INF-ROAD&status=DRAFT&type=ROAD&sortBy=title&sortDir=asc&agencyId=507f1f77bcf86cd799439011"));
    expect(toProjectListRequest(state)).toEqual({
      page: 2,
      limit: 20,
      q: "INF-ROAD",
      status: "DRAFT",
      type: "ROAD",
      agencyId: "507f1f77bcf86cd799439011",
      sortBy: "title",
      sortDir: "asc",
    });
    expect(serializeProjectListParams(state)).toContain("sortBy=title");
  });

  it("drops operator-like and unsupported sort values", () => {
    const state = parseProjectListParams(new URLSearchParams("sortBy=$where&sortDir=sideways&status=NOT_A_STATUS&limit=50&agencyId=not-an-id"));
    expect(state.sortBy).toBe("createdAt");
    expect(state.sortDir).toBe("desc");
    expect(state.status).toBe("");
    expect(state.limit).toBe(10);
    expect(state.agencyId).toBe("");
    expect(toProjectListRequest(state).agencyId).toBeUndefined();
  });

  it("keeps the client status and type lists equal to the shared contract", () => {
    expect([...PROJECT_STATUSES]).toEqual([...OFFICIAL_STATUSES]);
    expect([...PROJECT_TYPES]).toEqual([...OFFICIAL_TYPES]);
  });
  it("resets the page when a filter changes and hides create for non-writing roles", () => {
    expect(resetProjectListPage({ page: 4, limit: 10, q: "", status: "", type: "", agencyId: "", sortBy: "createdAt", sortDir: "desc" }, { status: "ACTIVE" }).page).toBe(1);
    expect(canHintProjectCreate("AGENCY_OFFICER")).toBe(true);
    expect(canHintProjectCreate("PROJECT_MANAGER")).toBe(true);
    expect(canHintProjectCreate("GOV_ADMIN")).toBe(true);
    expect(canHintProjectCreate("SUPER_ADMIN")).toBe(false);
    expect(canHintProjectCreate("CONTRACTOR")).toBe(false);
    expect(canHintProjectCreate("INSPECTOR")).toBe(false);
    expect(canHintProjectCreate("CITIZEN")).toBe(false);
  });
});

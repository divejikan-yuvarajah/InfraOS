import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  API_ERROR_CODES,
  CONFLICT_STATUSES,
  CONTRACTOR_RISK_LEVELS,
  CONTRACTOR_STATUSES,
  COORDINATION_STATUSES,
  isApiSuccess,
  isInfraGeometry,
  MILESTONE_STATUSES,
  PERMISSION_CATALOG,
  PROJECT_STATUSES,
  SYSTEM_ROLE_KEYS,
  WORK_STATUSES,
  type ApiResponse,
  type ProjectSummaryDto,
  type PublicProjectDto,
} from "@infraos/shared-types";
import { PROJECT_STATUSES as MODEL_PROJECT_STATUSES } from "../src/modules/projects/project.constants.js";
import { MILESTONE_STATUSES as MODEL_MILESTONE_STATUSES } from "../src/modules/projects/project.constants.js";
import {
  CONFLICT_STATUSES as MODEL_CONFLICT_STATUSES,
  COORDINATION_STATUSES as MODEL_COORDINATION_STATUSES,
  WORK_STATUSES as MODEL_WORK_STATUSES,
} from "../src/modules/roadsync/roadsync.constants.js";
import {
  CONTRACTOR_RISK_LEVELS as MODEL_CONTRACTOR_RISK,
  CONTRACTOR_STATUSES as MODEL_CONTRACTOR_STATUSES,
} from "../src/modules/contractors/contractor.constants.js";

function sharedSource(): string {
  const root = join(process.cwd(), "../../packages/shared-types/src");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".ts")) files.push(readFileSync(path, "utf8"));
    }
  };
  walk(root);
  return files.join("\n");
}

describe("shared contracts", () => {
  it("does not import server or UI runtimes", () => {
    const source = sharedSource();
    for (const banned of [
      "from \"mongoose\"",
      "from \"express\"",
      "from \"next\"",
      "from \"react\"",
      "node:fs",
    ]) {
      expect(source.includes(banned)).toBe(false);
    }
  });

  it("matches Step 13 status catalogs", () => {
    expect([...PROJECT_STATUSES]).toEqual([...MODEL_PROJECT_STATUSES]);
    expect([...MILESTONE_STATUSES]).toEqual([...MODEL_MILESTONE_STATUSES]);
    expect([...WORK_STATUSES]).toEqual([...MODEL_WORK_STATUSES]);
    expect([...CONFLICT_STATUSES]).toEqual([...MODEL_CONFLICT_STATUSES]);
    expect([...COORDINATION_STATUSES]).toEqual([...MODEL_COORDINATION_STATUSES]);
    expect([...CONTRACTOR_STATUSES]).toEqual([...MODEL_CONTRACTOR_STATUSES]);
    expect([...CONTRACTOR_RISK_LEVELS]).toEqual([...MODEL_CONTRACTOR_RISK]);
    expect(SYSTEM_ROLE_KEYS).toContain("GOV_ADMIN");
    expect(SYSTEM_ROLE_KEYS).not.toContain("GOVERNMENT_ADMIN");
    expect(PERMISSION_CATALOG).toContain("project.approve");
  });

  it("serializes a project summary as JSON-safe strings", () => {
    const dto: ProjectSummaryDto = {
      id: "507f1f77bcf86cd799439011",
      projectCode: "INF-ROAD-001",
      title: "Synthetic corridor",
      projectType: "ROAD",
      status: "ACTIVE",
      agencyId: "507f1f77bcf86cd799439012",
      physicalProgress: 35,
      financialProgress: 28,
      plannedEndDate: "2026-06-30T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const json = JSON.parse(JSON.stringify(dto)) as ProjectSummaryDto;
    expect(typeof json.id).toBe("string");
    expect(json.createdAt.endsWith("Z")).toBe(true);
  });

  it("narrows success and failure envelopes", () => {
    const ok: ApiResponse<ProjectSummaryDto[]> = {
      success: true,
      data: [],
      meta: { requestId: "req-1", page: 1, limit: 20, total: 0, totalPages: 0 },
    };
    const fail: ApiResponse<ProjectSummaryDto[]> = {
      success: false,
      error: { code: "RESOURCE_NOT_FOUND", message: "Project not found", details: null },
      meta: { requestId: "req-1" },
    };
    expect(isApiSuccess(ok) && ok.data).toEqual([]);
    expect(isApiSuccess(fail)).toBe(false);
    expect(API_ERROR_CODES).toContain("VALIDATION_ERROR");
    expect(API_ERROR_CODES).toContain("RATE_LIMITED");
    expect(API_ERROR_CODES).toContain("NOT_READY");
  });

  it("accepts Colombo longitude-latitude lines and rejects swapped structure", () => {
    expect(
      isInfraGeometry({
        type: "LineString",
        coordinates: [
          [79.8612, 6.9271],
          [79.862, 6.928],
        ],
      }),
    ).toBe(true);
    expect(isInfraGeometry({ type: "Point", coordinates: [200, 6] })).toBe(false);
  });

  it("keeps public project fields free of internal finance and identity", () => {
    const keys: (keyof PublicProjectDto)[] = [
      "id",
      "projectCode",
      "title",
      "projectType",
      "status",
      "locality",
    ];
    expect(keys).not.toContain("budget" as keyof PublicProjectDto);
    const sample: PublicProjectDto = {
      id: "1",
      projectCode: "INF-ROAD-001",
      title: "Synthetic",
      projectType: "ROAD",
      status: "ACTIVE",
      locality: "Colombo",
    };
    expect(JSON.stringify(sample)).not.toMatch(/passwordHash|budget|tokenHash/);
  });
});

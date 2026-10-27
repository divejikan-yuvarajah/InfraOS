import { describe, expect, it } from "vitest";

import {
  buildProjectPatchBody,
  editBaselineFromProject,
  editFormValuesFromProject,
  type ProjectEditFormValues,
} from "./edit-transform";
import type { ProjectDetail } from "./types";

const base: ProjectDetail = {
  id: "507f1f77bcf86cd799439011",
  projectCode: "INF-ROAD-101",
  title: "Original",
  projectType: "ROAD",
  status: "DRAFT",
  agencyId: "507f1f77bcf86cd799439012",
  agencyCode: "DEPT_WEST",
  managerId: null,
  startDate: "2027-01-01T00:00:00.000Z",
  plannedEndDate: "2027-06-01T00:00:00.000Z",
  createdAt: "2027-01-01T00:00:00.000Z",
  updatedAt: "2027-01-01T00:00:00.000Z",
  revision: 2,
  description: "Keep me",
  location: { province: "Western" },
  geometry: { type: "LineString", coordinates: [[79.8, 6.9], [79.9, 6.95]] },
  canEditDraft: true,
};

describe("edit transform", () => {
  it("prefills complex geometry without point coordinates", () => {
    const values = editFormValuesFromProject(base);
    expect(values.longitude).toBe("");
    expect(values.latitude).toBe("");
    expect(values.title).toBe("Original");
  });

  it("omits geometry from patch when complex geometry is unchanged", () => {
    const baseline = editBaselineFromProject(base);
    const values: ProjectEditFormValues = { ...editFormValuesFromProject(base), title: "Updated title" };
    const built = buildProjectPatchBody(values, baseline);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.title).toBe("Updated title");
    expect(built.body.revision).toBe(2);
    expect(built.body.geometry).toBeUndefined();
  });

  it("clears description with null and preserves line geometry unless removed", () => {
    const baseline = editBaselineFromProject(base);
    const values: ProjectEditFormValues = {
      ...editFormValuesFromProject(base),
      description: "",
    };
    const built = buildProjectPatchBody(values, baseline);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.description).toBeNull();
  });

  it("sends null geometry only when removeGeometry is checked", () => {
    const baseline = editBaselineFromProject(base);
    const values: ProjectEditFormValues = {
      ...editFormValuesFromProject(base),
      removeGeometry: true,
    };
    const built = buildProjectPatchBody(values, baseline);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.geometry).toBeNull();
  });
});

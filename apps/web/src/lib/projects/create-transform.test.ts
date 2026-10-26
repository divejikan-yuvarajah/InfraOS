import { describe, expect, it } from "vitest";

import { projectCreateFormSchema } from "./create-schema";
import { classifyCreateError, shouldConfirmDiscard } from "./create-outcome";
import {
  buildProjectCreateBody,
  createControlId,
  createErrorId,
  dateOnlyToUtc,
  projectCreateCachePlan,
  rupeesToMinor,
  type ProjectCreateFormValues,
} from "./create-transform";
import { ApiError } from "@/lib/api/client";
import { getProjectCopy } from "./messages";

const blank: ProjectCreateFormValues = {
  projectCode: "",
  title: "",
  projectType: "",
  description: "",
  startDate: "",
  plannedEndDate: "",
  amountLkr: "",
  province: "",
  district: "",
  locality: "",
  roadName: "",
  locationDescription: "",
  longitude: "",
  latitude: "",
};

describe("project create transform", () => {
  it("requires code, title, category, and budget before a request body exists", () => {
    const built = buildProjectCreateBody(blank);
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.errors.projectCode).toBe("required");
      expect(built.errors.title).toBe("required");
      expect(built.errors.projectType).toBe("required");
      expect(built.errors.amountLkr).toBe("required");
    }
    expect(projectCreateFormSchema.safeParse(blank).success).toBe(false);
  });

  it("keeps Unicode titles and normalizes the project code", () => {
    const built = buildProjectCreateBody({
      ...blank,
      projectCode: "  inf-road-52  ",
      title: "  කොළඹ நீர்  ",
      projectType: "WATER",
      amountLkr: "0",
    });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.body.projectCode).toBe("INF-ROAD-52");
      expect(built.body.title).toBe("කොළඹ நீர்");
      expect(built.body.budget).toEqual({ amountMinor: 0, currency: "LKR" });
    }
    const long = buildProjectCreateBody({ ...blank, projectCode: "INF-ROAD-1", title: "න".repeat(201), projectType: "ROAD", amountLkr: "1" });
    expect(long.ok).toBe(false);
  });

  it("converts rupees with decimal strings and rejects unsafe amounts", () => {
    expect(rupeesToMinor("0")).toEqual({ ok: true, amountMinor: 0 });
    expect(rupeesToMinor("0.01")).toEqual({ ok: true, amountMinor: 1 });
    expect(rupeesToMinor("1250000.50")).toEqual({ ok: true, amountMinor: 125000050 });
    expect(rupeesToMinor("1,250,000.00")).toEqual({ ok: true, amountMinor: 125000000 });
    expect(rupeesToMinor("90071992547409.91")).toEqual({ ok: true, amountMinor: Number.MAX_SAFE_INTEGER });
    expect(rupeesToMinor("90071992547409.92").ok).toBe(false);
    expect(rupeesToMinor("1.234").ok).toBe(false);
    expect(rupeesToMinor("-1").ok).toBe(false);
    expect(rupeesToMinor("1e2").ok).toBe(false);
    expect(rupeesToMinor("").ok).toBe(false);
    expect(rupeesToMinor("෦.01").ok).toBe(false);
  });

  it("encodes calendar dates as UTC midnight and omits blanks", () => {
    expect(dateOnlyToUtc("2027-01-15")).toBe("2027-01-15T00:00:00.000Z");
    expect(dateOnlyToUtc("2024-02-29")).toBe("2024-02-29T00:00:00.000Z");
    expect(dateOnlyToUtc("2025-02-29")).toBeNull();
    const open = buildProjectCreateBody({
      ...blank,
      projectCode: "INF-ROAD-1",
      title: "Open",
      projectType: "ROAD",
      amountLkr: "1.50",
      startDate: "2027-01-15",
    });
    expect(open.ok && open.body.startDate).toBe("2027-01-15T00:00:00.000Z");
    expect(open.ok && open.body.plannedEndDate).toBeUndefined();
    const inverted = buildProjectCreateBody({
      ...blank,
      projectCode: "INF-ROAD-1",
      title: "Open",
      projectType: "ROAD",
      amountLkr: "1",
      startDate: "2027-03-02",
      plannedEndDate: "2027-03-01",
    });
    expect(inverted.ok).toBe(false);
  });

  it("places longitude first and allows a draft without a point", () => {
    const point = buildProjectCreateBody({
      ...blank,
      projectCode: "INF-ROAD-9",
      title: "Point",
      projectType: "ROAD",
      amountLkr: "10",
      longitude: "79.86",
      latitude: "6.92",
    });
    expect(point.ok && point.body.geometry).toEqual({ type: "Point", coordinates: [79.86, 6.92] });
    const swapped = buildProjectCreateBody({
      ...blank,
      projectCode: "INF-ROAD-9",
      title: "Point",
      projectType: "ROAD",
      amountLkr: "10",
      longitude: "6.92",
      latitude: "79.86",
    });
    expect(swapped.ok && swapped.body.geometry?.coordinates).toEqual([6.92, 79.86]);
    const missing = buildProjectCreateBody({
      ...blank,
      projectCode: "INF-ROAD-9",
      title: "Point",
      projectType: "ROAD",
      amountLkr: "10",
      longitude: "79",
    });
    expect(missing.ok).toBe(false);
    expect(buildProjectCreateBody({
      ...blank,
      projectCode: "INF-ROAD-9",
      title: "Point",
      projectType: "ROAD",
      amountLkr: "10",
      longitude: "190",
      latitude: "0",
    }).ok).toBe(false);
    expect(buildProjectCreateBody({
      ...blank,
      projectCode: "INF-ROAD-9",
      title: "Point",
      projectType: "ROAD",
      amountLkr: "10",
      longitude: "NaN",
      latitude: "0",
    }).ok).toBe(false);
  });

  it("omits blank optional text and rejects authority fields", () => {
    const built = buildProjectCreateBody({
      ...blank,
      projectCode: "INF-ROAD-3",
      title: "Road",
      projectType: "ROAD",
      amountLkr: "2",
      description: "   ",
      province: "Western",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.description).toBeUndefined();
    expect(built.body.location).toEqual({ province: "Western" });
    expect(Object.keys(built.body).sort()).toEqual(["budget", "location", "projectCode", "projectType", "title"]);
    const over = buildProjectCreateBody({ ...blank, projectCode: "INF-ROAD-3", title: "Road", projectType: "ROAD", amountLkr: "2", province: "P".repeat(101) });
    expect(over.ok).toBe(false);
  });

  it("plans cache updates only for the same signed-in subject", () => {
    expect(projectCreateCachePlan({
      startedEpoch: 2,
      startedToken: "a",
      currentEpoch: 2,
      currentToken: "a",
      projectId: "abc",
    })).toEqual({ invalidate: true, href: "/projects/abc/overview" });
    expect(projectCreateCachePlan({
      startedEpoch: 2,
      startedToken: "a",
      currentEpoch: 3,
      currentToken: "b",
      projectId: "abc",
    })).toEqual({ invalidate: false, href: null });
    expect(shouldConfirmDiscard(true, false)).toBe(true);
    expect(shouldConfirmDiscard(true, true)).toBe(false);
  });

  it("classifies server and unknown results without treating them as saved", () => {
    expect(classifyCreateError(new ApiError("duplicate", 409))).toBe("duplicate");
    expect(classifyCreateError(new ApiError("no", 401))).toBe("expired");
    expect(classifyCreateError(new ApiError("no", 403))).toBe("denied");
    expect(classifyCreateError(new ApiError("no", 400))).toBe("invalid");
    expect(classifyCreateError(new ApiError("no", 415))).toBe("invalid");
    expect(classifyCreateError(new ApiError("no", 503))).toBe("unavailable");
    expect(classifyCreateError(new ApiError("session moved", 401))).toBe("stale");
    expect(classifyCreateError(new TypeError("Failed to fetch"))).toBe("unknown");
    expect(createControlId("title")).toBe("project-create-title");
    expect(createErrorId("title")).toBe("project-create-title-error");
  });

  it("drafts Sinhala and Tamil create copy separately from English", () => {
    const en = getProjectCopy("en");
    const si = getProjectCopy("si");
    const ta = getProjectCopy("ta");
    expect(si.createTitle).not.toBe(en.createTitle);
    expect(ta.saveDraft).not.toBe(en.saveDraft);
    expect(si.errors.duplicate).not.toBe(en.errors.duplicate);
    expect(ta.types.ROAD).not.toBe(en.types.ROAD);
    expect(si.errors.unknown).toMatch(/නො/);
  });
});

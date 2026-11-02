import { describe, expect, it } from "vitest";
import { WORK_PRIORITIES as SHARED_PRIORITIES, WORK_STATUSES as SHARED_STATUSES, WORK_TYPES as SHARED_TYPES } from "@infraos/shared-types";

import { ApiError } from "@/lib/api/errors";

import { classifyWorkRequestError } from "./api";
import { getWorkRequestCopy } from "./work-request-copy";
import {
  buildCreateBody,
  buildPatchBody,
  canHintCreate,
  colomboLocalToUtc,
  EMPTY_FORM,
  filtersToQuery,
  firstInvalidField,
  parseGeometryText,
  stageOfField,
  startRule,
  summarizeGeometry,
  utcToColomboLocal,
  valuesFromRecord,
  type WorkRequestRecord,
  WORK_PRIORITIES,
  WORK_STATUSES,
  WORK_TYPES,
  workRequestQueryKey,
} from "./work-requests-view";

const valid = {
  ...EMPTY_FORM,
  projectId: "a".repeat(24),
  workType: "ROAD_RESURFACING",
  geometryKind: "LineString" as const,
  coordinates: "79.86, 6.93\n79.87, 6.94",
  plannedStart: "2026-11-10T09:00",
  plannedEnd: "2026-11-12T17:00",
};

describe("enum parity with shared-types", () => {
  it("matches the canonical lists", () => {
    expect([...WORK_TYPES]).toEqual([...SHARED_TYPES]);
    expect([...WORK_STATUSES]).toEqual([...SHARED_STATUSES]);
    expect([...WORK_PRIORITIES]).toEqual([...SHARED_PRIORITIES]);
  });
});

describe("geometry parsing", () => {
  it("keeps longitude/latitude order and builds each kind", () => {
    expect(parseGeometryText("Point", "79.86 6.93")).toEqual({ ok: true, geometry: { type: "Point", coordinates: [79.86, 6.93] } });
    const line = parseGeometryText("LineString", "79.1,6.1\n79.2,6.2");
    expect(line.ok && line.geometry.type).toBe("LineString");
  });
  it("auto-closes polygons and requires three corners", () => {
    const poly = parseGeometryText("Polygon", "79,6\n79.1,6\n79.1,6.1");
    expect(poly.ok && poly.geometry.type === "Polygon" && poly.geometry.coordinates[0]).toEqual([[79, 6], [79.1, 6], [79.1, 6.1], [79, 6]]);
    expect(parseGeometryText("Polygon", "79,6\n79.1,6").ok).toBe(false);
  });
  it("rejects swapped, malformed, out-of-range and wrong-count input", () => {
    expect(parseGeometryText("Point", "6.93, 179.9").ok).toBe(false); // swapped Sri Lanka pair: latitude out of range
    expect(parseGeometryText("Point", "79.86, 96.93").ok).toBe(false);
    expect(parseGeometryText("Point", "abc, 1").ok).toBe(false);
    expect(parseGeometryText("Point", "1,2\n3,4").ok).toBe(false);
    expect(parseGeometryText("LineString", "1,2").ok).toBe(false);
    expect(parseGeometryText("Point", "").ok).toBe(false);
  });
  it("summarizes a line with a plausible length", () => {
    const parsed = parseGeometryText("LineString", "79.86,6.93\n79.86,6.94");
    if (!parsed.ok) throw new Error("parse");
    const s = summarizeGeometry(parsed.geometry);
    expect(s.vertices).toBe(2);
    expect(s.lengthKm).toBeGreaterThan(1.0);
    expect(s.lengthKm).toBeLessThan(1.2);
  });
});

describe("dates are Asia/Colombo wall time serialized as UTC", () => {
  it("converts +05:30 and rejects impossible dates", () => {
    expect(colomboLocalToUtc("2026-11-10T09:00")).toBe("2026-11-10T03:30:00.000Z");
    expect(colomboLocalToUtc("2026-02-30T09:00")).toBeNull();
    expect(colomboLocalToUtc("2026-11-10")).toBeNull();
    expect(colomboLocalToUtc("")).toBeNull();
  });
});

describe("create body", () => {
  it("transforms a valid form and never carries agency, status or ids of the caller", () => {
    const built = buildCreateBody(valid);
    if (!built.ok) throw new Error("expected ok");
    expect(Object.keys(built.body).sort()).toEqual(["geometry", "isEmergency", "plannedEnd", "plannedStart", "priority", "projectId", "workType", "workingHours"]);
    expect(built.body).toMatchObject({ workingHours: "day", isEmergency: false });
    expect(built.body.plannedStart).toBe("2026-11-10T03:30:00.000Z");
  });
  it("reports ordered field errors, including reversed dates", () => {
    const built = buildCreateBody({ ...valid, projectId: "", plannedEnd: "2026-11-09T09:00", coordinates: "x" });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.errors.projectId).toBeTruthy();
    expect(built.errors.plannedEnd).toMatch(/on or after/);
    expect(firstInvalidField(built.errors)).toBe("projectId");
  });
});

describe("list, permissions and session isolation", () => {
  it("serializes only set filters", () => {
    expect(filtersToQuery({ status: "DRAFT", workType: "", priority: "", projectId: "", page: 2 })).toBe("page=2&limit=20&status=DRAFT");
  });
  it("only hints create for roles the API grants it to", () => {
    expect(canHintCreate("AGENCY_OFFICER")).toBe(true);
    expect(canHintCreate("PROJECT_MANAGER")).toBe(true);
    expect(canHintCreate("SUPER_ADMIN")).toBe(true);
    expect(canHintCreate("INSPECTOR")).toBe(false);
    expect(canHintCreate("CITIZEN")).toBe(false);
    expect(canHintCreate("CONTRACTOR")).toBe(false);
  });
  it("keys the cache by epoch and user", () => {
    expect(workRequestQueryKey("1", "u1", "R")).not.toEqual(workRequestQueryKey("2", "u1", "R"));
    expect(workRequestQueryKey("1", "u1", "R")).not.toEqual(workRequestQueryKey("1", "u2", "R"));
  });
  it("classifies API failures", () => {
    expect(classifyWorkRequestError(new ApiError("x", 403, { code: "FORBIDDEN" }))).toBe("forbidden");
    expect(classifyWorkRequestError(new ApiError("x", 404, { code: "NOT_FOUND" }))).toBe("not-found");
    expect(classifyWorkRequestError(new ApiError("x", 503, { code: "SERVICE_UNAVAILABLE" }))).toBe("unavailable");
    expect(classifyWorkRequestError(new Error("net"))).toBe("unavailable");
  });
});

describe("step 66 draft editing and submission hints", () => {
  const record = {
    id: "b".repeat(24), projectId: "a".repeat(24), agencyId: "c".repeat(24), workType: "ROAD_RESURFACING", status: "DRAFT", priority: "HIGH", workingHours: "night", isEmergency: true,
    plannedStart: "2026-11-10T03:30:00.000Z", plannedEnd: "2026-11-12T11:30:00.000Z", geometry: { type: "LineString", coordinates: [[79.86, 6.93], [79.87, 6.94]] }, revision: 3,
  } as unknown as WorkRequestRecord;

  it("round-trips a stored draft through the form and builds a whitelisted PATCH body with the version", () => {
    const values = valuesFromRecord(record);
    expect(values).toMatchObject({ plannedStart: "2026-11-10T09:00", plannedEnd: "2026-11-12T17:00", workingHours: "night", isEmergency: true, coordinates: "79.86, 6.93\n79.87, 6.94" });
    expect(utcToColomboLocal("2026-11-10T03:30:00.000Z")).toBe("2026-11-10T09:00");
    const built = buildPatchBody(values, 3);
    if (!built.ok) throw new Error("expected ok");
    expect(Object.keys(built.body).sort()).toEqual(["geometry", "isEmergency", "plannedEnd", "plannedStart", "priority", "version", "workType", "workingHours"]);
    expect(built.body.version).toBe(3);
    expect(JSON.stringify(built.body)).not.toMatch(/projectId|agencyId|status|referenceNo/);
  });

  it("mirrors the server start rule: today (Colombo) for normal work, 48 hours back for emergencies", () => {
    const now = new Date("2026-06-10T10:00:00Z");
    expect(startRule("2026-06-10T01:00:00Z", false, now)).toBe("ok"); // 06:30 Colombo, same day
    expect(startRule("2026-06-09T10:00:00Z", false, now)).toBe("past");
    expect(startRule("2026-06-09T10:00:00Z", true, now)).toBe("ok");
    expect(startRule("2026-06-07T09:00:00Z", true, now)).toBe("emergency_too_old");
    expect(startRule(null, false, now)).toBe("ok");
  });

  it("maps each field to its wizard stage and keeps en/si/ta copy structurally identical", () => {
    expect(stageOfField("workType")).toBe("basics");
    expect(stageOfField("coordinates")).toBe("location");
    expect(stageOfField("workingHours")).toBe("schedule");
    const keys = (o: unknown, prefix = ""): string[] => (o && typeof o === "object" && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => keys(v, `${prefix}${k}.`)) : [prefix]);
    const en = keys(getWorkRequestCopy("en")).sort();
    expect(keys(getWorkRequestCopy("si")).sort()).toEqual(en);
    expect(keys(getWorkRequestCopy("ta")).sort()).toEqual(en);
  });
});

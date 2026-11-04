import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { Asset } from "../src/modules/assets/models/asset.model.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { DISTRICTS, PROVINCES, searchPlaces } from "../src/modules/inframap/gazetteer.js";
import { EMPTY_NF, normalizeFilters, parseLayerQuery, projectNarrow, roadworkNarrow } from "../src/modules/inframap/inframap.filters.js";
import { shapedGeometry, simplifyLine, toleranceForZoom } from "../src/modules/inframap/inframap.geo.js";
import { matcherOf, rankOf } from "../src/modules/inframap/inframap.search.service.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { HazardZone } from "../src/modules/risk/models/hazard-zone.model.js";
import { WorkRequest } from "../src/modules/roadsync/models/work-request.model.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

const BBOX = "bbox=79.8,6.9,79.95,6.97";

describe("unified filters, gazetteer and geometry shaping (pure)", () => {
  const parse = (q: Record<string, string>) => parseLayerQuery("projects", { bbox: "79.8,6.9,79.95,6.97", ...q });
  it("accepts CSV multi-values (OR), caps them at 12, validates enums and keeps legacy names working", () => {
    const ok = parse({ projectStatus: "ACTIVE,APPROVED", district: "Colombo", status: "DELAYED" });
    expect(ok.ok && ok.q.nf.projectStatus).toEqual(["ACTIVE", "APPROVED", "DELAYED"]);
    expect(ok.ok && ok.q.limit).toBe(500);
    expect(ok.ok && ok.q.fields).toBe("min");
    const many = Array.from({ length: 13 }, (_, i) => `a${i}`).join(",");
    for (const bad of [{ projectStatus: many }, { projectStatus: "NOPE" }, { district: "Atlantis" }, { agencyId: "xyz" }, { limit: "5000" }, { limit: "0" }, { zoom: "23" }, { fields: "all" }, { dateFrom: "2026-13-40" }, { dateFrom: "2026-02-01", dateTo: "2026-01-01" }, { dateFrom: "2020-01-01", dateTo: "2026-01-02" }, { overdue: "maybe" }, { unknown: "1" }]) {
      expect(parse(bad as Record<string, string>).ok, JSON.stringify(bad)).toBe(false);
    }
    expect(parseLayerQuery("projects", { bbox: "79.8,6.9,79.95,6.97", district: ["Colombo", "Galle"] }).ok).toBe(false);
    expect(normalizeFilters("conflicts", { group: "closed", band: "high" })).toMatchObject({ ok: true, nf: { conflictStatusGroup: "resolved", conflictBand: ["high"] } });
  });

  it("builds AND-across, OR-within Mongo fragments with overlap date semantics and no cross-layer hiding", () => {
    const nf = { ...EMPTY_NF(), projectStatus: ["ACTIVE", "APPROVED"], district: ["Colombo"], dateFrom: new Date("2026-03-01T00:00:00Z"), dateTo: new Date("2026-03-31T23:59:59Z") };
    const p = projectNarrow(nf) as { $and: Record<string, unknown>[] };
    expect(p.$and).toContainEqual({ status: { $in: ["ACTIVE", "APPROVED"] } });
    expect(p.$and).toContainEqual({ plannedEndDate: { $gte: nf.dateFrom } });
    expect(p.$and).toContainEqual({ startDate: { $lte: nf.dateTo } });
    expect(projectNarrow({ ...EMPTY_NF(), roadworkStatus: ["ACTIVE"] })).toEqual({});
    expect(roadworkNarrow({ ...EMPTY_NF(), projectStatus: ["ACTIVE"] }, null)).toEqual({});
    expect(JSON.stringify(projectNarrow(nf, "projectStatus"))).not.toContain("ACTIVE");
  });

  it("has the 9 provinces and 25 districts and finds places by exact, prefix and word match", () => {
    expect(PROVINCES).toHaveLength(9);
    expect(DISTRICTS).toHaveLength(25);
    for (const d of DISTRICTS) expect(d.bbox[0] < d.bbox[2] && d.bbox[1] < d.bbox[3] && d.bbox[0] > 79 && d.bbox[2] < 82.1, d.name).toBe(true);
    expect(searchPlaces("kandy")[0]).toMatchObject({ kind: "district", name: "Kandy" });
    expect(searchPlaces("west")[0]).toMatchObject({ kind: "province", name: "Western Province" });
    expect(searchPlaces("x")).toEqual([]);
  });

  it("ranks exact above prefix above word above contains, with regex characters taken literally", () => {
    const m = matcherOf("galle");
    expect(["galle", "Galle Road", "Old Galle Road", "Regalle"].map((t) => rankOf(m, t))).toEqual([1, 2, 3, 4]);
    expect(rankOf(matcherOf(".*"), "anything")).toBe(0);
    expect(rankOf(matcherOf("(b"), "a (b)")).toBe(3);
    expect(rankOf(matcherOf("b)"), "a (b)")).toBe(4);
  });

  it("rounds to 5 decimals below zoom 12, simplifies by zoom, and collapses big polygons to a point at national zoom", () => {
    const line = { type: "LineString", coordinates: Array.from({ length: 200 }, (_, i) => [79.85 + i * 0.0001, 6.92 + Math.sin(i) * 0.00005]) };
    const low = shapedGeometry(line, { zoom: 8 }) as { coordinates: number[][] };
    expect(low.coordinates.length).toBeLessThan(10);
    expect(low.coordinates[0]).toEqual([79.85, 6.92]);
    expect((shapedGeometry(line, { zoom: 18 }) as { coordinates: number[][] }).coordinates.length).toBeGreaterThan(100);
    expect(shapedGeometry({ type: "Point", coordinates: [79.8612345678, 6.9271234567] }, { zoom: 10 })).toEqual({ type: "Point", coordinates: [79.86123, 6.92712] });
    expect(shapedGeometry({ type: "Point", coordinates: [79.8612345678, 6.9271234567] }, { zoom: 14 })).toEqual({ type: "Point", coordinates: [79.861235, 6.927123] });
    const poly = { type: "Polygon", coordinates: [[[79, 6], [80, 6], [80, 7], [79, 7], [79, 6]]] };
    expect(shapedGeometry(poly, { zoom: 5 })).toMatchObject({ type: "Point" });
    expect(shapedGeometry(poly, { zoom: 10 })).toMatchObject({ type: "Polygon" });
    expect(shapedGeometry({ type: "Point", coordinates: [200, 0] }, { zoom: 10 })).toBeNull();
    expect(simplifyLine([[0, 0], [1, 0.0001], [2, 0]], 0.001)).toEqual([[0, 0], [2, 0]]);
    expect(toleranceForZoom(10)).toBeLessThan(toleranceForZoom(5));
  });
});

async function seedRoles() {
  for (const key of Object.keys(SYSTEM_ROLE_PERMISSIONS) as SystemRoleKey[]) await Role.create({ key, name: SYSTEM_ROLE_META[key].name, description: SYSTEM_ROLE_META[key].description, permissions: [...SYSTEM_ROLE_PERMISSIONS[key]], scopeType: SYSTEM_ROLE_META[key].scopeType, isSystem: true, isActive: true });
}
async function actor(email: string, role: SystemRoleKey, agencyId: unknown) {
  const r = await Role.findOne({ key: role });
  const user = await User.create({ firstName: "Nimal", lastName: "Perera", email, passwordHash: await hash("correct-horse-battery", 4), roleId: r!._id, agencyId, status: "ACTIVE", emailVerified: true, credentialEpoch: 1 });
  return { user, token: (await signAccessToken(user._id.toString(), 1)).token };
}
const at = (n: number) => new Date(`${new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)}T04:00:00.000Z`);
const POLY = { type: "Polygon", coordinates: [[[79.855, 6.922], [79.87, 6.922], [79.87, 6.934], [79.855, 6.934], [79.855, 6.922]]] };

describe("Batch 03 search, facets, health, filters, payload controls and detail", { timeout: 300_000 }, () => {
  const app = createApp();
  const api = "/api/v1/inframap";
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-inframap-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-inframap-0123456789abcde";
    await startIsolatedMongo();
    for (const m of [Asset, Project, HazardZone, WorkRequest]) await m.init();
  }, 300_000);
  afterEach(async () => {
    for (const m of [Asset, HazardZone, WorkRequest, Project]) await m.deleteMany({});
    await clearCoreCollections();
  });
  afterAll(async () => { await stopIsolatedMongo(); });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const get = (t: string | null, path: string) => { const r = request(app).get(`${api}/${path}`); return t ? r.set(auth(t)) : r; };
  const ids = (res: { body: { data: { features: { properties: { id: string } }[] } } }) => res.body.data.features.map((f) => f.properties.id).sort();
  const group = (res: { body: { data: { groups: { layer: string; items: { id: string; title: string; noLocation?: boolean; geometryHint: unknown }[]; hasMore: boolean }[] } } }, layer: string) => res.body.data.groups.find((g) => g.layer === layer);

  async function ready() {
    await seedRoles();
    const [agA, agB] = await Promise.all(["A", "B"].map((c) => Agency.create({ code: `AG_${c}`, name: `Agency ${c}`, type: "DEPARTMENT", status: "ACTIVE" })));
    const officerA = await actor("oa-b3@example.com", "AGENCY_OFFICER", agA!._id);
    const officerB = await actor("ob-b3@example.com", "AGENCY_OFFICER", agB!._id);
    const superUser = await actor("su-b3@example.com", "SUPER_ADMIN", agA!._id);
    const inspector = await actor("in-b3@example.com", "INSPECTOR", agA!._id);
    const loc = { district: "Colombo", province: "Western Province", locality: "Fort", roadName: "Galle Road" };
    const project = (code: string, title: string, agencyId: unknown, geometry?: unknown, extra: Record<string, unknown> = {}) => Project.create({ projectCode: code, title, projectType: "ROAD", agencyId, managerId: officerA.user._id, budget: { amountMinor: 1000, currency: "LKR" }, status: "ACTIVE", physicalProgress: 10, financialProgress: 5, createdBy: officerA.user._id, location: loc, startDate: at(-30), plannedEndDate: at(30), ...(geometry ? { geometry } : {}), ...extra });
    const pExact = await project("INF-BTHREE-1", "Galle", agA!._id, { type: "Point", coordinates: [79.86, 6.925] });
    const pPrefix = await project("INF-BTHREE-2", "Galle Road widening", agA!._id, { type: "LineString", coordinates: Array.from({ length: 120 }, (_, i) => [79.85 + i * 0.0001, 6.926 + Math.sin(i) * 0.00005]) }, { status: "APPROVED" });
    const pWord = await project("INF-BTHREE-3", "Old Galle Road", agA!._id, { type: "Point", coordinates: [79.862, 6.927] }, { location: { district: "Gampaha", province: "Western Province" } });
    const pNone = await project("INF-BTHREE-4", "Unmapped Galle depot", agA!._id, undefined, { location: { district: "Colombo", province: "Western Province" } });
    const pOther = await project("INF-BTHREE-5", "Galle Fort (agency B)", agB!._id, { type: "Point", coordinates: [79.9, 6.95] });
    const asset = (name: string, assetType: string, agencyId: unknown, geometry: unknown, extra: Record<string, unknown> = {}) => Asset.create({ sourceProjectId: pExact._id, assetType, name, agencyId, geometry, condition: "GOOD", healthScore: 70, commissionedAt: new Date("2020-01-01"), lastInspectionAt: new Date(), location: loc, ...extra });
    const main = await asset("RESTRICTED-WATER-MAIN", "WATER", agA!._id, { type: "LineString", coordinates: [[79.857, 6.926], [79.867, 6.93]] });
    const drain = await asset("Open drain galle", "DRAINAGE", agA!._id, { type: "Point", coordinates: [79.86, 6.927] }, { sensitivity: "STANDARD" });
    const bridge = await asset("Galle bridge", "BRIDGE", agA!._id, { type: "Point", coordinates: [79.862, 6.928] }, { condition: "POOR" });
    const theirs = await asset("Galle road of B", "ROAD", agB!._id, { type: "LineString", coordinates: [[79.859, 6.924], [79.868, 6.926]] }, { location: { district: "Colombo", province: "Western Province", locality: "SECRET-LOCALITY-B", roadName: "SECRET-ROAD-B" } });
    const flood = await HazardZone.create({ name: "Galle flood zone", hazardType: "FLOOD", level: "HIGH", geometry: POLY, source: { kind: "DEMO", organisation: "Demo", datasetName: "D", retrievedAt: new Date() }, isDemo: true });
    const wr = await WorkRequest.create({ agencyId: agA!._id, projectId: pExact._id, status: "SUBMITTED", geometry: { type: "LineString", coordinates: [[79.86, 6.93], [79.87, 6.93]] }, workType: "ROAD_RESURFACING", priority: "NORMAL", plannedStart: at(-5), plannedEnd: at(-1) });
    return { officerA, officerB, superUser, inspector, pExact, pPrefix, pWord, pNone, pOther, main, drain, bridge, theirs, flood, wr };
  }

  it("rejects short, malformed and unknown search input, treats regex characters literally, and caps results", async () => {
    const d = await ready();
    expect((await get(null, "search?q=galle")).status).toBe(401);
    for (const q of ["q=g", "q=", "", `q=${"a".repeat(81)}`, "q=galle&limit=16", "q=galle&layers=nope", "q=galle&scope=everything", "q=galle&district=Nowhere", "q=galle&x=1", "q=a&q=b", "q=ga%00lle"]) expect((await get(d.officerA.token, `search?${q}`)).status, q).toBe(400);
    for (const q of [".*", "((", "[a-z]+", "galle)("]) {
      const r = await get(d.officerA.token, `search?q=${encodeURIComponent(q)}&layers=projects,assets`);
      expect(r.status, q).toBe(200);
      expect(r.body.data.groups.filter((g: { layer: string }) => ["projects", "assets"].includes(g.layer))).toEqual([]);
    }
    const capped = await get(d.officerA.token, "search?q=galle&layers=projects&limit=2");
    expect(group(capped, "projects")!.items).toHaveLength(2);
    expect(group(capped, "projects")!.hasMore).toBe(true);
    expect(capped.headers["cache-control"]).toContain("no-store");
  });

  it("ranks exact, prefix, word then contains, flags unmapped projects, and never finds other agencies' records", async () => {
    const d = await ready();
    const r = await get(d.officerA.token, "search?q=galle&layers=projects");
    const titles = group(r, "projects")!.items.map((i) => i.title);
    expect(titles.slice(0, 3)).toEqual(["Galle", "Galle Road widening", "Old Galle Road"]);
    expect(titles).toContain("Unmapped Galle depot");
    expect(titles).not.toContain("Galle Fort (agency B)");
    const unmapped = group(r, "projects")!.items.find((i) => i.title === "Unmapped Galle depot")!;
    expect(unmapped).toMatchObject({ noLocation: true, geometryHint: null });
    expect(group(r, "projects")!.items[0]!.geometryHint).toMatchObject({ kind: "point" });
    expect(JSON.stringify(r.body)).not.toMatch(/"coordinates":\[\[|geometry"/);
    const exactCode = await get(d.officerA.token, "search?q=INF-BTHREE-2&layers=projects");
    expect(group(exactCode, "projects")!.items.map((i) => i.id)).toEqual([d.pPrefix.id]);
    expect(group(await get(d.officerB.token, "search?q=galle&layers=projects"), "projects")!.items.map((i) => i.title)).toEqual(["Galle Fort (agency B)"]);
    const view = await get(d.officerA.token, `search?q=galle&layers=projects&scope=view&${BBOX}`);
    expect(group(view, "projects")!.items.map((i) => i.title)).not.toContain("Unmapped Galle depot");
    const filtered = await get(d.officerA.token, "search?q=galle&layers=projects&projectStatus=APPROVED");
    expect(group(filtered, "projects")!.items.map((i) => i.id)).toEqual([d.pPrefix.id]);
  });

  it("never matches, counts or hints at restricted utilities or other agencies' location text", async () => {
    const d = await ready();
    const a = await get(d.officerA.token, "search?q=RESTRICTED-WATER&layers=utilities,assets");
    expect(a.status).toBe(200);
    expect(a.body.data.groups).toEqual([]);
    expect(JSON.stringify(a.body)).not.toContain("RESTRICTED");
    expect(group(await get(d.superUser.token, "search?q=RESTRICTED-WATER&layers=utilities"), "utilities")!.items.map((i) => i.id)).toEqual([d.main.id]);
    const probe = await get(d.officerA.token, "search?q=SECRET-LOCALITY&layers=assets");
    expect(probe.body.data.groups).toEqual([]);
    expect(group(await get(d.officerB.token, "search?q=SECRET-LOCALITY&layers=assets"), "assets")!.items.map((i) => i.id)).toEqual([d.theirs.id]);
    const own = await get(d.officerA.token, "search?q=galle&layers=assets,utilities");
    expect(group(own, "assets")!.items.map((i) => i.title).sort()).toEqual(["Galle bridge", "Galle road of B"]);
  });

  it("omits forbidden layers, returns agencies and places, and keeps the work-type match inside the viewer's scope", async () => {
    const d = await ready();
    const r = await get(d.inspector.token, "search?q=galle&layers=risks,assets,places");
    expect(group(r, "risks")).toBeUndefined();
    expect(group(await get(d.officerA.token, "search?q=galle&layers=risks"), "risks")!.items[0]).toMatchObject({ title: "Galle flood zone", badge: "DEMO" });
    const places = await get(d.officerA.token, "search?q=colombo&layers=places,agencies");
    expect(group(places, "places")!.items[0]).toMatchObject({ title: "Colombo", geometryHint: { kind: "bbox" } });
    expect(group(await get(d.officerA.token, "search?q=Agency&layers=agencies"), "agencies")!.items.map((i) => i.title)).toContain("Agency A");
    expect(group(await get(d.officerA.token, "search?q=resurfacing&layers=roadworks"), "roadworks")!.items.map((i) => i.id)).toEqual([d.wr.id]);
    expect(group(await get(d.officerB.token, "search?q=resurfacing&layers=roadworks"), "roadworks")).toBeUndefined();
  });

  it("facets count within scope, exclude their own filter, hide restricted counts and omit forbidden layers", async () => {
    const d = await ready();
    const base = await get(d.officerA.token, `facets?${BBOX}`);
    expect(base.status).toBe(200);
    expect(base.body.data.projects.projectStatus).toEqual(expect.arrayContaining([{ value: "ACTIVE", count: 2 }, { value: "APPROVED", count: 1 }]));
    // Selecting a status leaves that facet's own counts alone but narrows the others.
    const narrowed = await get(d.officerA.token, `facets?${BBOX}&projectStatus=APPROVED&district=Colombo`);
    expect(narrowed.body.data.projects.projectStatus).toEqual(expect.arrayContaining([{ value: "ACTIVE", count: 1 }, { value: "APPROVED", count: 1 }]));
    expect(narrowed.body.data.projects.projectType).toEqual([{ value: "ROAD", count: 1 }]);
    expect(base.body.data.utilities.utilityClass).toEqual([{ value: "drainage", count: 1 }]);
    expect(JSON.stringify(base.body)).not.toContain("water");
    expect((await get(d.superUser.token, `facets?${BBOX}`)).body.data.utilities.utilityClass).toEqual(expect.arrayContaining([{ value: "water", count: 1 }, { value: "drainage", count: 1 }]));
    expect(base.body.data.global.agencies.map((a: { label: string }) => a.label)).toContain("Agency A");
    expect(base.body.data.global.districts).toEqual(expect.arrayContaining([{ value: "Colombo", count: expect.any(Number) }]));
    expect((await get(d.inspector.token, `facets?${BBOX}`)).body.data.risks).toBeUndefined();
    expect(base.body.data.risks.hazardLevel).toEqual([{ value: "HIGH", count: 1 }]);
    expect((await get(d.officerA.token, `facets?${BBOX}&dateFrom=2026-05-01&dateTo=2026-01-01`)).status).toBe(400);
  });

  it("reports data health per layer with counts only for what the viewer cannot see", async () => {
    const d = await ready();
    const a = await get(d.officerA.token, "health");
    expect(a.status).toBe(200);
    const projects = a.body.data.layers.find((l: { layer: string }) => l.layer === "projects");
    expect(projects).toMatchObject({ total: 4, withGeometry: 3, withoutGeometry: 1, completenessPct: 75 });
    expect(a.body.data.unmappedProjects.items.map((p: { id: string }) => p.id)).toEqual([d.pNone.id]);
    expect(a.body.data.layers.find((l: { layer: string }) => l.layer === "utilities")).toMatchObject({ total: 1, restrictedHidden: 1 });
    const assets = a.body.data.layers.find((l: { layer: string }) => l.layer === "assets");
    expect(assets).toMatchObject({ total: 2 });
    expect(JSON.stringify(a.body)).not.toContain("RESTRICTED-WATER");
    expect(a.body.data.layers.find((l: { layer: string }) => l.layer === "utilities").restrictedHidden).toBe(1);
    expect((await get(d.superUser.token, "health")).body.data.layers.find((l: { layer: string }) => l.layer === "utilities")).toMatchObject({ total: 2, restrictedHidden: 0 });
    expect((await get(d.inspector.token, "health")).body.data.layers.find((l: { layer: string }) => l.layer === "risks")).toBeUndefined();
    expect((await get(d.officerA.token, "health?x=1")).status).toBe(400);
  });

  it("applies unified filters with bbox, supports zoom and fields, reports totals and answers 304 on an unchanged layer", async () => {
    const d = await ready();
    const filtered = await get(d.officerA.token, `projects?${BBOX}&projectStatus=ACTIVE&district=Colombo`);
    expect(ids(filtered)).toEqual([d.pExact.id]);
    expect(ids(await get(d.officerA.token, `projects?${BBOX}&projectStatus=ACTIVE,APPROVED&province=Western%20Province`))).toEqual([d.pExact.id, d.pPrefix.id, d.pWord.id].sort());
    expect(ids(await get(d.officerA.token, `projects?${BBOX}&status=APPROVED`))).toEqual([d.pPrefix.id]);
    expect(ids(await get(d.officerA.token, `projects?${BBOX}&dateFrom=${at(100).toISOString().slice(0, 10)}`))).toEqual([]);
    expect(ids(await get(d.officerA.token, `projects?${BBOX}&dateTo=${at(-100).toISOString().slice(0, 10)}`))).toEqual([]);
    expect(ids(await get(d.officerA.token, `roadworks?${BBOX}&overdue=1&district=Colombo`))).toEqual([d.wr.id]);
    expect(ids(await get(d.officerA.token, `roadworks?${BBOX}&roadworkStatus=ACTIVE`))).toEqual([]);
    expect(ids(await get(d.officerA.token, `assets?${BBOX}&assetType=BRIDGE&condition=POOR`))).toEqual([d.bridge.id]);
    expect(ids(await get(d.officerA.token, `utilities?${BBOX}&utilityClass=drainage`))).toEqual([d.drain.id]);
    expect(ids(await get(d.superUser.token, `utilities?${BBOX}&utilityClass=water`))).toEqual([d.main.id]);
    expect((await get(d.officerA.token, `projects?${BBOX}&agencyId=${d.pOther.agencyId}`)).body.data.features).toEqual([]);
    // A filter that belongs to another layer does not hide this one.
    expect(ids(await get(d.officerA.token, `projects?${BBOX}&roadworkStatus=CANCELLED&conflictBand=critical`))).toHaveLength(3);

    const min = (await get(d.officerA.token, `projects?${BBOX}`)).body.data.features[0].properties;
    const full = (await get(d.officerA.token, `projects?${BBOX}&fields=full`)).body.data.features[0].properties;
    expect(min).not.toHaveProperty("plannedEndDate");
    expect(full).toHaveProperty("plannedEndDate");
    const low = (await get(d.officerA.token, `projects?${BBOX}&zoom=8`)).body.data.features.find((f: { properties: { id: string } }) => f.properties.id === d.pPrefix.id);
    const high = (await get(d.officerA.token, `projects?${BBOX}&zoom=18`)).body.data.features.find((f: { properties: { id: string } }) => f.properties.id === d.pPrefix.id);
    expect(low.geometry.coordinates.length).toBeLessThan(high.geometry.coordinates.length);
    const limited = await get(d.officerA.token, `projects?${BBOX}&limit=1`);
    expect(limited.body.data).toMatchObject({ truncated: true, total: 3 });
    expect(limited.body.data.features).toHaveLength(1);

    const first = await get(d.officerA.token, `assets?${BBOX}`);
    const again = await request(app).get(`${api}/assets?${BBOX}`).set(auth(d.officerA.token)).set("If-None-Match", first.headers.etag!);
    expect(again.status).toBe(304);
    expect(again.text).toBe("");
    const other = await request(app).get(`${api}/assets?${BBOX}`).set(auth(d.officerB.token)).set("If-None-Match", first.headers.etag!);
    expect(other.status).toBe(200);
    expect(first.headers.vary).toContain("Authorization");
  });

  it("returns drawer detail for projects, roadworks, assets and zones with related records, real links, exposure and scope", async () => {
    const d = await ready();
    const project = await get(d.officerA.token, `features/projects/${d.pExact.id}`);
    expect(project.status).toBe(200);
    expect(project.body.data.properties).toMatchObject({ title: "Galle", projectCode: "INF-BTHREE-1", layer: "projects" });
    expect(project.body.data.links.record).toBe(`/projects/${d.pExact.id}/overview`);
    expect(project.body.data.related.map((r: { layer: string }) => r.layer)).toEqual(expect.arrayContaining(["roadworks", "assets", "utilities"]));
    expect(project.body.data.geometry.type).toBe("Point");
    expect(project.body.data.actions).toMatchObject({ canOpenRecord: true, canShowNearby: true, canExposure: true });
    expect(JSON.stringify(project.body)).not.toMatch(/budget|physicalProgress|financialProgress|managerId/);
    expect((await get(d.officerB.token, `features/projects/${d.pExact.id}`)).status).toBe(404);
    const wr = await get(d.officerA.token, `features/roadworks/${d.wr.id}`);
    expect(wr.body.data.properties).toMatchObject({ workType: "ROAD_RESURFACING", isOverdue: true, projectCode: "INF-BTHREE-1" });
    expect(wr.body.data.links.record).toBe(`/roadsync/work-requests/${d.wr.id}`);
    expect(wr.body.data.related).toEqual(expect.arrayContaining([expect.objectContaining({ layer: "projects", id: d.pExact.id })]));
    expect(wr.body.data.exposure).toMatchObject({ mode: "zones" });
    expect((await get(d.officerB.token, `features/roadworks/${d.wr.id}`)).status).toBe(404);
    const asset = await get(d.officerA.token, `features/assets/${d.bridge.id}`);
    expect(asset.body.data.links.record).toBeNull();
    expect(asset.body.data.actions.canOpenRecord).toBe(false);
    expect(asset.body.data.related[0]).toMatchObject({ layer: "projects", relation: "sourceProject" });
    expect((await get(d.officerA.token, `features/utilities/${d.main.id}`)).status).toBe(404);
    expect((await get(d.superUser.token, `features/utilities/${d.main.id}`)).status).toBe(200);
    const zone = await get(d.officerA.token, `features/risks/${d.flood.id}`);
    expect(zone.body.data.exposure).toMatchObject({ mode: "records" });
    expect(zone.body.data.provenance).toBe("DEMO");
    expect((await get(d.officerA.token, `features/conflicts/${d.flood.id}`)).status).toBe(404);
    expect((await get(d.officerA.token, `features/nope/${d.flood.id}`)).status).toBe(400);
    expect((await get(d.inspector.token, `features/risks/${d.flood.id}`)).status).toBe(404);
  });
});

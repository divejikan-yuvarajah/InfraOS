import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { Asset } from "../src/modules/assets/models/asset.model.js";
import { MaintenanceRecord } from "../src/modules/assets/models/maintenance-record.model.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import {
  attentionReasons, effectiveSensitivity, projectAssetProperties, representativePoint, riskBand, tierOf, visibleAssetFilter, type AssetRow, type Viewer,
} from "../src/modules/inframap/inframap.access.js";
import { envelopeAround } from "../src/modules/inframap/inframap.geo.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { HazardZone } from "../src/modules/risk/models/hazard-zone.model.js";
import { RiskAssessment } from "../src/modules/risk/models/risk-assessment.model.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

const viewer = (over: Partial<Viewer> = {}): Viewer => ({ platform: false, agencyIds: ["A"], canRestricted: false, canHealth: false, ...over });
const row = (over: Partial<AssetRow> = {}): AssetRow => ({
  id: "1", assetType: "ROAD", name: "Road", condition: "GOOD", agencyId: "A", agencyName: "Agency A", district: "Colombo", province: "Western", roadName: "Galle Rd",
  sensitivity: "STANDARD", healthScore: 80, lastInspectionAt: new Date(), nextMaintenanceAt: null, commissionedAt: new Date("2020-01-01"),
  sourceProjectId: "P", sourceProjectTitle: "Project", isDemo: false, ...over,
});

describe("Batch 02 access policy (pure)", () => {
  it("defaults utilities to RESTRICTED and everything else to STANDARD; an explicit value wins", () => {
    for (const t of ["WATER", "DRAINAGE", "ELECTRICITY", "TELECOM"]) expect(effectiveSensitivity({ assetType: t })).toBe("RESTRICTED");
    for (const t of ["ROAD", "BRIDGE", "BUILDING", "PUBLIC_FACILITY", "OTHER"]) expect(effectiveSensitivity({ assetType: t })).toBe("STANDARD");
    expect(effectiveSensitivity({ assetType: "DRAINAGE", sensitivity: "STANDARD" })).toBe("STANDARD");
    expect(effectiveSensitivity({ assetType: "ROAD", sensitivity: "RESTRICTED" })).toBe("RESTRICTED");
  });

  it("assigns tiers: platform, same agency, other agency standard, and restricted without the permission", () => {
    const std = { agencyId: "B", sensitivity: "STANDARD" as const };
    const res = { agencyId: "A", sensitivity: "RESTRICTED" as const };
    expect(tierOf(viewer({ platform: true, agencyIds: [], canRestricted: true }), { agencyId: "B", sensitivity: "RESTRICTED" })).toBe("FULL");
    expect(tierOf(viewer(), { agencyId: "A", sensitivity: "STANDARD" })).toBe("FULL");
    expect(tierOf(viewer(), std)).toBe("AWARENESS");
    expect(tierOf(viewer({ canRestricted: false }), res)).toBe("HIDDEN");
    expect(tierOf(viewer({ canRestricted: true }), res)).toBe("FULL");
    expect(tierOf(viewer({ canRestricted: true }), { agencyId: "B", sensitivity: "RESTRICTED" })).toBe("HIDDEN");
    expect(tierOf(viewer({ platform: true, canRestricted: false }), res)).toBe("HIDDEN");
  });

  it("builds a database filter that never matches restricted rows for a viewer without the permission", () => {
    expect(JSON.stringify(visibleAssetFilter(viewer()))).not.toContain('"RESTRICTED"}]}]}');
    const plain = visibleAssetFilter(viewer()) as { $or: unknown[] };
    expect(plain.$or).toHaveLength(1);
    expect((visibleAssetFilter(viewer({ canRestricted: true })) as { $or: unknown[] }).$or).toHaveLength(2);
  });

  it("strips health, dates, maintenance, source project and location text at the awareness tier", () => {
    const awareness = projectAssetProperties(row({ agencyId: "B" }), "assets", "AWARENESS", viewer({ canHealth: true }));
    for (const key of ["healthScore", "lastInspectionAt", "nextMaintenanceAt", "sourceProjectId", "sourceProjectTitle", "roadName", "needsAttention", "agencyId"]) expect(awareness, key).not.toHaveProperty(key);
    expect(awareness).toMatchObject({ tier: "AWARENESS", name: "Road", condition: "GOOD", agencyName: "Agency A" });
    const full = projectAssetProperties(row(), "assets", "FULL", viewer({ canHealth: true }));
    expect(full).toMatchObject({ healthScore: 80, sourceProjectId: "P", roadName: "Galle Rd", needsAttention: false });
    expect(projectAssetProperties(row(), "assets", "FULL", viewer())).not.toHaveProperty("healthScore");
  });

  it("applies the single attention rule", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(attentionReasons({ condition: "GOOD", lastInspectionAt: new Date("2026-01-01") }, now)).toEqual([]);
    expect(attentionReasons({ condition: "POOR", lastInspectionAt: new Date("2026-01-01") }, now)).toEqual(["CONDITION_POOR"]);
    expect(attentionReasons({ condition: "CRITICAL", lastInspectionAt: new Date("2026-01-01") }, now)).toEqual(["CONDITION_CRITICAL"]);
    expect(attentionReasons({ condition: "GOOD", nextMaintenanceAt: new Date("2026-05-01"), lastInspectionAt: new Date("2026-01-01") }, now)).toEqual(["MAINTENANCE_OVERDUE"]);
    expect(attentionReasons({ condition: "GOOD", lastInspectionAt: new Date("2024-01-01") }, now)).toEqual(["INSPECTION_STALE"]);
    expect(attentionReasons({ condition: "GOOD", commissionedAt: new Date("2020-01-01") }, now)).toEqual(["INSPECTION_STALE"]);
    expect(attentionReasons({ condition: "GOOD", commissionedAt: new Date("2026-03-01") }, now)).toEqual([]);
  });

  it("derives risk bands, representative points and a radius envelope", () => {
    expect([0, 33, 34, 66, 67, 100].map(riskBand)).toEqual(["LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH"]);
    expect(representativePoint({ type: "Point", coordinates: [79.9, 6.9] })).toEqual([79.9, 6.9]);
    expect(representativePoint({ type: "LineString", coordinates: [[1, 1], [2, 2], [3, 3]] })).toEqual([2, 2]);
    expect(representativePoint({ type: "Polygon", coordinates: [[[0, 0], [4, 0], [4, 2], [0, 0]]] })).toEqual([2, 1]);
    expect(representativePoint(null)).toBeNull();
    const [w, s, e, n] = envelopeAround([79.9, 6.9, 79.9, 6.9], 500);
    expect(n - s).toBeCloseTo(2 * (500 / 111_320), 6);
    expect(e - w).toBeGreaterThan(n - s);
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

const HERE = "79.8,6.9,79.95,6.97";
const POLY = { type: "Polygon", coordinates: [[[79.855, 6.922], [79.87, 6.922], [79.87, 6.934], [79.855, 6.934], [79.855, 6.922]]] };
const SOURCE = { kind: "DEMO", organisation: "Demo", datasetName: "[DEMO] dataset", retrievedAt: new Date() };

describe("Batch 02 asset, utility and risk layers", { timeout: 240_000 }, () => {
  const app = createApp();
  const api = "/api/v1/inframap";
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-inframap-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-inframap-0123456789abcde";
    await startIsolatedMongo();
    for (const m of [Asset, Project, HazardZone, RiskAssessment, MaintenanceRecord]) await m.init();
  }, 300_000);
  afterEach(async () => {
    for (const m of [MaintenanceRecord, Asset, HazardZone, RiskAssessment, Project]) await m.deleteMany({});
    await clearCoreCollections();
  });
  afterAll(async () => { await stopIsolatedMongo(); });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const get = (t: string | null, path: string) => { const r = request(app).get(`${api}/${path}`); return t ? r.set(auth(t)) : r; };
  const ids = (res: { body: { data: { features: { properties: { id: string } }[] } } }) => res.body.data.features.map((f) => f.properties.id).sort();

  async function ready() {
    await seedRoles();
    const [agA, agB] = await Promise.all(["A", "B"].map((c) => Agency.create({ code: `AG_${c}`, name: `Agency ${c}`, type: "DEPARTMENT", status: "ACTIVE" })));
    const officerA = await actor("oa-b2@example.com", "AGENCY_OFFICER", agA!._id);
    const officerB = await actor("ob-b2@example.com", "AGENCY_OFFICER", agB!._id);
    const superUser = await actor("su-b2@example.com", "SUPER_ADMIN", agA!._id);
    const inspector = await actor("in-b2@example.com", "INSPECTOR", agA!._id);
    const citizen = await actor("ci-b2@example.com", "CITIZEN", agA!._id);
    const project = (code: string, agencyId: unknown, geometry?: unknown) => Project.create({ projectCode: code, title: `Title ${code}`, projectType: "ROAD", agencyId, managerId: officerA.user._id, budget: { amountMinor: 1000, currency: "LKR" }, status: "ACTIVE", physicalProgress: 10, financialProgress: 5, createdBy: officerA.user._id, ...(geometry ? { geometry } : {}) });
    const pA = await project("INF-BTWO-1", agA!._id, { type: "LineString", coordinates: [[79.856, 6.925], [79.866, 6.929]] });
    const pB = await project("INF-BTWO-2", agB!._id, { type: "Point", coordinates: [79.9, 6.95] });
    const asset = (name: string, assetType: string, agencyId: unknown, geometry: unknown, extra: Record<string, unknown> = {}) => Asset.create({ sourceProjectId: pA._id, assetType, name, agencyId, geometry, condition: "GOOD", healthScore: 77, commissionedAt: new Date("2020-01-01"), lastInspectionAt: new Date(), ...extra });
    const main = await asset("RESTRICTED-WATER-MAIN", "WATER", agA!._id, { type: "LineString", coordinates: [[79.857, 6.926], [79.867, 6.93]] });
    const drain = await asset("OPEN-DRAIN-POINT", "DRAINAGE", agA!._id, { type: "Point", coordinates: [79.86, 6.927] }, { sensitivity: "STANDARD" });
    const bridge = await asset("BRIDGE-A", "BRIDGE", agA!._id, { type: "Point", coordinates: [79.862, 6.928] }, { condition: "POOR", nextMaintenanceAt: new Date(Date.now() - 86_400_000 * 20) });
    const theirs = await asset("ROAD-OF-B", "ROAD", agB!._id, { type: "LineString", coordinates: [[79.859, 6.924], [79.868, 6.926]] }, { condition: "CRITICAL", healthScore: 12 });
    await MaintenanceRecord.create({ assetId: bridge._id, maintenanceType: "ROUTINE", status: "COMPLETED", scheduledDate: new Date("2025-01-01"), completedDate: new Date("2025-01-02") });
    const flood = await HazardZone.create({ name: "[DEMO] Flood", hazardType: "FLOOD", level: "HIGH", geometry: POLY, source: SOURCE, isDemo: true });
    const agencyOnly = await HazardZone.create({ name: "[DEMO] B only", hazardType: "LANDSLIDE", level: "LOW", geometry: POLY, visibility: "AGENCY", agencyId: agB!._id, source: SOURCE, isDemo: true });
    await RiskAssessment.create({ projectId: pA._id, overallRisk: 20, delayRisk: 1, budgetRisk: 1, scheduleRisk: 1, modelVersion: "v1", createdAt: new Date("2025-01-01") });
    await RiskAssessment.create({ projectId: pA._id, overallRisk: 80, delayRisk: 1, budgetRisk: 1, scheduleRisk: 1, modelVersion: "v2", createdAt: new Date("2026-01-01"), factors: [{ category: "DELAY", description: "FREE-TEXT-SECRET", score: 90 }] });
    return { officerA, officerB, superUser, inspector, citizen, pA, pB, main, drain, bridge, theirs, flood, agencyOnly };
  }

  it("never returns restricted utility geometry to a viewer without map.layer.restricted, only a count", async () => {
    const d = await ready();
    const a = await get(d.officerA.token, `utilities?bbox=${HERE}`);
    expect(a.status).toBe(200);
    expect(ids(a)).toEqual([d.drain.id]);
    expect(a.body.data.restrictedHidden).toBe(1);
    const text = JSON.stringify(a.body);
    for (const leak of ["RESTRICTED-WATER-MAIN", "79.857", "79.867", d.main.id]) expect(text, leak).not.toContain(leak);
    const su = await get(d.superUser.token, `utilities?bbox=${HERE}`);
    expect(ids(su)).toEqual([d.main.id, d.drain.id].sort());
    expect(su.body.data.restrictedHidden).toBe(0);
    expect((await get(d.officerB.token, `utilities?bbox=${HERE}`)).body.data.restrictedHidden).toBe(1);
  });

  it("scopes assets by agency tier, flags attention at full tier only, and hides health from awareness", async () => {
    const d = await ready();
    const a = await get(d.officerA.token, `assets?bbox=${HERE}`);
    expect(ids(a)).toEqual([d.bridge.id, d.theirs.id].sort());
    const mine = a.body.data.features.find((f: { properties: { id: string } }) => f.properties.id === d.bridge.id).properties;
    expect(mine).toMatchObject({ tier: "FULL", needsAttention: true });
    expect(mine.attentionReasons).toEqual(expect.arrayContaining(["CONDITION_POOR", "MAINTENANCE_OVERDUE"]));
    const other = a.body.data.features.find((f: { properties: { id: string } }) => f.properties.id === d.theirs.id).properties;
    expect(other).toMatchObject({ tier: "AWARENESS", condition: "CRITICAL" });
    for (const key of ["healthScore", "nextMaintenanceAt", "lastInspectionAt", "sourceProjectId", "needsAttention"]) expect(other, key).not.toHaveProperty(key);
    expect(ids(await get(d.officerA.token, `assets?bbox=${HERE}&attention=1`))).toEqual([d.bridge.id]);
    expect(ids(await get(d.officerB.token, `assets?bbox=${HERE}&attention=1`))).toEqual([d.theirs.id]);
    expect(ids(await get(d.officerA.token, `assets?bbox=${HERE}&condition=CRITICAL`))).toEqual([d.theirs.id]);
  });

  it("serves hazard zones by visibility and project risk from the latest assessment only, without free text", async () => {
    const d = await ready();
    const a = await get(d.officerA.token, `risks?bbox=${HERE}`);
    expect(ids(a)).toContain(d.flood.id);
    expect(ids(a)).not.toContain(d.agencyOnly.id);
    expect(ids(await get(d.officerB.token, `risks?bbox=${HERE}&kind=hazard`))).toEqual([d.flood.id, d.agencyOnly.id].sort());
    const marker = a.body.data.features.find((f: { properties: { kind: string } }) => f.properties.kind === "project").properties;
    expect(marker).toMatchObject({ projectId: d.pA.id, overallRisk: 80, riskBand: "HIGH", modelVersion: "v2" });
    expect(JSON.stringify(a.body)).not.toContain("FREE-TEXT-SECRET");
    expect(a.body.data.features.find((f: { properties: { kind: string } }) => f.properties.kind === "hazard").properties).toMatchObject({ isDemo: true, source: { kind: "DEMO" } });
    expect(ids(await get(d.superUser.token, `risks?bbox=${HERE}&kind=project&projectLevel=LOW`))).toEqual([]);
  });

  it("answers exposure for a feature and for a zone within the viewer's scope", async () => {
    const d = await ready();
    const f = await get(d.officerA.token, `exposure?layer=projects&id=${d.pA.id}`);
    expect(f.status).toBe(200);
    expect(f.body.data).toMatchObject({ mode: "zones", worstLevel: "HIGH" });
    expect(f.body.data.zones.map((z: { id: string }) => z.id)).toEqual([d.flood.id]);
    const z = await get(d.officerA.token, `exposure?layer=risks&id=${d.flood.id}`);
    expect(z.body.data.mode).toBe("records");
    expect(z.body.data.records.projects.items.map((p: { id: string }) => p.id)).toEqual([d.pA.id]);
    expect(z.body.data.records.utilities.items.map((u: { id: string }) => u.id)).toEqual([d.drain.id]);
    expect(z.body.data.records.utilities.hidden).toBe(1);
    expect(JSON.stringify(z.body)).not.toContain("RESTRICTED-WATER-MAIN");
    expect((await get(d.officerA.token, `exposure?layer=projects&id=${d.pB.id}`)).status).toBe(404);
    expect((await get(d.officerA.token, `exposure?layer=risks&id=${d.agencyOnly.id}`)).status).toBe(404);
    expect((await get(d.inspector.token, `exposure?layer=projects&id=${d.pA.id}`)).status).toBe(403);
  });

  it("limits the nearby lens to whitelisted radii and applies tiers", async () => {
    const d = await ready();
    expect((await get(d.officerA.token, `nearby?featureLayer=projects&featureId=${d.pA.id}&radiusM=37`)).status).toBe(400);
    const ok = await get(d.officerA.token, `nearby?featureLayer=projects&featureId=${d.pA.id}&radiusM=250`);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ radiusM: 250, approximate: true, restrictedHidden: 1 });
    expect(ok.body.data.layers.assets.items.map((i: { id: string }) => i.id)).toContain(d.bridge.id);
    expect(JSON.stringify(ok.body)).not.toContain("RESTRICTED-WATER-MAIN");
    expect(JSON.stringify(ok.body)).not.toContain("coordinates\":[[79.857");
    const su = await get(d.superUser.token, `nearby?featureLayer=projects&featureId=${d.pA.id}&radiusM=250&layers=utilities`);
    expect(su.body.data.layers.utilities.items.map((i: { id: string }) => i.id)).toContain(d.main.id);
    expect((await get(d.officerB.token, `nearby?featureLayer=projects&featureId=${d.pA.id}&radiusM=100`)).status).toBe(404);
  });

  it("returns feature detail, hiding maintenance from awareness and answering 404 for restricted or out-of-scope ids", async () => {
    const d = await ready();
    const mine = await get(d.officerA.token, `features/assets/${d.bridge.id}`);
    expect(mine.body.data.maintenance).toHaveLength(1);
    expect(mine.body.data.properties).toMatchObject({ tier: "FULL" });
    const theirs = await get(d.officerA.token, `features/assets/${d.theirs.id}`);
    expect(theirs.body.data.maintenance).toEqual([]);
    expect((await get(d.officerA.token, `features/utilities/${d.main.id}`)).status).toBe(404);
    expect((await get(d.superUser.token, `features/utilities/${d.main.id}`)).status).toBe(200);
    expect((await get(d.officerA.token, `features/risks/${d.agencyOnly.id}`)).status).toBe(404);
    const marker = await get(d.officerA.token, `features/risks/${d.pA.id}`);
    expect(marker.body.data.properties.topFactors).toEqual([{ category: "DELAY", score: 90 }]);
    expect(JSON.stringify(marker.body)).not.toContain("FREE-TEXT-SECRET");
  });

  it("reports availability per layer so a forbidden layer never breaks the others, and enforces permissions and strict queries", async () => {
    const d = await ready();
    const layers = await get(d.inspector.token, "layers");
    expect(layers.body.data.layers.find((l: { id: string }) => l.id === "assets")).toMatchObject({ available: true });
    expect(layers.body.data.layers.find((l: { id: string }) => l.id === "risks")).toMatchObject({ available: false, reason: "forbidden" });
    expect((await get(d.inspector.token, `risks?bbox=${HERE}`)).status).toBe(403);
    expect((await get(d.inspector.token, `assets?bbox=${HERE}`)).status).toBe(200);
    expect((await get(d.citizen.token, `assets?bbox=${HERE}`)).status).toBe(403);
    expect((await get(null, `utilities?bbox=${HERE}`)).status).toBe(401);
    for (const q of ["assets?bbox=" + HERE + "&assetType=WATER", "utilities?bbox=" + HERE + "&assetType=ROAD", "risks?bbox=" + HERE + "&level=EXTREME", "assets?bbox=" + HERE + "&x=1", `assets?bbox=${HERE}&bbox=${HERE}`, "exposure?layer=projects", `exposure?layer=projects&id=${d.pA.id}&x=1`]) {
      expect((await get(d.superUser.token, q)).status, q).toBe(400);
    }
  });
});

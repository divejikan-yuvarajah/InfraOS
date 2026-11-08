import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { documentAccess, documentCaps, documentReadFilter, type DocFacts, type DocViewer } from "../src/modules/documents/document-access.js";
import { Document } from "../src/modules/documents/models/document.model.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const id = () => new mongoose.Types.ObjectId();
const [A, A2, B] = [id(), id(), id()];
const [P1, P2] = [id(), id()];
const me = id();
const other = id();

const viewers: DocViewer[] = [
  { roleKey: "SUPER_ADMIN", userId: String(me), agencyId: String(A), scopeKind: "platform", agencyIds: [], projectIds: [] },
  { roleKey: "GOV_ADMIN", userId: String(me), agencyId: String(A), scopeKind: "agencies", agencyIds: [String(A), String(A2)], projectIds: [] },
  { roleKey: "AGENCY_OFFICER", userId: String(me), agencyId: String(A), scopeKind: "agencies", agencyIds: [String(A)], projectIds: [] },
  { roleKey: "PROJECT_MANAGER", userId: String(me), agencyId: String(A), scopeKind: "agencies", agencyIds: [String(A)], projectIds: [String(P1)] },
  { roleKey: "INSPECTOR", userId: String(me), agencyId: String(A), scopeKind: "none", agencyIds: [], projectIds: [String(P1)] },
  { roleKey: "CONTRACTOR", userId: String(me), agencyId: String(A), scopeKind: "none", agencyIds: [], projectIds: [] },
  { roleKey: "CITIZEN", userId: String(me), agencyId: String(A), scopeKind: "none", agencyIds: [], projectIds: [] },
];

describe("documentAccess agrees with documentReadFilter (Step 109)", { timeout: 180_000 }, () => {
  beforeAll(async () => { await startIsolatedMongo(); }, 300_000);
  afterAll(async () => { await clearCoreCollections(); await stopIsolatedMongo(); });

  it("allows and denies identically over role x agency x project x visibility x confidentiality x status x category x owner", async () => {
    const rows: Record<string, unknown>[] = [];
    for (const agencyId of [A, A2, B]) for (const projectId of [P1, P2, null]) for (const visibility of ["INTERNAL", "PROJECT_TEAM", "PUBLIC"])
      for (const confidentiality of ["STANDARD", "SENSITIVE"]) for (const status of ["DRAFT", "ACTIVE", "SUPERSEDED", "ARCHIVED"])
        for (const category of ["INSPECTION_REPORT", "CONTRACT"]) for (const ownerId of [me, other])
          rows.push({ documentType: "OTHER", fileName: "x.pdf", uploadedBy: ownerId, ownerId, agencyId, ...(projectId ? { projectId } : {}), visibility, confidentiality, status, category, origin: "DOCTRACE", title: "t" });
    rows.push({ documentType: "OTHER", fileName: "gone.pdf", uploadedBy: me, ownerId: me, agencyId: A, visibility: "PUBLIC", confidentiality: "STANDARD", status: "ACTIVE", category: "OTHER", deletedAt: new Date() });
    rows.push({ documentType: "OTHER", fileName: "legacy.pdf", uploadedBy: me, agencyId: A, visibility: "PUBLIC" }); // un-backfilled: no status
    await Document.collection.insertMany(rows.map((r) => ({ ...r, extractedTextStatus: "NOT_STARTED", createdAt: new Date(), updatedAt: new Date() })));
    const all = await Document.find({}).lean();
    expect(all.length).toBe(rows.length);
    const facts = (d: (typeof all)[number]): DocFacts => ({ agencyId: String(d.agencyId), projectId: d.projectId ? String(d.projectId) : null, ownerId: d.ownerId ? String(d.ownerId) : null, uploadedBy: String(d.uploadedBy), status: d.status, visibility: d.visibility, confidentiality: d.confidentiality, category: d.category, deletedAt: d.deletedAt ?? null });
    for (const v of viewers) {
      const byFilter = new Set((await Document.find(documentReadFilter(v)).select("_id").lean()).map((d) => String(d._id)));
      const byFn = new Set(all.filter((d) => documentAccess(v, facts(d))).map((d) => String(d._id)));
      expect({ role: v.roleKey, extra: [...byFilter].filter((x) => !byFn.has(x)).length, missing: [...byFn].filter((x) => !byFilter.has(x)).length }).toEqual({ role: v.roleKey, extra: 0, missing: 0 });
    }
    const count = async (v: DocViewer) => Document.countDocuments(documentReadFilter(v));
    expect(await count(viewers[5]!)).toBe(0); // contractor
    expect(await count(viewers[6]!)).toBe(0); // citizen
    expect(await count(viewers[1]!)).toBeGreaterThan(await count(viewers[2]!)); // gov sees descendants, officer only own agency
    // Inspector: only assigned project, only allowlisted category, never SENSITIVE, never contracts
    const insp = await Document.find(documentReadFilter(viewers[4]!)).lean();
    expect(insp.length).toBeGreaterThan(0);
    for (const d of insp) {
      expect(String(d.projectId)).toBe(String(P1));
      expect(d.category).toBe("INSPECTION_REPORT");
      expect(d.confidentiality).not.toBe("SENSITIVE");
      expect(["PROJECT_TEAM", "PUBLIC"]).toContain(d.visibility);
    }
    // Other agency's documents never reach an officer of agency A
    expect((await Document.find(documentReadFilter(viewers[2]!)).lean()).some((d) => String(d.agencyId) === String(B))).toBe(false);
  });

  it("derives write capabilities from the same policy", () => {
    const has = (...p: string[]) => (x: string) => p.includes(x);
    const doc: DocFacts & { origin: string } = { agencyId: String(A), projectId: String(P1), ownerId: String(other), uploadedBy: String(other), status: "ACTIVE", visibility: "INTERNAL", confidentiality: "STANDARD", category: "CONTRACT", origin: "DOCTRACE" };
    const gov = documentCaps(viewers[1]!, doc, has("document.update", "document.upload", "document.delete", "document.restrict", "document.download"));
    expect(gov).toMatchObject({ canEdit: true, canArchive: true, canRestrict: true, canDelete: false }); // delete only once archived
    expect(documentCaps(viewers[1]!, { ...doc, status: "ARCHIVED" }, has("document.delete", "document.update")).canDelete).toBe(true);
    expect(documentCaps(viewers[3]!, doc, has("document.update", "document.upload")).canEdit).toBe(true); // manager of P1
    expect(documentCaps(viewers[3]!, { ...doc, projectId: String(P2) }, has("document.update", "document.upload")).canEdit).toBe(false);
    expect(documentCaps(viewers[3]!, doc, has("document.update", "document.restrict")).canRestrict).toBe(false);
    expect(documentCaps(viewers[0]!, doc, has("document.delete", "document.read")).canEdit).toBe(false);
    expect(documentCaps(viewers[2]!, { ...doc, agencyId: String(B) }, has("document.update")).canEdit).toBe(false); // other agency: no access at all
    expect(documentCaps(viewers[2]!, { ...doc, origin: "INSPECTION_EVIDENCE" }, has("document.update")).canEdit).toBe(false); // evidence is read-only here
    const ownDraft = { ...doc, ownerId: String(me), uploadedBy: String(me), status: "DRAFT", category: "INSPECTION_REPORT" };
    expect(documentCaps({ ...viewers[3]!, projectIds: [] }, { ...ownDraft, projectId: String(P1) }, has("document.upload")).canEdit).toBe(true); // uploader edits own draft
  });
});

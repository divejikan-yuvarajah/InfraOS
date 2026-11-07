import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Document } from "../src/modules/documents/models/document.model.js";
import { cleanupEvidence } from "../src/modules/inspections/evidence-cleanup.js";
import { getEvidenceStorage, storageKeyFor } from "../src/modules/inspections/evidence-storage.js";
import { InspectionEvidence } from "../src/modules/inspections/models/inspection-evidence.model.js";
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
import { id } from "./helpers/domain-fixtures.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

describe("evidence cleanup (dry run by default)", { timeout: 120_000 }, () => {
  beforeAll(async () => { await startIsolatedMongo(); }, 300_000);
  afterAll(async () => { await stopIsolatedMongo(); });
  afterEach(async () => { await Promise.all([Inspection.deleteMany({}), InspectionEvidence.deleteMany({}), Document.deleteMany({})]); });

  it("removes only stale pending uploads, leaves submitted work alone, and writes nothing in a dry run", async () => {
    const projectId = id(), agencyId = id(), inspectorId = id();
    const insp = await Inspection.create({ projectId, agencyId, inspectorId, inspectionDate: new Date(), status: "IN_PROGRESS" });
    const mk = async (status: "PENDING_UPLOAD" | "ACTIVE", ageHours: number, sha: string) => {
      const evidenceId = new mongoose.Types.ObjectId();
      const doc = await Document.create({ projectId, documentType: "SITE_EVIDENCE", fileName: `${sha}.jpg`, uploadedBy: inspectorId, mimeType: "image/jpeg", sizeBytes: 10, visibility: "INTERNAL", storageKey: storageKeyFor(String(insp._id), String(evidenceId), "full") });
      await InspectionEvidence.create({ _id: evidenceId, inspectionId: insp._id, projectId, agencyId, documentId: doc._id, capturedAt: new Date(), uploadedAt: new Date(Date.now() - ageHours * 3_600_000), uploadedBy: inspectorId, sha256: sha.repeat(64).slice(0, 64), mimeType: "image/jpeg", sizeBytes: 10, status });
      await getEvidenceStorage()!.put(storageKeyFor(String(insp._id), String(evidenceId), "full"), Buffer.from([0xff, 0xd8, 0xff, 1]), "image/jpeg");
      return evidenceId;
    };
    const stale = await mk("PENDING_UPLOAD", 48, "a");
    const fresh = await mk("PENDING_UPLOAD", 1, "b");
    const active = await mk("ACTIVE", 100, "c");

    const dry = await cleanupEvidence(false);
    expect(dry).toMatchObject({ mode: "dry-run", orphanedPending: 1, rowsRemoved: 0 });
    expect(await getEvidenceStorage()!.exists(storageKeyFor(String(insp._id), String(stale), "full"))).toBe(true);

    const done = await cleanupEvidence(true);
    expect(done).toMatchObject({ mode: "commit", orphanedPending: 1, rowsRemoved: 1 });
    expect((await InspectionEvidence.findById(stale))!.status).toBe("REMOVED");
    expect(await getEvidenceStorage()!.exists(storageKeyFor(String(insp._id), String(stale), "full"))).toBe(false);
    expect((await InspectionEvidence.findById(fresh))!.status).toBe("PENDING_UPLOAD");
    expect((await InspectionEvidence.findById(active))!.status).toBe("ACTIVE");
    expect(await getEvidenceStorage()!.exists(storageKeyFor(String(insp._id), String(active), "full"))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import mongoose from "mongoose";

import { Document } from "../src/modules/documents/models/document.model.js";
import { DocumentVersion } from "../src/modules/documents/models/document-version.model.js";

const id = () => new mongoose.Types.ObjectId();
const base = { documentType: "OTHER", fileName: "a.pdf", uploadedBy: id() };

describe("Document model (Batch 08)", () => {
  it("requires an agency or a project, and accepts either", async () => {
    await expect(new Document(base).validate()).rejects.toThrow("agencyId");
    await expect(new Document({ ...base, agencyId: id() }).validate()).resolves.toBeUndefined();
    await expect(new Document({ ...base, projectId: id() }).validate()).resolves.toBeUndefined();
  });
  it("normalises tags, caps them and never serialises storage fields", async () => {
    const d = new Document({ ...base, agencyId: id(), tags: ["  Road ", "ROAD2"], storageKey: "k" });
    await d.validate();
    expect(d.tags).toEqual(["road", "road2"]);
    expect(JSON.stringify(d.toJSON())).not.toMatch(/storageKey/);
    await expect(new Document({ ...base, agencyId: id(), tags: Array.from({ length: 16 }, (_, i) => `t${i}`) }).validate()).rejects.toThrow();
  });
  it("version rows keep storageRef out of JSON", () => {
    const v = new DocumentVersion({ documentId: id(), versionNo: 1, storageRef: "doc/x", fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 1, contentHash: "a".repeat(64), uploadedBy: id() });
    expect(JSON.stringify(v.toJSON())).not.toContain("storageRef");
  });
});

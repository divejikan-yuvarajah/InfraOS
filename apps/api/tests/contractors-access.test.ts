import { describe, expect, it } from "vitest";

import { canSee, certCounts, certState, projectContractor, reasonRequired, statusMoveAllowed, tierOf, type ContractorViewer } from "../src/modules/contractors/contractor.access.js";
import { emailKeyOf, nameKeyOf, taxIdKeyOf } from "../src/modules/contractors/contractor.keys.js";

const A = "a".repeat(24), B = "b".repeat(24);
const viewer = (patch: Partial<ContractorViewer> = {}): ContractorViewer => ({ platform: false, agencyIds: [A], canRead: true, canManage: false, canPerformance: false, canBudget: false, ...patch });
const now = new Date("2026-06-01T00:00:00Z");
const oid = (s: string) => ({ toString: () => s });
const doc = (owner: string | null = A) => ({
  _id: oid("c1"), name: "Alpha Ltd", registrationNumber: "R-1", status: "ACTIVE", registeredByAgencyId: owner ? oid(owner) : null,
  contact: { email: "secret@example.invalid", phone: "0112" }, business: { taxId: "TAX-SECRET" },
  documentRefs: [{ _id: oid("d1"), type: "TAX", title: "Tax cert" }],
  certifications: [{ _id: oid("k1"), name: "CIDA", expiresOn: new Date("2026-06-11T00:00:00Z"), status: "VALID" }],
});

describe("contractor visibility and tiers", () => {
  it("platform sees everything with contractor.read", () => {
    expect(canSee(viewer({ platform: true, agencyIds: [] }), doc(B), false)).toBe(true);
    expect(canSee(viewer({ platform: true, agencyIds: [], canRead: false }), doc(B), false)).toBe(false);
  });
  it("agency scope: registered in scope OR assigned in scope, otherwise invisible", () => {
    expect(canSee(viewer(), doc(A), false)).toBe(true);
    expect(canSee(viewer(), doc(B), false)).toBe(false);
    expect(canSee(viewer(), doc(B), true)).toBe(true);
    expect(canSee(viewer(), doc(null), false)).toBe(false); // platform-registered, not assigned in scope
    expect(canSee(viewer(), doc(null), true)).toBe(true);
  });
  it("scope none (contractor, inspector, citizen) sees nothing even when assigned", () => {
    expect(canSee(viewer({ agencyIds: [] }), doc(A), true)).toBe(false);
  });
  it("manage tier needs contractor.manage AND ownership; assigned-only stays directory", () => {
    expect(tierOf(viewer({ canManage: true }), doc(A), false)).toBe("manage");
    expect(tierOf(viewer({ canManage: true }), doc(B), true)).toBe("directory");
    expect(tierOf(viewer(), doc(A), false)).toBe("directory");
  });
  it("directory projection strips contact, tax id, document refs and certification detail", () => {
    const out = JSON.stringify(projectContractor(viewer(), doc(A), { assignedInScope: false, agencyName: "Agency A", now }));
    for (const secret of ["secret@example.invalid", "TAX-SECRET", "Tax cert", "0112", "CIDA"]) expect(out).not.toContain(secret);
    expect(JSON.parse(out).certifications).toMatchObject({ expiring: 1, total: 1 });
  });
  it("manage projection includes sensitive fields", () => {
    const out = projectContractor(viewer({ canManage: true }), doc(A), { assignedInScope: false, agencyName: null, now }) as unknown as { contact: { email: string }; business: { taxId: string }; documentRefs: unknown[] };
    expect(out.contact.email).toBe("secret@example.invalid");
    expect(out.business.taxId).toBe("TAX-SECRET");
    expect(out.documentRefs).toHaveLength(1);
  });
  it("invisible record projects to null (route answers 404)", () => {
    expect(projectContractor(viewer(), doc(B), { assignedInScope: false, agencyName: null })).toBeNull();
  });
});

describe("certifications, status moves and keys", () => {
  it("derives EXPIRING, EXPIRED, VALID and keeps REVOKED", () => {
    expect(certState({ expiresOn: new Date("2026-05-31T00:00:00Z") }, now)).toBe("EXPIRED");
    expect(certState({ expiresOn: new Date("2026-06-30T00:00:00Z") }, now)).toBe("EXPIRING");
    expect(certState({ expiresOn: new Date("2026-07-02T00:00:00Z") }, now)).toBe("VALID");
    expect(certState({ status: "REVOKED", expiresOn: new Date("2030-01-01") }, now)).toBe("REVOKED");
    expect(certState({}, now)).toBe("VALID");
    expect(certCounts([{ status: "REVOKED" }, { expiresOn: new Date("2020-01-01") }, {}], now)).toEqual({ valid: 1, expiring: 0, expired: 1, revoked: 1, total: 3 });
  });
  it("allows only legal status transitions and requires reasons", () => {
    expect(statusMoveAllowed("ACTIVE", "SUSPENDED")).toBe(true);
    expect(statusMoveAllowed("ARCHIVED", "SUSPENDED")).toBe(false);
    expect(statusMoveAllowed("INACTIVE", "SUSPENDED")).toBe(false);
    expect(statusMoveAllowed("ACTIVE", "ACTIVE")).toBe(false);
    expect(reasonRequired("ACTIVE")).toBe(false);
    expect(reasonRequired("ARCHIVED")).toBe(true);
  });
  it("normalises duplicate keys", () => {
    expect(nameKeyOf("Alpha (Pvt) Ltd.")).toBe("alpha");
    expect(nameKeyOf("ALPHA  Company Limited")).toBe("alpha");
    expect(taxIdKeyOf(" 12-34/ab ")).toBe("1234AB");
    expect(taxIdKeyOf("  ")).toBeUndefined();
    expect(emailKeyOf(" Foo@Bar.COM ")).toBe("foo@bar.com");
  });
});

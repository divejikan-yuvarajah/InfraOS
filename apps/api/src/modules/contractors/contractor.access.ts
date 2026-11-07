/**
 * Field-tier and visibility rules for contractors. Pure functions: the service passes in what it loaded, nothing here touches the database.
 *
 * Tiers (each includes the one before):
 *  - directory   `contractor.read` + visible: identity, status, category, regions, certification COUNTS. No contact, tax id, documents, contract values.
 *  - manage      `contractor.manage` AND the record belongs to an in-scope agency (or platform): full contact, business, certifications, document refs, status history.
 *  - performance `contractor.performance.read`: indicators and the evidence behind them (served by a separate endpoint).
 * Contract values on assignments need `contractor.manage` OR `finance.budget.read`.
 */
export type ContractorViewer = {
  platform: boolean;
  agencyIds: readonly string[];
  canRead: boolean;
  canManage: boolean;
  canPerformance: boolean;
  canBudget: boolean;
};

export type Tier = "none" | "directory" | "manage";

type IdLike = { toString(): string } | string | null | undefined;
type Owned = { registeredByAgencyId?: IdLike };
const idOf = (v: IdLike): string | null => (v == null ? null : v.toString());

export function ownedInScope(viewer: ContractorViewer, doc: Owned): boolean {
  if (viewer.platform) return true;
  const owner = idOf(doc.registeredByAgencyId);
  return owner !== null && viewer.agencyIds.includes(owner);
}

/** Registered by an in-scope agency, or assigned (any status) to a project the viewer can read. Platform sees all; scope "none" sees nothing. */
export function canSee(viewer: ContractorViewer, doc: Owned, assignedInScope: boolean): boolean {
  if (!viewer.canRead) return false;
  if (viewer.platform) return true;
  if (viewer.agencyIds.length === 0) return false;
  return ownedInScope(viewer, doc) || assignedInScope;
}

export function tierOf(viewer: ContractorViewer, doc: Owned, assignedInScope: boolean): Tier {
  if (!canSee(viewer, doc, assignedInScope)) return "none";
  return viewer.canManage && ownedInScope(viewer, doc) ? "manage" : "directory";
}

export const contractValuesVisible = (viewer: ContractorViewer): boolean => viewer.canManage || viewer.canBudget;

export type CertLike = { status?: string | null; expiresOn?: Date | string | null };
export type DerivedCertStatus = "VALID" | "EXPIRING" | "EXPIRED" | "REVOKED";

/** VALID turns EXPIRED once the date has passed; EXPIRING is VALID with 30 days or fewer left. REVOKED is manual and wins. */
export function certState(cert: CertLike, now: Date): DerivedCertStatus {
  if (cert.status === "REVOKED") return "REVOKED";
  if (cert.status === "EXPIRED") return "EXPIRED";
  if (!cert.expiresOn) return "VALID";
  const expires = new Date(cert.expiresOn).getTime();
  if (expires < now.getTime()) return "EXPIRED";
  return Math.floor((expires - now.getTime()) / 86_400_000) <= 30 ? "EXPIRING" : "VALID";
}

export function certCounts(certs: readonly CertLike[], now: Date) {
  const out = { valid: 0, expiring: 0, expired: 0, revoked: 0, total: certs.length };
  for (const c of certs) {
    const s = certState(c, now);
    if (s === "VALID") out.valid += 1;
    else if (s === "EXPIRING") out.expiring += 1;
    else if (s === "EXPIRED") out.expired += 1;
    else out.revoked += 1;
  }
  return out;
}

export type ContractorLike = Owned & {
  _id: { toString(): string };
  name: string;
  registrationNumber: string;
  status: string;
  category?: string | null;
  specializations?: readonly string[] | null;
  operatingDistricts?: readonly string[] | null;
  certifications?: readonly (CertLike & { _id: { toString(): string }; name: string; issuer?: string | null; referenceNumber?: string | null; issuedOn?: Date | null; revokedReason?: string | null })[] | null;
  documentRefs?: readonly { _id: { toString(): string }; type: string; title: string; referenceNumber?: string | null; documentId?: IdLike; notes?: string | null }[] | null;
  contact?: { contactPersonName?: string | null; email?: string | null; phone?: string | null; address?: string | null } | null;
  business?: { legalName?: string | null; taxId?: string | null; registrationAuthority?: string | null; cidaGrade?: string | null; registeredOn?: Date | null } | null;
  statusReason?: string | null;
  statusChangedAt?: Date | null;
  archivedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

export function directoryRow(doc: ContractorLike, agencyName: string | null, now: Date) { return directoryView(doc, agencyName, now); }

function directoryView(doc: ContractorLike, agencyName: string | null, now: Date) {
  return {
    id: doc._id.toString(), name: doc.name, registrationNumber: doc.registrationNumber, status: doc.status,
    category: doc.category ?? null, specializations: [...(doc.specializations ?? [])], operatingDistricts: [...(doc.operatingDistricts ?? [])],
    registeredByAgencyId: idOf(doc.registeredByAgencyId), agencyName,
    certifications: certCounts(doc.certifications ?? [], now),
    registeredAt: iso(doc.createdAt),
  };
}

/** The single projection point. Sensitive fields are absent from the object unless the tier allows them. */
export function projectContractor(viewer: ContractorViewer, doc: ContractorLike, ctx: { assignedInScope: boolean; agencyName: string | null; now?: Date }) {
  const now = ctx.now ?? new Date();
  const tier = tierOf(viewer, doc, ctx.assignedInScope);
  if (tier === "none") return null;
  const base = directoryView(doc, ctx.agencyName, now);
  if (tier === "directory") return { tier, ...base, restricted: true as const };
  return {
    tier, ...base, restricted: false as const,
    contact: { contactPersonName: doc.contact?.contactPersonName ?? null, email: doc.contact?.email ?? null, phone: doc.contact?.phone ?? null, address: doc.contact?.address ?? null },
    business: { legalName: doc.business?.legalName ?? null, taxId: doc.business?.taxId ?? null, registrationAuthority: doc.business?.registrationAuthority ?? null, cidaGrade: doc.business?.cidaGrade ?? null, registeredOn: iso(doc.business?.registeredOn) },
    certificationList: (doc.certifications ?? []).map((c) => ({ id: c._id.toString(), name: c.name, issuer: c.issuer ?? null, referenceNumber: c.referenceNumber ?? null, issuedOn: iso(c.issuedOn), expiresOn: iso(c.expiresOn), status: certState(c, now), revokedReason: c.revokedReason ?? null })),
    documentRefs: (doc.documentRefs ?? []).map((d) => ({ id: d._id.toString(), type: d.type, title: d.title, referenceNumber: d.referenceNumber ?? null, documentId: idOf(d.documentId), notes: d.notes ?? null })),
    statusReason: doc.statusReason ?? null, statusChangedAt: iso(doc.statusChangedAt), archivedAt: iso(doc.archivedAt),
    updatedAt: iso(doc.updatedAt),
  };
}

/** Profile gaps used by the completeness meter and the INCOMPLETE_CONTRACT_DATA flag. */
export function profileGaps(doc: ContractorLike): string[] {
  const gaps: string[] = [];
  if (!(doc.certifications ?? []).length) gaps.push("certifications");
  if (!doc.contact?.email && !doc.contact?.phone) gaps.push("contact");
  if (!doc.business?.registrationAuthority) gaps.push("registrationAuthority");
  return gaps;
}

/** Legal status moves. ARCHIVED to ACTIVE additionally needs platform scope (checked by the service). */
const MOVES: Record<string, readonly string[]> = {
  ACTIVE: ["SUSPENDED", "INACTIVE", "ARCHIVED"],
  SUSPENDED: ["ACTIVE", "INACTIVE", "ARCHIVED"],
  INACTIVE: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: ["ACTIVE"],
};
export const statusMoveAllowed = (from: string, to: string): boolean => (MOVES[from] ?? []).includes(to);
export const reasonRequired = (to: string): boolean => to === "SUSPENDED" || to === "INACTIVE" || to === "ARCHIVED";
export const canReceiveAssignments = (status: string): boolean => status === "ACTIVE";

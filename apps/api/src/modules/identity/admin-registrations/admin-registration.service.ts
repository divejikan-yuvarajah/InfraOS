import mongoose from "mongoose";

import { Agency } from "../../agencies/models/agency.model.js";
import { AuditLog } from "../../audit/models/audit-log.model.js";
import { Role } from "../models/role.model.js";
import { User, type UserDocument } from "../models/user.model.js";
import {
  RegistrationRequest,
  type RegistrationRequestDocument,
} from "../models/registration-request.model.js";
import {
  sendUserRegistrationApprovedNotification,
  sendUserRegistrationRejectedNotification,
} from "../mail/email.service.js";
import type { AuthenticatedActor } from "../auth/require-authenticated.js";
import type {
  AdminRegistrationApproveInput,
  AdminRegistrationListQuery,
  AdminRegistrationRejectInput,
} from "./admin-registration.schema.js";

export type AdminRegistrationDto = {
  id: string;
  referenceCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  organizationCode: string;
  organizationName: string;
  department: string;
  designation: string;
  requestedResponsibility: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  accountStatus: "pending" | "approved" | "rejected";
  acceptedTermsAt: string;
  createdAt: string;
  reviewedBy?: {
    id: string;
    email: string;
    displayName: string;
  } | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  approvalNotes?: string | null;
  assignedRole?: {
    id: string;
    key: string;
    name: string;
  } | null;
  assignedAgency?: {
    id: string;
    code: string;
    name: string;
  } | null;
  createdUserId?: string | null;
};

export type AdminRegistrationListResult = {
  items: AdminRegistrationDto[];
  total: number;
  page: number;
  limit: number;
  counts: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
};

function toDto(doc: any): AdminRegistrationDto {
  const reviewedByUser = doc.reviewedBy;
  const assignedRole = doc.assignedRoleId;
  const assignedAgency = doc.assignedAgencyId;

  return {
    id: doc._id.toString(),
    referenceCode: doc.referenceCode,
    firstName: doc.firstName,
    lastName: doc.lastName,
    fullName: doc.fullName || `${doc.firstName} ${doc.lastName}`.trim(),
    email: doc.email,
    organizationCode: doc.organizationCode,
    organizationName: doc.organizationName,
    department: doc.department,
    designation: doc.designation,
    requestedResponsibility: doc.requestedResponsibility,
    status: doc.status,
    accountStatus: doc.accountStatus || (doc.status === "APPROVED" ? "approved" : doc.status === "REJECTED" ? "rejected" : "pending"),
    acceptedTermsAt: doc.acceptedTermsAt ? new Date(doc.acceptedTermsAt).toISOString() : "",
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    reviewedBy: reviewedByUser
      ? {
          id: reviewedByUser._id ? reviewedByUser._id.toString() : String(reviewedByUser),
          email: reviewedByUser.email ?? "",
          displayName: reviewedByUser.displayName ?? `${reviewedByUser.firstName ?? ""} ${reviewedByUser.lastName ?? ""}`.trim(),
        }
      : null,
    reviewedAt: doc.reviewedAt ? new Date(doc.reviewedAt).toISOString() : null,
    rejectionReason: doc.rejectionReason ?? null,
    approvalNotes: doc.approvalNotes ?? null,
    assignedRole: assignedRole
      ? {
          id: assignedRole._id ? assignedRole._id.toString() : String(assignedRole),
          key: assignedRole.key ?? "",
          name: assignedRole.name ?? "",
        }
      : null,
    assignedAgency: assignedAgency
      ? {
          id: assignedAgency._id ? assignedAgency._id.toString() : String(assignedAgency),
          code: assignedAgency.code ?? "",
          name: assignedAgency.name ?? "",
        }
      : null,
    createdUserId: doc.createdUserId ? doc.createdUserId.toString() : null,
  };
}

export async function listRegistrationRequests(
  _actor: AuthenticatedActor,
  query: AdminRegistrationListQuery,
): Promise<AdminRegistrationListResult> {
  const filter: Record<string, unknown> = {};

  if (query.status && query.status !== "ALL") {
    filter.status = query.status;
  }

  if (query.q && query.q.trim().length > 0) {
    const escaped = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [
      { referenceCode: regex },
      { email: regex },
      { fullName: regex },
      { firstName: regex },
      { lastName: regex },
      { organizationName: regex },
      { organizationCode: regex },
      { department: regex },
      { designation: regex },
    ];
  }

  const [total, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    RegistrationRequest.countDocuments({}),
    RegistrationRequest.countDocuments({ status: "PENDING" }),
    RegistrationRequest.countDocuments({ status: "APPROVED" }),
    RegistrationRequest.countDocuments({ status: "REJECTED" }),
  ]);

  const filteredTotal = await RegistrationRequest.countDocuments(filter);
  const skip = (query.page - 1) * query.limit;

  const docs = await RegistrationRequest.find(filter)
    .populate("reviewedBy", "email firstName lastName")
    .populate("assignedRoleId", "name key")
    .populate("assignedAgencyId", "name code")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(query.limit)
    .lean();

  return {
    items: docs.map((d) => toDto(d)),
    total: filteredTotal,
    page: query.page,
    limit: query.limit,
    counts: {
      total,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
    },
  };
}

export async function getRegistrationRequest(
  _actor: AuthenticatedActor,
  id: string,
): Promise<AdminRegistrationDto | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  const doc = await RegistrationRequest.findById(id)
    .populate("reviewedBy", "email firstName lastName")
    .populate("assignedRoleId", "name key")
    .populate("assignedAgencyId", "name code")
    .lean();

  if (!doc) return null;
  return toDto(doc);
}

export async function approveRegistrationRequest(
  actor: AuthenticatedActor,
  id: string,
  input: AdminRegistrationApproveInput,
  requestId: string,
): Promise<{ ok: true; user: { id: string; email: string; status: string } } | { ok: false; code: string; message: string; status: number }> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, code: "NOT_FOUND", message: "Registration request not found", status: 404 };
  }

  const reqDoc = await RegistrationRequest.findById(id).select("+passwordHash");
  if (!reqDoc) {
    return { ok: false, code: "NOT_FOUND", message: "Registration request not found", status: 404 };
  }

  if (reqDoc.status !== "PENDING") {
    return {
      ok: false,
      code: "CONFLICT",
      message: `Request has already been ${reqDoc.status.toLowerCase()}`,
      status: 409,
    };
  }

  // 1. Resolve Role
  const role = await Role.findOne({ key: input.roleKey, isActive: true });
  if (!role) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: `Role ${input.roleKey} does not exist or is inactive`,
      status: 400,
    };
  }

  // 2. Resolve Agency
  let agency: any = null;
  if (input.agencyId && mongoose.Types.ObjectId.isValid(input.agencyId)) {
    agency = await Agency.findById(input.agencyId);
  } else if (input.agencyCode) {
    agency = await Agency.findOne({ code: input.agencyCode.toUpperCase(), status: "ACTIVE" });
  } else if (reqDoc.organizationCode) {
    agency = await Agency.findOne({ code: reqDoc.organizationCode.toUpperCase(), status: "ACTIVE" });
  }

  // If agency still not found, check if role allows platform scope
  if (!agency && role.scopeType === "AGENCY") {
    // Look up any active agency or default agency
    agency = await Agency.findOne({ status: "ACTIVE" });
  }

  // 3. Upsert / Create User in MongoDB
  let user = await User.findOne({ email: reqDoc.email }).select("+passwordHash");

  if (user) {
    user.roleId = role._id;
    if (agency) user.agencyId = agency._id;
    user.status = "ACTIVE";
    user.emailVerified = true;
    user.department = reqDoc.department;
    user.designation = reqDoc.designation;
    user.organizationCode = reqDoc.organizationCode;
    user.organizationName = reqDoc.organizationName;
    user.requestedResponsibility = reqDoc.requestedResponsibility;
    user.registrationRequestId = reqDoc._id;
    user.updatedBy = new mongoose.Types.ObjectId(actor.userId);
    await user.save();
  } else {
    user = await User.create({
      firstName: reqDoc.firstName,
      lastName: reqDoc.lastName,
      email: reqDoc.email,
      passwordHash: reqDoc.passwordHash,
      roleId: role._id,
      agencyId: agency?._id ?? null,
      status: "ACTIVE",
      emailVerified: true,
      credentialEpoch: 0,
      createdBy: new mongoose.Types.ObjectId(actor.userId),
      department: reqDoc.department,
      designation: reqDoc.designation,
      organizationCode: reqDoc.organizationCode,
      organizationName: reqDoc.organizationName,
      requestedResponsibility: reqDoc.requestedResponsibility,
      registrationRequestId: reqDoc._id,
    });
  }

  // 4. Update RegistrationRequest
  reqDoc.status = "APPROVED";
  reqDoc.accountStatus = "approved";
  reqDoc.assignedRoleId = role._id;
  reqDoc.assignedAgencyId = agency?._id ?? null;
  reqDoc.reviewedBy = new mongoose.Types.ObjectId(actor.userId);
  reqDoc.reviewedAt = new Date();
  reqDoc.approvalNotes = input.notes?.trim() ?? null;
  reqDoc.createdUserId = user._id;
  await reqDoc.save();

  // 5. Append Audit Log
  try {
    await AuditLog.create([
      {
        userId: new mongoose.Types.ObjectId(actor.userId),
        action: "user.registration_approved",
        resourceType: "USER",
        resourceId: user._id,
        agencyId: agency?._id ?? (actor.agencyId && mongoose.Types.ObjectId.isValid(actor.agencyId) ? new mongoose.Types.ObjectId(actor.agencyId) : null),
        newValue: {
          status: "ACTIVE",
          roleId: role._id,
          agencyId: agency?._id ?? null,
          reason: (input.notes || "Approved by Super Admin").slice(0, 500),
        },
        requestId: /^[A-Za-z0-9_-]+$/.test(requestId) ? requestId.slice(0, 100) : "approval",
      },
    ]);
  } catch {
    // Non-fatal audit recording
  }

  // 6. Send User Approval Email
  try {
    await sendUserRegistrationApprovedNotification({
      recipientEmail: reqDoc.email,
      recipientName: reqDoc.fullName,
      organizationName: reqDoc.organizationName,
      roleName: role.name,
    });
  } catch {
    // Non-fatal mail error
  }

  return {
    ok: true,
    user: {
      id: user._id.toString(),
      email: user.email,
      status: user.status,
    },
  };
}

export async function rejectRegistrationRequest(
  actor: AuthenticatedActor,
  id: string,
  input: AdminRegistrationRejectInput,
  requestId: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string; status: number }> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, code: "NOT_FOUND", message: "Registration request not found", status: 404 };
  }

  const reqDoc = await RegistrationRequest.findById(id);
  if (!reqDoc) {
    return { ok: false, code: "NOT_FOUND", message: "Registration request not found", status: 404 };
  }

  if (reqDoc.status !== "PENDING") {
    return {
      ok: false,
      code: "CONFLICT",
      message: `Request has already been ${reqDoc.status.toLowerCase()}`,
      status: 409,
    };
  }

  reqDoc.status = "REJECTED";
  reqDoc.accountStatus = "rejected";
  reqDoc.reviewedBy = new mongoose.Types.ObjectId(actor.userId);
  reqDoc.reviewedAt = new Date();
  reqDoc.rejectionReason = input.reason.trim();
  await reqDoc.save();

  // If user document existed with PENDING status, transition to REJECTED
  try {
    await User.updateOne({ email: reqDoc.email, status: "PENDING" }, { $set: { status: "REJECTED" } });
  } catch {
    // Ignore
  }

  // Audit Log
  try {
    await AuditLog.create([
      {
        userId: new mongoose.Types.ObjectId(actor.userId),
        action: "user.registration_rejected",
        resourceType: "USER",
        resourceId: reqDoc._id,
        agencyId: actor.agencyId && mongoose.Types.ObjectId.isValid(actor.agencyId) ? new mongoose.Types.ObjectId(actor.agencyId) : null,
        newValue: {
          status: "REJECTED",
          reason: input.reason.slice(0, 500),
        },
        requestId: /^[A-Za-z0-9_-]+$/.test(requestId) ? requestId.slice(0, 100) : "rejection",
      },
    ]);
  } catch {
    // Non-fatal
  }

  // Dispatch rejection notification
  try {
    await sendUserRegistrationRejectedNotification({
      recipientEmail: reqDoc.email,
      recipientName: reqDoc.fullName,
      organizationName: reqDoc.organizationName,
      rejectionReason: input.reason,
    });
  } catch {
    // Non-fatal
  }

  return { ok: true };
}


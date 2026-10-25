import { hash } from "bcryptjs";
import mongoose, { type ClientSession, type Types } from "mongoose";

import { Agency } from "../agencies/models/agency.model.js";
import { RefreshSession } from "./models/refresh-session.model.js";
import { Role } from "./models/role.model.js";
import { User } from "./models/user.model.js";
import { mapMongoDuplicateField } from "../../shared/errors/mongo-duplicate.js";
import {
  RegistrationInputError,
  assertNoPrivilegedKeys,
  staffProvisionSchema,
} from "./registration.schema.js";
import type {
  ProvisionedUserDto,
  StaffProvisionInput,
  StaffProvisionResult,
  TrustedProvisioningActor,
} from "./registration.types.js";

export const BCRYPT_COST = 12;

const AGENCY_OPTIONAL_SCOPES = new Set(["PLATFORM", "PUBLIC"]);

export class RegistrationDeniedError extends Error {
  readonly code = "FORBIDDEN" as const;
  constructor(message = "registration is not available to this actor") {
    super(message);
    this.name = "RegistrationDeniedError";
  }
}

export class RegistrationPolicyBlockedError extends Error {
  readonly code = "NOT_READY" as const;
  readonly policy = "Q-005" as const;
  constructor() {
    super("citizen self-registration is not enabled");
    this.name = "RegistrationPolicyBlockedError";
  }
}

export class RegistrationConflictError extends Error {
  readonly code = "DUPLICATE_RESOURCE" as const;
  constructor() {
    super("registration could not be completed");
    this.name = "RegistrationConflictError";
  }
}

export class RegistrationDependencyError extends Error {
  readonly code = "SERVICE_UNAVAILABLE" as const;
  constructor() {
    super("registration could not be stored");
    this.name = "RegistrationDependencyError";
  }
}

function assertTrustedActor(actor: TrustedProvisioningActor | undefined): void {
  if (
    !actor ||
    actor.source !== "server-internal" ||
    actor.capability !== "identity.provision"
  ) {
    throw new RegistrationDeniedError();
  }
}

function toDto(
  id: string,
  roleKey: StaffProvisionResult["user"]["roleKey"],
  agencyId: string | null,
): ProvisionedUserDto {
  return {
    id,
    status: "PENDING",
    emailVerified: false,
    roleKey,
    agencyId,
    nextAction: "VERIFY_EMAIL",
  };
}

/**
 * Trusted staff provisioning. Not mounted on HTTP.
 * Does not create sessions, send email, or accept anonymous callers.
 */
export async function provisionStaff(
  rawInput: StaffProvisionInput,
  actor: TrustedProvisioningActor,
  session?: ClientSession,
): Promise<StaffProvisionResult> {
  assertTrustedActor(actor);
  const parsed = staffProvisionSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new RegistrationInputError("registration input is invalid");
  }
  const input = parsed.data;
  if (input.roleKey === "CITIZEN") {
    throw new RegistrationPolicyBlockedError();
  }

  try {
    const roleQuery = Role.findOne({ key: input.roleKey, isActive: true });
    if (session) roleQuery.session(session);
    const role = await roleQuery;
    if (!role) {
      throw new RegistrationInputError("role is not available");
    }

    let agencyId: Types.ObjectId | null = null;
    if (AGENCY_OPTIONAL_SCOPES.has(role.scopeType)) {
      if (input.agencyCode) {
        throw new RegistrationInputError("this role does not take an agency");
      }
    } else if (!input.agencyCode) {
      throw new RegistrationInputError("agency is required for this role");
    } else {
      const agencyQuery = Agency.findOne({
        code: input.agencyCode,
        status: "ACTIVE",
      });
      if (session) agencyQuery.session(session);
      const agency = await agencyQuery;
      if (!agency) {
        throw new RegistrationInputError("agency is not available");
      }
      agencyId = agency._id;
    }

    const passwordHash = await hash(input.password, BCRYPT_COST);
    const createdBy =
      actor.actorUserId && mongoose.isValidObjectId(actor.actorUserId)
        ? new mongoose.Types.ObjectId(actor.actorUserId)
        : null;
    const doc = {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash,
      roleId: role._id,
      agencyId,
      status: "PENDING" as const,
      emailVerified: false,
      createdBy,
      updatedBy: createdBy,
    };
    const created = session
      ? (await User.create([doc], { session }))[0]
      : await User.create(doc);
    if (!created) throw new RegistrationDependencyError();
    const sessionCount = RefreshSession.countDocuments({ userId: created._id });
    if (session) sessionCount.session(session);
    const sessions = await sessionCount;
    if (sessions !== 0) {
      throw new RegistrationDependencyError();
    }
    const user = toDto(created._id.toString(), input.roleKey, agencyId?.toString() ?? null);
    return {
      user,
      audit: {
        action: "identity.user.provisioned",
        actorSource: "server-internal",
        actorUserId: actor.actorUserId,
        targetUserId: user.id,
        roleKey: input.roleKey,
        agencyId: user.agencyId,
      },
    };
  } catch (error) {
    if (
      error instanceof RegistrationInputError ||
      error instanceof RegistrationPolicyBlockedError ||
      error instanceof RegistrationDeniedError ||
      error instanceof RegistrationConflictError ||
      error instanceof RegistrationDependencyError
    ) {
      throw error;
    }
    if (mapMongoDuplicateField(error) === "email") {
      throw new RegistrationConflictError();
    }
    throw new RegistrationDependencyError();
  }
}

/** Public citizen signup stays closed until Q-005 is explicitly approved. */
export async function requestCitizenRegistration(
  _body: unknown,
): Promise<never> {
  throw new RegistrationPolicyBlockedError();
}

/**
 * Anonymous staff signup is unreachable. This rejects the body and writes nothing.
 */
export async function rejectAnonymousStaffRegistration(body: unknown): Promise<never> {
  assertNoPrivilegedKeys(body);
  throw new RegistrationDeniedError("anonymous staff registration is not available");
}

export function dtoHasNoSecrets(dto: ProvisionedUserDto): boolean {
  const record = dto as ProvisionedUserDto & Record<string, unknown>;
  return !("password" in record) && !("passwordHash" in record) && !("email" in record);
}

import mongoose from "mongoose";

import { Agency } from "../../agencies/models/agency.model.js";
import { Role } from "../models/role.model.js";
import { User } from "../models/user.model.js";
import type { AuthenticatedActor } from "../auth/require-authenticated.js";
import type { ProfilePatchInput } from "./profile.schema.js";
import type { SelfProfileDto } from "./profile.types.js";

export class ProfileDependencyError extends Error {
  constructor() {
    super("profile storage unavailable");
    this.name = "ProfileDependencyError";
  }
}

type ProfileResult =
  | { ok: true; profile: SelfProfileDto }
  | { ok: false; status: 404 | 409; code: "NOT_FOUND" | "CONFLICT" };

function readRevision(doc: { __v?: number }): number {
  return typeof doc.__v === "number" ? doc.__v : 0;
}

async function agencyLabel(agencyId: mongoose.Types.ObjectId | null | undefined): Promise<string | null> {
  if (!agencyId) return null;
  const agency = await Agency.findById(agencyId).select("name status");
  if (!agency || agency.status !== "ACTIVE") return null;
  return agency.name;
}

function toProfileDto(
  user: {
    _id: mongoose.Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    emailVerified: boolean;
    status: string;
    agencyId?: mongoose.Types.ObjectId | null;
    lastLoginAt?: Date | null;
    __v?: number;
  },
  roleKey: string,
  agencyName: string | null,
): SelfProfileDto {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    emailVerified: true,
    status: "ACTIVE",
    roleKey,
    agencyId: user.agencyId?.toString() ?? null,
    agencyName,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    revision: readRevision(user),
  };
}

async function loadEligibleOwnUser(actor: AuthenticatedActor) {
  if (mongoose.connection.readyState !== 1) throw new ProfileDependencyError();
  const userId = new mongoose.Types.ObjectId(actor.userId);
  const user = await User.findOne({
    _id: userId,
    status: "ACTIVE",
    emailVerified: true,
    roleId: actor.roleId,
    credentialEpoch: actor.credentialEpoch,
  }).select("firstName lastName email emailVerified status roleId agencyId lastLoginAt credentialEpoch");
  if (!user) return null;
  const role = await Role.findById(user.roleId).select("key isActive");
  if (!role?.isActive || role.key !== actor.roleKey) return null;
  if (user.agencyId && actor.agencyId && user.agencyId.toString() !== actor.agencyId) return null;
  return { user, roleKey: role.key };
}

export async function getSelfProfile(actor: AuthenticatedActor): Promise<ProfileResult> {
  try {
    const loaded = await loadEligibleOwnUser(actor);
    if (!loaded) return { ok: false, status: 404, code: "NOT_FOUND" };
    const agencyName =
      loaded.user.agencyId?.toString() === actor.agencyId
        ? await agencyLabel(loaded.user.agencyId)
        : null;
    return {
      ok: true,
      profile: toProfileDto(loaded.user, loaded.roleKey, agencyName),
    };
  } catch (error) {
    if (error instanceof ProfileDependencyError) throw error;
    throw new ProfileDependencyError();
  }
}

export async function updateSelfProfile(
  actor: AuthenticatedActor,
  input: ProfilePatchInput,
): Promise<ProfileResult> {
  try {
    const loaded = await loadEligibleOwnUser(actor);
    if (!loaded) return { ok: false, status: 404, code: "NOT_FOUND" };
    const currentRevision = readRevision(loaded.user);
    if (input.revision !== currentRevision) {
      return { ok: false, status: 409, code: "CONFLICT" };
    }
    const namesUnchanged =
      loaded.user.firstName === input.firstName && loaded.user.lastName === input.lastName;
    if (namesUnchanged) {
      const agencyName =
        loaded.user.agencyId?.toString() === actor.agencyId
          ? await agencyLabel(loaded.user.agencyId)
          : null;
      return {
        ok: true,
        profile: toProfileDto(loaded.user, loaded.roleKey, agencyName),
      };
    }
    const updated = await User.findOneAndUpdate(
      {
        _id: loaded.user._id,
        __v: input.revision,
        status: "ACTIVE",
        emailVerified: true,
        roleId: actor.roleId,
        credentialEpoch: actor.credentialEpoch,
      },
      {
        $set: {
          firstName: input.firstName,
          lastName: input.lastName,
          updatedBy: loaded.user._id,
        },
        $inc: { __v: 1 },
      },
      {
        new: true,
        runValidators: true,
        projection: {
          firstName: 1,
          lastName: 1,
          email: 1,
          emailVerified: 1,
          status: 1,
          roleId: 1,
          agencyId: 1,
          lastLoginAt: 1,
          __v: 1,
        },
      },
    );
    if (!updated) {
      const still = await User.findById(loaded.user._id).select("__v status emailVerified roleId credentialEpoch");
      if (
        !still ||
        still.status !== "ACTIVE" ||
        still.emailVerified !== true ||
        still.roleId.toString() !== actor.roleId ||
        still.credentialEpoch !== actor.credentialEpoch
      ) {
        return { ok: false, status: 404, code: "NOT_FOUND" };
      }
      return { ok: false, status: 409, code: "CONFLICT" };
    }
    const agencyName =
      updated.agencyId?.toString() === actor.agencyId ? await agencyLabel(updated.agencyId) : null;
    return {
      ok: true,
      profile: toProfileDto(updated, loaded.roleKey, agencyName),
    };
  } catch (error) {
    if (error instanceof ProfileDependencyError) throw error;
    throw new ProfileDependencyError();
  }
}

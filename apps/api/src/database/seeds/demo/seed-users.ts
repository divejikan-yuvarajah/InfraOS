import { Role } from "../../../modules/identity/models/role.model.js";
import { User } from "../../../modules/identity/models/user.model.js";
import {
  demoUserEmail,
  DEMO_USER_KEYS,
  NON_LOGIN_PASSWORD_HASH,
  type DemoUserKey,
} from "../helpers/fixture-users.js";
import type { DemoContext } from "./context.js";

const USER_META: Record<
  DemoUserKey,
  { firstName: string; lastName: string; roleKey: string; agencyCode?: string }
> = {
  PROJECT_MANAGER: {
    firstName: "Demo",
    lastName: "Project Manager",
    roleKey: "PROJECT_MANAGER",
    agencyCode: "DEMO_RDA",
  },
  AGENCY_OFFICER: {
    firstName: "Demo",
    lastName: "Agency Officer",
    roleKey: "AGENCY_OFFICER",
    agencyCode: "DEMO_RDA",
  },
  INSPECTOR: {
    firstName: "Demo",
    lastName: "Inspector",
    roleKey: "INSPECTOR",
  },
  FINANCE_OFFICER: {
    firstName: "Demo",
    lastName: "Finance Officer",
    roleKey: "GOV_ADMIN",
  },
  CITIZEN: {
    firstName: "Demo",
    lastName: "Citizen",
    roleKey: "CITIZEN",
  },
};

export async function seedDemoFixtureUsers(
  context: Pick<DemoContext, "agencies">,
): Promise<Map<DemoUserKey, import("mongoose").Types.ObjectId>> {
  const users = new Map<DemoUserKey, import("mongoose").Types.ObjectId>();

  for (const key of DEMO_USER_KEYS) {
    const meta = USER_META[key];
    const role = await Role.findOne({ key: meta.roleKey });
    if (!role) {
      throw new Error(`Missing role ${meta.roleKey} — run core seed first`);
    }
    const agencyId = meta.agencyCode
      ? (context.agencies.get(meta.agencyCode) ?? null)
      : null;
    const email = demoUserEmail(key);
    const doc = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          firstName: meta.firstName,
          lastName: meta.lastName,
          roleId: role._id,
          agencyId,
          status: "PENDING",
          emailVerified: false,
        },
        $setOnInsert: {
          email,
          passwordHash: NON_LOGIN_PASSWORD_HASH,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );
    users.set(key, doc._id);
  }

  return users;
}

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { env } from "../src/config/env.js";
import { RefreshFamily } from "../src/modules/identity/models/refresh-family.model.js";
import { RefreshSession } from "../src/modules/identity/models/refresh-session.model.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { RegistrationRequest } from "../src/modules/identity/models/registration-request.model.js";
import { submitAccountRegistrationRequest } from "../src/modules/identity/account-request.service.js";
import {
  approveRegistrationRequest,
  getRegistrationRequest,
  listRegistrationRequests,
  rejectRegistrationRequest,
} from "../src/modules/identity/admin-registrations/admin-registration.service.js";
import {
  AccountPendingApprovalError,
  AccountRejectedError,
  loginWithPassword,
} from "../src/modules/identity/auth/auth.service.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import {
  clearCoreCollections,
  startIsolatedMongo,
  stopIsolatedMongo,
} from "./helpers/mongo-memory.js";
import type { AuthenticatedActor } from "../src/modules/identity/auth/require-authenticated.js";

const PASSWORD = "SuperSecurePassword123!";

describe("Admin-Approved Registration System Flow", { timeout: 60_000 }, () => {
  let superAdminActor: AuthenticatedActor;
  let rdaAgencyId: string;
  let officerRoleId: string;

  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-test-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-test-0123456789abcdef";
    await startIsolatedMongo();
    await Role.syncIndexes();
    await User.syncIndexes();
    await Agency.syncIndexes();
    await RegistrationRequest.syncIndexes();
    await RefreshFamily.syncIndexes();
    await RefreshSession.syncIndexes();
  });

  afterEach(async () => {
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  async function seedSetup() {
    const superAdminRole = await Role.create({
      key: "SUPER_ADMIN",
      name: "Super Administrator",
      description: "Platform root operator",
      permissions: [...SYSTEM_ROLE_PERMISSIONS.SUPER_ADMIN],
      scopeType: "PLATFORM",
      isActive: true,
    });

    const officerRole = await Role.create({
      key: "AGENCY_OFFICER",
      name: "Agency Officer",
      description: "Institutional line officer",
      permissions: [...SYSTEM_ROLE_PERMISSIONS.AGENCY_OFFICER],
      scopeType: "AGENCY",
      isActive: true,
    });
    officerRoleId = officerRole._id.toString();

    const agency = await Agency.create({
      code: "RDA",
      name: "Road Development Authority",
      type: "ROAD",
      status: "ACTIVE",
    });
    rdaAgencyId = agency._id.toString();

    const adminUser = await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: "admin@infraos.gov.lk",
      passwordHash: "$2a$12$e8O0Z0000000000000000.0000000000000000000000000000000",
      roleId: superAdminRole._id,
      agencyId: agency._id,
      status: "ACTIVE",
      emailVerified: true,
      credentialEpoch: 0,
    });

    superAdminActor = {
      userId: adminUser._id.toString(),
      roleId: superAdminRole._id.toString(),
      roleKey: "SUPER_ADMIN",
      agencyId: agency._id.toString(),
      credentialEpoch: 0,
    };
  }

  it("completes the entire end-to-end flow: register -> blocked pending login -> admin review & approve -> successful login", async () => {
    await seedSetup();

    // 1. Applicant registers via the public signup wizard
    const submitted = await submitAccountRegistrationRequest({
      fullName: "Eng. Nimal Perera",
      email: "nimal.perera@rda.gov.lk",
      password: PASSWORD,
      organizationCode: "RDA",
      department: "Highways & Expressways Division",
      designation: "Chief Resident Engineer",
      requestedResponsibility: "PROJECT_MANAGEMENT",
      acceptedTerms: true,
    });

    expect(submitted.status).toBe("PENDING");
    expect(submitted.accountStatus).toBe("pending");
    expect(submitted.referenceCode).toMatch(/^REQ-\d{4}-[0-9A-F]{6}$/);

    // Verify stored document in MongoDB
    const storedReq = await RegistrationRequest.findById(submitted.id).select("+passwordHash");
    expect(storedReq).not.toBeNull();
    expect(storedReq?.status).toBe("PENDING");
    expect(storedReq?.accountStatus).toBe("pending");
    expect(storedReq?.passwordHash).not.toBe(PASSWORD); // Securely hashed

    // 2. Login restriction: applicant CANNOT log in while in PENDING status
    await expect(
      loginWithPassword({
        email: "nimal.perera@rda.gov.lk",
        password: PASSWORD,
        requestId: "test-login-1",
      }),
    ).rejects.toBeInstanceOf(AccountPendingApprovalError);

    // 3. Super Admin views the pending registrations queue
    const queue = await listRegistrationRequests(superAdminActor, {
      status: "PENDING",
      page: 1,
      limit: 10,
    });

    expect(queue.counts.pending).toBe(1);
    expect(queue.items.length).toBe(1);
    expect(queue.items[0]!.email).toBe("nimal.perera@rda.gov.lk");
    expect(queue.items[0]!.referenceCode).toBe(submitted.referenceCode);

    // Admin views detailed dossier
    const dossier = await getRegistrationRequest(superAdminActor, submitted.id);
    expect(dossier?.email).toBe("nimal.perera@rda.gov.lk");
    expect(dossier?.department).toBe("Highways & Expressways Division");

    // 4. Super Admin approves registration and assigns role + agency
    const approval = await approveRegistrationRequest(
      superAdminActor,
      submitted.id,
      {
        roleKey: "AGENCY_OFFICER",
        agencyCode: "RDA",
        notes: "Verified against Ministry Gazetted Staff Register",
      },
      "approval-req-1",
    );

    expect(approval.ok).toBe(true);
    if (!approval.ok) return;

    // Verify updated status in RegistrationRequest
    const updatedReq = await RegistrationRequest.findById(submitted.id);
    expect(updatedReq?.status).toBe("APPROVED");
    expect(updatedReq?.accountStatus).toBe("approved");
    expect(updatedReq?.reviewedBy?.toString()).toBe(superAdminActor.userId);

    // Verify activated User document created in MongoDB
    const activeUser = await User.findOne({ email: "nimal.perera@rda.gov.lk" });
    expect(activeUser).not.toBeNull();
    expect(activeUser?.status).toBe("ACTIVE");
    expect(activeUser?.emailVerified).toBe(true);
    expect(activeUser?.roleId.toString()).toBe(officerRoleId);
    expect(activeUser?.agencyId?.toString()).toBe(rdaAgencyId);

    // 5. Approved user can now log in successfully with their registered credentials
    const session = await loginWithPassword({
      email: "nimal.perera@rda.gov.lk",
      password: PASSWORD,
      requestId: "test-login-2",
    });

    expect(session).not.toBeNull();
    expect(session?.session.user.email).toBe("nimal.perera@rda.gov.lk");
    expect(session?.session.user.roleKey).toBe("AGENCY_OFFICER");
    expect(session?.session.accessToken).toBeTruthy();
  });

  it("handles rejection: applicant rejected by admin cannot log in", async () => {
    await seedSetup();

    const submitted = await submitAccountRegistrationRequest({
      fullName: "Suspicious User",
      email: "suspicious@example.com",
      password: PASSWORD,
      organizationCode: "RDA",
      department: "External",
      designation: "Consultant",
      requestedResponsibility: "OTHER_AUTHORIZED",
      acceptedTerms: true,
    });

    // Admin rejects request with reason
    const rejection = await rejectRegistrationRequest(
      superAdminActor,
      submitted.id,
      { reason: "Non-institutional domain; domain verification failed" },
      "reject-req-1",
    );

    expect(rejection.ok).toBe(true);

    const updatedReq = await RegistrationRequest.findById(submitted.id);
    expect(updatedReq?.status).toBe("REJECTED");
    expect(updatedReq?.accountStatus).toBe("rejected");
    expect(updatedReq?.rejectionReason).toBe("Non-institutional domain; domain verification failed");

    // Login is blocked with AccountRejectedError
    await expect(
      loginWithPassword({
        email: "suspicious@example.com",
        password: PASSWORD,
        requestId: "test-login-3",
      }),
    ).rejects.toBeInstanceOf(AccountRejectedError);
  });
});

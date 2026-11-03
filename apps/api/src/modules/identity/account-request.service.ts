import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";

import { Agency } from "../agencies/models/agency.model.js";
import {
  RegistrationRequest,
  REQUESTED_RESPONSIBILITY_KEYS,
  type RequestedResponsibilityKey,
} from "./models/registration-request.model.js";
import { User } from "./models/user.model.js";
import {
  assertNoPrivilegedKeys,
  BCRYPT_MAX_UTF8_BYTES,
  PASSWORD_MIN_LENGTH,
  RegistrationInputError,
} from "./registration.schema.js";
import {
  BCRYPT_COST,
  RegistrationConflictError,
  RegistrationDependencyError,
} from "./registration.service.js";
import { mapMongoDuplicateField } from "../../shared/errors/mongo-duplicate.js";

export type PublicInstitutionDto = {
  code: string;
  name: string;
  shortName: string | null;
  type: string;
};

export const STATUTORY_INSTITUTIONS_FALLBACK: readonly PublicInstitutionDto[] = [
  {
    code: "RDA",
    name: "Road Development Authority",
    shortName: "RDA",
    type: "AUTHORITY",
  },
  {
    code: "NWSDB",
    name: "National Water Supply & Drainage Board",
    shortName: "NWSDB",
    type: "UTILITY",
  },
  {
    code: "CEB",
    name: "Ceylon Electricity Board",
    shortName: "CEB",
    type: "UTILITY",
  },
  {
    code: "SLT",
    name: "Sri Lanka Telecom / National Fiber Grid",
    shortName: "SLT",
    type: "UTILITY",
  },
  {
    code: "UDA",
    name: "Urban Development Authority",
    shortName: "UDA",
    type: "AUTHORITY",
  },
  {
    code: "CMC",
    name: "Colombo Municipal Council",
    shortName: "CMC",
    type: "MUNICIPAL",
  },
  {
    code: "MIN_TRANSPORT_HIGHWAYS",
    name: "Ministry of Transport & Highways",
    shortName: "MoTH",
    type: "MINISTRY",
  },
  {
    code: "PRDA_WP",
    name: "Provincial Road Development Authority (Western Province)",
    shortName: "PRDA-WP",
    type: "AUTHORITY",
  },
  {
    code: "SLLDC",
    name: "Sri Lanka Land Development Corporation",
    shortName: "SLLDC",
    type: "CORPORATION",
  },
  {
    code: "NBRO",
    name: "National Building Research Organisation",
    shortName: "NBRO",
    type: "AGENCY",
  },
] as const;

const accountRequestBodySchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name is required").max(160).optional(),
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    email: z
      .string()
      .trim()
      .min(1, "Work email is required")
      .max(254)
      .email("email must be a valid email address")
      .transform((value) => value.toLowerCase()),
    password: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      )
      .refine(
        (value) => Buffer.byteLength(value, "utf8") <= BCRYPT_MAX_UTF8_BYTES,
        `password must not exceed ${BCRYPT_MAX_UTF8_BYTES} UTF-8 bytes`,
      ),
    organizationCode: z
      .string()
      .trim()
      .min(1, "Organization is required")
      .max(64)
      .transform((value) => value.toUpperCase()),
    organizationName: z.string().trim().min(1).max(160).optional(),
    department: z.string().trim().min(2, "Department or division is required").max(160),
    designation: z.string().trim().min(2, "Professional designation is required").max(160),
    requestedResponsibility: z.enum(REQUESTED_RESPONSIBILITY_KEYS),
    acceptedTerms: z.literal(true, {
      message: "Institutional terms and privacy notice must be accepted",
    }),
  })
  .strict();

export type AccountRegistrationRequestResult = {
  id: string;
  referenceCode: string;
  status: "PENDING";
  emailVerified: false;
  requestedResponsibility: RequestedResponsibilityKey;
  organizationCode: string;
  organizationName: string;
  nextAction: "AWAIT_INSTITUTIONAL_VERIFICATION";
};

function splitFullName(input: {
  fullName?: string;
  firstName?: string;
  lastName?: string;
}): { firstName: string; lastName: string; fullName: string } {
  if (input.firstName && input.lastName) {
    const first = input.firstName.trim();
    const last = input.lastName.trim();
    return {
      firstName: first.slice(0, 80),
      lastName: last.slice(0, 80),
      fullName: `${first} ${last}`.trim().slice(0, 160),
    };
  }
  const raw = (input.fullName ?? input.firstName ?? "").trim().replace(/\s+/g, " ");
  if (raw.length < 2) {
    throw new RegistrationInputError("Full name is required");
  }
  const parts = raw.split(" ");
  const firstName = (parts[0] ?? raw).slice(0, 80);
  const lastName = (parts.slice(1).join(" ") || "Officer").slice(0, 80);
  return {
    firstName,
    lastName,
    fullName: raw.slice(0, 160),
  };
}

function generateReferenceCode(): string {
  const year = new Date().getUTCFullYear();
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `REQ-${year}-${suffix}`;
}

export async function listPublicInstitutions(): Promise<PublicInstitutionDto[]> {
  try {
    const activeAgencies = await Agency.find({ status: "ACTIVE" })
      .select("code name shortName type")
      .sort({ name: 1 })
      .limit(100)
      .lean();
    if (!activeAgencies || activeAgencies.length === 0) {
      return [...STATUTORY_INSTITUTIONS_FALLBACK];
    }
    const byCode = new Map<string, PublicInstitutionDto>();
    for (const agency of activeAgencies) {
      byCode.set(agency.code.toUpperCase(), {
        code: agency.code.toUpperCase(),
        name: agency.name,
        shortName: agency.shortName ?? null,
        type: agency.type,
      });
    }
    for (const statutory of STATUTORY_INSTITUTIONS_FALLBACK) {
      if (!byCode.has(statutory.code)) {
        byCode.set(statutory.code, statutory);
      }
    }
    return Array.from(byCode.values());
  } catch {
    return [...STATUTORY_INSTITUTIONS_FALLBACK];
  }
}

export async function submitAccountRegistrationRequest(
  rawInput: unknown,
): Promise<AccountRegistrationRequestResult> {
  assertNoPrivilegedKeys(rawInput);

  const parsed = accountRequestBodySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new RegistrationInputError("registration input failed validation");
  }

  const names = splitFullName(parsed.data);
  const {
    email,
    password,
    organizationCode,
    department,
    designation,
    requestedResponsibility,
  } = parsed.data;

  let resolvedOrgName = parsed.data.organizationName?.trim() ?? "";
  try {
    const matchedAgency = await Agency.findOne({
      code: organizationCode,
      status: "ACTIVE",
    })
      .select("name")
      .lean();
    if (matchedAgency?.name) {
      resolvedOrgName = matchedAgency.name;
    }
  } catch {
    // Fallback to statutory list or provided name if agency lookup is unavailable
  }

  if (!resolvedOrgName) {
    const fallbackMatch = STATUTORY_INSTITUTIONS_FALLBACK.find(
      (item) => item.code === organizationCode,
    );
    resolvedOrgName = fallbackMatch?.name ?? organizationCode;
  }

  try {
    const [existingUser, existingPendingRequest] = await Promise.all([
      User.exists({ email }),
      RegistrationRequest.exists({ email, status: "PENDING" }),
    ]);

    if (existingUser || existingPendingRequest) {
      throw new RegistrationConflictError();
    }

    const passwordHash = await hash(password, BCRYPT_COST);
    const referenceCode = generateReferenceCode();

    const created = await RegistrationRequest.create({
      referenceCode,
      firstName: names.firstName,
      lastName: names.lastName,
      fullName: names.fullName,
      email,
      passwordHash,
      organizationCode,
      organizationName: resolvedOrgName.slice(0, 160),
      department,
      designation,
      requestedResponsibility,
      status: "PENDING",
      acceptedTermsAt: new Date(),
    });

    return {
      id: created._id.toString(),
      referenceCode: created.referenceCode,
      status: "PENDING",
      emailVerified: false,
      requestedResponsibility: created.requestedResponsibility,
      organizationCode: created.organizationCode,
      organizationName: created.organizationName,
      nextAction: "AWAIT_INSTITUTIONAL_VERIFICATION",
    };
  } catch (error) {
    if (
      error instanceof RegistrationConflictError ||
      error instanceof RegistrationInputError
    ) {
      throw error;
    }
    if (mapMongoDuplicateField(error) === "email") {
      throw new RegistrationConflictError();
    }
    throw new RegistrationDependencyError();
  }
}

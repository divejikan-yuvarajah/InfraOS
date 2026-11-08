import { z } from "zod";

import { getAuthAvailability } from "./availability";

function resolvedAuthApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_UTF8_BYTES = 72;

export const REQUESTED_RESPONSIBILITY_KEYS = [
  "PROJECT_MANAGEMENT",
  "AGENCY_COORDINATION",
  "ENGINEERING_OPERATIONS",
  "PROJECT_MONITORING",
  "INSTITUTIONAL_ADMIN",
  "OTHER_AUTHORIZED",
] as const;

export type RequestedResponsibilityKey = (typeof REQUESTED_RESPONSIBILITY_KEYS)[number];

export type PublicInstitutionOption = {
  code: string;
  name: string;
  shortName: string | null;
  type: string;
};

export const STATUTORY_INSTITUTIONS: readonly PublicInstitutionOption[] = [
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

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export type PasswordStrengthSummary = {
  score: 0 | 1 | 2 | 3 | 4;
  byteLength: number;
  meetsMinLength: boolean;
  withinMaxBytes: boolean;
  hasLetterAndNumber: boolean;
  hasMixedCaseOrSymbol: boolean;
};

export function evaluatePasswordStrength(password: string): PasswordStrengthSummary {
  const byteLength = utf8ByteLength(password);
  const meetsMinLength = password.length >= PASSWORD_MIN_LENGTH;
  const withinMaxBytes = byteLength <= PASSWORD_MAX_UTF8_BYTES;
  const hasLetterAndNumber = /[A-Za-z]/.test(password) && /\d/.test(password);
  const hasMixedCaseOrSymbol =
    (/[a-z]/.test(password) && /[A-Z]/.test(password)) || /[^A-Za-z0-9]/.test(password);

  if (!password) {
    return {
      score: 0,
      byteLength: 0,
      meetsMinLength: false,
      withinMaxBytes: true,
      hasLetterAndNumber: false,
      hasMixedCaseOrSymbol: false,
    };
  }

  if (!withinMaxBytes) {
    return {
      score: 1,
      byteLength,
      meetsMinLength,
      withinMaxBytes: false,
      hasLetterAndNumber,
      hasMixedCaseOrSymbol,
    };
  }

  let points = 0;
  if (meetsMinLength) points += 1;
  if (password.length >= 12) points += 1;
  if (hasLetterAndNumber) points += 1;
  if (hasMixedCaseOrSymbol) points += 1;

  const score = Math.min(4, Math.max(1, points)) as 1 | 2 | 3 | 4;
  return {
    score: meetsMinLength ? score : 1,
    byteLength,
    meetsMinLength,
    withinMaxBytes,
    hasLetterAndNumber,
    hasMixedCaseOrSymbol,
  };
}

export const registerStep1Schema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full official name")
      .max(160, "Full name must not exceed 160 characters"),
    email: z
      .string()
      .trim()
      .min(1, "Work email address is required")
      .max(254, "Email address is too long")
      .email("Enter a valid institutional email address")
      .transform((value) => value.toLowerCase()),
    password: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      )
      .refine(
        (value) => utf8ByteLength(value) <= PASSWORD_MAX_UTF8_BYTES,
        `Password must not exceed ${PASSWORD_MAX_UTF8_BYTES} UTF-8 bytes`,
      ),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const registerStep2Schema = z.object({
  organizationCode: z
    .string()
    .trim()
    .min(1, "Select your organization or institution")
    .max(64),
  organizationName: z.string().trim().max(160).optional(),
  department: z
    .string()
    .trim()
    .min(2, "Enter your department, division, or regional unit")
    .max(160),
  designation: z
    .string()
    .trim()
    .min(2, "Enter your official professional designation")
    .max(160),
  requestedResponsibility: z.enum(REQUESTED_RESPONSIBILITY_KEYS, {
    message: "Select your requested access responsibility",
  }),
});

export const registerStep3Schema = z.object({
  acceptedTerms: z.literal(true, {
    message: "You must acknowledge the institutional governance and privacy terms",
  }),
});

export type RegisterWizardValues = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  organizationCode: string;
  organizationName: string;
  department: string;
  designation: string;
  requestedResponsibility: RequestedResponsibilityKey | "";
  acceptedTerms: boolean;
};

export type RegistrationSubmissionOutcome =
  | {
      ok: true;
      mode: "live" | "preview";
      referenceCode: string;
      status: "PENDING";
      organizationName: string;
    }
  | {
      ok: false;
      code: "CONFLICT" | "VALIDATION" | "RATE_LIMITED" | "UNAVAILABLE";
      message: string;
    };

export async function fetchPublicInstitutions(): Promise<PublicInstitutionOption[]> {
  const baseUrl = resolvedAuthApiBaseUrl();
  if (!baseUrl) {
    return [...STATUTORY_INSTITUTIONS];
  }
  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/institutions`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [...STATUTORY_INSTITUTIONS];
    const body = (await response.json()) as {
      success?: boolean;
      data?: { institutions?: PublicInstitutionOption[] };
    };
    if (body?.success && Array.isArray(body.data?.institutions) && body.data.institutions.length > 0) {
      return body.data.institutions;
    }
    return [...STATUTORY_INSTITUTIONS];
  } catch {
    return [...STATUTORY_INSTITUTIONS];
  }
}

export async function submitRegistrationWithAuthClient(input: {
  fullName: string;
  email: string;
  password: string;
  organizationCode: string;
  organizationName: string;
  department: string;
  designation: string;
  requestedResponsibility: RequestedResponsibilityKey;
  acceptedTerms: true;
}): Promise<RegistrationSubmissionOutcome> {
  const availability = getAuthAvailability();
  const baseUrl = resolvedAuthApiBaseUrl();

  if (availability !== "live" || !baseUrl) {
    const year = new Date().getUTCFullYear();
    const hashSeed = Array.from(input.email)
      .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 0xffffff, 0x4a2f19)
      .toString(16)
      .toUpperCase()
      .padStart(6, "0");
    return {
      ok: true,
      mode: "preview",
      referenceCode: `REQ-${year}-${hashSeed}`,
      status: "PENDING",
      organizationName: input.organizationName || input.organizationCode,
    };
  }

  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
        organizationCode: input.organizationCode.trim().toUpperCase(),
        organizationName: input.organizationName.trim(),
        department: input.department.trim(),
        designation: input.designation.trim(),
        requestedResponsibility: input.requestedResponsibility,
        acceptedTerms: true,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      data?: {
        request?: {
          referenceCode?: string;
          organizationName?: string;
        };
      };
      error?: {
        code?: string;
        message?: string;
      };
    } | null;

    if (response.status === 201 && payload?.success && payload.data?.request) {
      return {
        ok: true,
        mode: "live",
        referenceCode: payload.data.request.referenceCode ?? "REQ-PENDING",
        status: "PENDING",
        organizationName:
          payload.data.request.organizationName ||
          input.organizationName ||
          input.organizationCode,
      };
    }

    if (
      response.status === 409 ||
      payload?.error?.code === "CONFLICT" ||
      payload?.error?.code === "DUPLICATE_RESOURCE"
    ) {
      return {
        ok: false,
        code: "CONFLICT",
        message:
          payload?.error?.message ??
          "An account or pending institutional request already exists for this email address.",
      };
    }

    if (response.status === 429 || payload?.error?.code === "RATE_LIMITED") {
      return {
        ok: false,
        code: "RATE_LIMITED",
        message: "Too many account requests. Please wait a few minutes and try again.",
      };
    }

    if (response.status === 400 || payload?.error?.code === "VALIDATION_ERROR") {
      return {
        ok: false,
        code: "VALIDATION",
        message:
          payload?.error?.message ??
          "Please review all required registration fields and try again.",
      };
    }

    return {
      ok: false,
      code: "UNAVAILABLE",
      message: "Institutional registration service is temporarily unavailable.",
    };
  } catch {
    return {
      ok: false,
      code: "UNAVAILABLE",
      message: "Network connection failed while submitting your request.",
    };
  }
}
